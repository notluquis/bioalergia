import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Service layer de redes sociales: pin de las transiciones de estado
// (approval-first), los guards (DomainError + mensajes es-CL) y el mapeo de
// targets en create. El enqueue vive en el handler oRPC (no acá) por el DAG.

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    socialPost: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    socialAccount: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../lib/logger.ts", () => ({ logEvent: vi.fn(), logError: vi.fn(), logWarn: vi.fn() }));
vi.mock("../../lib/secret-cipher.ts", () => ({ encryptSecret: (s: string) => `enc:${s}` }));
vi.mock("../../lib/social-settings.ts", () => ({
  getSocialDryRun: vi.fn(),
  setSocialDryRun: vi.fn(),
  getMetaAppPublicConfig: vi.fn(),
  setMetaAppConfig: vi.fn(),
  getTiktokPublicConfig: vi.fn(),
  setTiktokConfig: vi.fn(),
  getAiPublicConfig: vi.fn(),
  setAiConfig: vi.fn(),
}));
vi.mock("../../modules/social/render.ts", () => ({
  renderAndUploadSocialImage: vi.fn(async () => ({
    key: "social/1/x.png",
    url: "https://cdn.test/social/1/x.png",
    type: "image" as const,
    width: 1080,
    height: 1350,
  })),
  renderAiHeroAndUpload: vi.fn(async () => ({
    key: "social/1/hero.png",
    url: "https://cdn.test/social/1/hero.png",
    type: "image" as const,
    width: 1080,
    height: 1350,
  })),
}));

const {
  listSocialPosts,
  getSocialPost,
  createSocialPost,
  updateSocialPost,
  approveSocialPost,
  rejectSocialPost,
  scheduleSocialPost,
  publishNowSocialPost,
  renderSocialMedia,
  renderAiHero,
  connectMetaAccount,
  listSocialAccounts,
  getSocialSettings,
  updateSocialSettings,
  getMetaConfig,
  updateMetaConfig,
  getTiktokConfig,
  updateTiktokConfig,
  getAiConfig,
  updateAiConfig,
} = await import("../social.ts");
const settings = await import("../../lib/social-settings.ts");

function account(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    provider: "META",
    displayName: "Bio",
    metaBusinessId: "biz1",
    fbPageId: "fb1",
    igUserId: "ig1",
    tokenExpiresAt: null,
    graphApiVersion: "v23.0",
    active: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    ...over,
  };
}

function draft(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "DRAFT",
    mediaType: "IMAGE",
    aspectRatio: "RATIO_4_5",
    caption: "hola",
    hashtags: ["#alergia"],
    media: [],
    scheduledAt: null,
    approvedAt: null,
    targets: [],
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("listSocialPosts", () => {
  it("sin filtro de status → where undefined, ordena por createdAt desc", async () => {
    mockDb.socialPost.findMany.mockResolvedValue([draft({ id: 1 }), draft({ id: 2 })]);
    const res = await listSocialPosts({});
    expect(res).toHaveLength(2);
    const arg = mockDb.socialPost.findMany.mock.calls[0][0];
    expect(arg.where).toBeUndefined();
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("con filtro de status → where { status }", async () => {
    mockDb.socialPost.findMany.mockResolvedValue([]);
    await listSocialPosts({ status: "DRAFT" });
    expect(mockDb.socialPost.findMany.mock.calls[0][0].where).toEqual({ status: "DRAFT" });
  });

  it("serializa media nula como [] y conserva hashtags", async () => {
    mockDb.socialPost.findMany.mockResolvedValue([draft({ media: null, hashtags: ["#a"] })]);
    const res = await listSocialPosts({});
    expect(res[0].media).toEqual([]);
    expect(res[0].hashtags).toEqual(["#a"]);
  });
});

describe("getSocialPost", () => {
  it("devuelve el post serializado", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      draft({ id: 5, media: [{ key: "k", url: "u", type: "image" }] })
    );
    const res = await getSocialPost(5);
    expect(res.id).toBe(5);
    expect(res.media).toEqual([{ key: "k", url: "u", type: "image" }]);
  });

  it("lanza NOT_FOUND si no existe", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null);
    await expect(getSocialPost(99)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "NOT_FOUND"
    );
  });
});

describe("createSocialPost", () => {
  it("crea en DRAFT con targets mapeados", async () => {
    mockDb.socialPost.create.mockResolvedValue(draft({ targets: [{ id: 1 }] }));
    await createSocialPost(
      {
        mediaType: "IMAGE",
        aspectRatio: "RATIO_4_5",
        caption: "hola",
        hashtags: ["#alergia"],
        targets: [{ accountId: 7, network: "INSTAGRAM", placement: "IG_FEED" }],
      },
      42
    );
    const arg = mockDb.socialPost.create.mock.calls[0][0];
    expect(arg.data.status).toBe("DRAFT");
    expect(arg.data.createdByUserId).toBe(42);
    expect(arg.data.targets.create).toEqual([
      { accountId: 7, network: "INSTAGRAM", placement: "IG_FEED", captionOverride: null },
    ]);
  });

  it("normaliza media (quita undefined) y mapea scheduledAt a Date", async () => {
    mockDb.socialPost.create.mockResolvedValue(draft({ targets: [] }));
    const iso = new Date(Date.now() + 3_600_000).toISOString();
    await createSocialPost(
      {
        mediaType: "IMAGE",
        aspectRatio: "RATIO_4_5",
        scheduledAt: iso,
        media: [{ key: "k", url: "u", type: "image", width: 100 }],
        targets: [{ accountId: 1, network: "INSTAGRAM", placement: "IG_FEED" }],
      },
      1
    );
    const data = mockDb.socialPost.create.mock.calls[0][0].data;
    expect(data.media).toEqual([{ key: "k", url: "u", type: "image", width: 100 }]);
    expect(data.media[0].height).toBeUndefined();
    expect(data.scheduledAt).toBeInstanceOf(Date);
    expect(data.scheduledAt.toISOString()).toBe(iso);
  });

  it("defaults: sin title/caption/scheduledAt → null; sin hashtags → []", async () => {
    mockDb.socialPost.create.mockResolvedValue(draft({ targets: [] }));
    await createSocialPost(
      {
        mediaType: "IMAGE",
        aspectRatio: "RATIO_4_5",
        targets: [{ accountId: 1, network: "INSTAGRAM", placement: "IG_FEED" }],
      },
      1
    );
    const data = mockDb.socialPost.create.mock.calls[0][0].data;
    expect(data.title).toBeNull();
    expect(data.caption).toBeNull();
    expect(data.scheduledAt).toBeNull();
    expect(data.hashtags).toEqual([]);
    expect(data.media).toEqual([]);
  });
});

describe("updateSocialPost", () => {
  it("rechaza editar un post no editable (CONFLICT)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PUBLISHED" }));
    await expect(updateSocialPost({ id: 1, caption: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "CONFLICT"
    );
  });

  it("edita un DRAFT: aplica caption y deja scheduledAt sin tocar (undefined)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "DRAFT" }));
    mockDb.socialPost.update.mockResolvedValue(draft({ caption: "nuevo" }));
    await updateSocialPost({ id: 1, caption: "nuevo" });
    const data = mockDb.socialPost.update.mock.calls[0][0].data;
    expect(data.caption).toBe("nuevo");
    expect(data.scheduledAt).toBeUndefined(); // no enviado → no se modifica
  });

  it("edita un PENDING_APPROVAL: scheduledAt explícito null lo limpia", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PENDING_APPROVAL" }));
    mockDb.socialPost.update.mockResolvedValue(draft());
    await updateSocialPost({ id: 1, scheduledAt: null });
    expect(mockDb.socialPost.update.mock.calls[0][0].data.scheduledAt).toBeNull();
  });
});

describe("approveSocialPost", () => {
  it("DRAFT sin agenda → PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      draft({ media: [{ key: "k", url: "u", type: "image" }] })
    );
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "PUBLISHING" }));
    await approveSocialPost(1, 9);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("PUBLISHING");
    expect(mockDb.socialPost.update.mock.calls[0][0].data.approvedByUserId).toBe(9);
  });

  it("DRAFT con agenda futura → SCHEDULED", async () => {
    const future = new Date(Date.now() + 3_600_000);
    mockDb.socialPost.findUnique.mockResolvedValue(
      draft({ scheduledAt: future, media: [{ key: "k", url: "u", type: "image" }] })
    );
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "SCHEDULED" }));
    await approveSocialPost(1, 9);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("SCHEDULED");
  });

  it("rechaza aprobar un post ya publicado", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PUBLISHED" }));
    await expect(approveSocialPost(1, 9)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "CONFLICT"
    );
  });

  it("rechaza aprobar un VIDEO sin media renderizada (UNPROCESSABLE_ENTITY)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ media: [], mediaType: "VIDEO" }));
    await expect(approveSocialPost(1, 9)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "UNPROCESSABLE_ENTITY"
    );
  });

  it("aprueba un IMAGE sin media (excepción de la regla de media)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ media: [], mediaType: "IMAGE" }));
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "PUBLISHING" }));
    await approveSocialPost(1, 9);
    expect(mockDb.socialPost.update).toHaveBeenCalled();
  });

  it("agenda en el pasado → PUBLISHING (no SCHEDULED)", async () => {
    const past = new Date(Date.now() - 3_600_000);
    mockDb.socialPost.findUnique.mockResolvedValue(
      draft({ scheduledAt: past, media: [{ key: "k", url: "u", type: "image" }] })
    );
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "PUBLISHING" }));
    await approveSocialPost(1, 9);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("PUBLISHING");
  });
});

describe("rejectSocialPost", () => {
  it("vuelve a DRAFT con razón", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PENDING_APPROVAL" }));
    mockDb.socialPost.update.mockResolvedValue(draft());
    await rejectSocialPost(1, "tono incorrecto");
    expect(mockDb.socialPost.update.mock.calls[0][0].data).toMatchObject({
      status: "DRAFT",
      rejectedReason: "tono incorrecto",
    });
  });

  it("no rechaza un post en curso", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PUBLISHING" }));
    await expect(rejectSocialPost(1, "x")).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "CONFLICT"
    );
  });
});

describe("scheduleSocialPost", () => {
  it("rechaza agenda en el pasado (BAD_REQUEST)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft());
    await expect(
      scheduleSocialPost(1, new Date(Date.now() - 1000).toISOString())
    ).rejects.toSatisfy((e) => isDomainError(e) && e.kind === "BAD_REQUEST");
  });

  it("rechaza fecha inválida (NaN) con BAD_REQUEST", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft());
    await expect(scheduleSocialPost(1, "no-es-fecha")).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });

  it("rechaza agenda dentro del margen de 30s (boundary)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft());
    await expect(
      scheduleSocialPost(1, new Date(Date.now() + 10_000).toISOString())
    ).rejects.toSatisfy((e) => isDomainError(e) && e.kind === "BAD_REQUEST");
  });

  it("agenda futura en un post aprobado → status SCHEDULED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ approvedAt: new Date() }));
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "SCHEDULED" }));
    const future = new Date(Date.now() + 3_600_000).toISOString();
    await scheduleSocialPost(1, future);
    const data = mockDb.socialPost.update.mock.calls[0][0].data;
    expect(data.status).toBe("SCHEDULED");
    expect(data.scheduledAt).toBeInstanceOf(Date);
  });

  it("agenda futura en un post NO aprobado → conserva su status", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "DRAFT", approvedAt: null }));
    mockDb.socialPost.update.mockResolvedValue(draft());
    await scheduleSocialPost(1, new Date(Date.now() + 3_600_000).toISOString());
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("DRAFT");
  });
});

describe("publishNowSocialPost", () => {
  it("rechaza si no está aprobado (CONFLICT)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ approvedAt: null }));
    await expect(publishNowSocialPost(1)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "CONFLICT"
    );
  });

  it("aprobado → pasa a PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ approvedAt: new Date() }));
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "PUBLISHING" }));
    await publishNowSocialPost(1);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("PUBLISHING");
  });
});

describe("settings y meta config", () => {
  it("getSocialSettings devuelve { dryRun } del helper", async () => {
    vi.mocked(settings.getSocialDryRun).mockResolvedValue(true);
    expect(await getSocialSettings()).toEqual({ dryRun: true });
  });

  it("updateSocialSettings persiste y refleja el valor", async () => {
    vi.mocked(settings.setSocialDryRun).mockResolvedValue(undefined);
    const res = await updateSocialSettings({ dryRun: false });
    expect(settings.setSocialDryRun).toHaveBeenCalledWith(false);
    expect(res).toEqual({ dryRun: false });
  });

  it("getMetaConfig delega en el helper público", async () => {
    const cfg = { appId: "a", configId: "c", graphVersion: "v23.0", hasSecret: true };
    vi.mocked(settings.getMetaAppPublicConfig).mockResolvedValue(cfg);
    expect(await getMetaConfig()).toEqual(cfg);
  });

  it("updateMetaConfig rechaza appId vacío (BAD_REQUEST)", async () => {
    await expect(updateMetaConfig({ appId: "  ", configId: "c" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });

  it("updateMetaConfig rechaza configId vacío (BAD_REQUEST)", async () => {
    await expect(updateMetaConfig({ appId: "a", configId: "" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });

  it("updateMetaConfig válido → persiste vía helper", async () => {
    const cfg = { appId: "a", configId: "c", graphVersion: "v23.0", hasSecret: false };
    vi.mocked(settings.setMetaAppConfig).mockResolvedValue(cfg);
    const res = await updateMetaConfig({ appId: "a", configId: "c" });
    expect(settings.setMetaAppConfig).toHaveBeenCalledWith({ appId: "a", configId: "c" });
    expect(res).toEqual(cfg);
  });

  it("getTiktokConfig delega en el helper público", async () => {
    const cfg = { clientKey: "ck", hasSecret: true };
    vi.mocked(settings.getTiktokPublicConfig).mockResolvedValue(cfg);
    expect(await getTiktokConfig()).toEqual(cfg);
  });

  it("updateTiktokConfig rechaza clientKey vacío (BAD_REQUEST)", async () => {
    await expect(updateTiktokConfig({ clientKey: "  " })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST"
    );
  });

  it("updateTiktokConfig válido → persiste vía helper", async () => {
    const cfg = { clientKey: "ck", hasSecret: false };
    vi.mocked(settings.setTiktokConfig).mockResolvedValue(cfg);
    const res = await updateTiktokConfig({ clientKey: "ck" });
    expect(settings.setTiktokConfig).toHaveBeenCalledWith({ clientKey: "ck" });
    expect(res).toEqual(cfg);
  });
});

describe("listSocialAccounts", () => {
  it("serializa cuentas reflejando el provider de la fila (META)", async () => {
    mockDb.socialAccount.findMany.mockResolvedValue([account({ id: 3 })]);
    const res = await listSocialAccounts();
    expect(res).toHaveLength(1);
    expect(res[0].provider).toBe("META");
    expect(res[0].id).toBe(3);
    expect(res[0].fbPageId).toBe("fb1");
    expect(res[0].graphApiVersion).toBe("v23.0");
    expect(mockDb.socialAccount.findMany.mock.calls[0][0].orderBy).toEqual({ id: "asc" });
  });

  it("refleja provider TIKTOK cuando la fila lo tiene", async () => {
    mockDb.socialAccount.findMany.mockResolvedValue([account({ id: 5, provider: "TIKTOK" })]);
    const res = await listSocialAccounts();
    expect(res[0].provider).toBe("TIKTOK");
  });
});

describe("renderSocialMedia", () => {
  it("renderiza y agrega a media[]", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft());
    mockDb.socialPost.update.mockResolvedValue(
      draft({
        media: [{ key: "social/1/x.png", url: "https://cdn.test/social/1/x.png", type: "image" }],
      })
    );
    const res = await renderSocialMedia({ id: 1, template: "tip-card", props: {} });
    expect(res.media).toHaveLength(1);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.media[0].url).toContain("cdn.test");
  });
});

describe("renderAiHero", () => {
  it("genera el hero y lo agrega a media[] (post editable)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "DRAFT" }));
    mockDb.socialPost.update.mockResolvedValue(
      draft({
        media: [
          { key: "social/1/hero.png", url: "https://cdn.test/social/1/hero.png", type: "image" },
        ],
      })
    );
    const res = await renderAiHero({
      id: 1,
      prompt: "consultorio luminoso",
      title: "Respira mejor",
    });
    expect(res.media).toHaveLength(1);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.media[0].url).toContain("hero.png");
  });

  it("rechaza generar en un post no editable (CONFLICT)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PUBLISHED" }));
    await expect(renderAiHero({ id: 1, prompt: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "CONFLICT"
    );
  });
});

describe("ai config", () => {
  it("getAiConfig delega en el helper público", async () => {
    const cfg = { provider: "GEMINI" as const, hasGeminiKey: true, hasRecraftKey: false };
    vi.mocked(settings.getAiPublicConfig).mockResolvedValue(cfg);
    expect(await getAiConfig()).toEqual(cfg);
  });

  it("updateAiConfig persiste vía helper y refleja el resultado", async () => {
    const cfg = { provider: "RECRAFT" as const, hasGeminiKey: false, hasRecraftKey: true };
    vi.mocked(settings.setAiConfig).mockResolvedValue(cfg);
    const res = await updateAiConfig({ provider: "RECRAFT", recraftApiKey: "k" });
    expect(settings.setAiConfig).toHaveBeenCalledWith({ provider: "RECRAFT", recraftApiKey: "k" });
    expect(res).toEqual(cfg);
  });
});

describe("connectMetaAccount", () => {
  it("encripta los secrets antes de persistir", async () => {
    mockDb.socialAccount.create.mockResolvedValue({
      id: 1,
      displayName: "Bio",
      metaBusinessId: null,
      fbPageId: null,
      igUserId: null,
      tokenExpiresAt: null,
      graphApiVersion: "v23.0",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connectMetaAccount({ appId: "a", appSecret: "secret", shortLivedToken: "tok" });
    const data = mockDb.socialAccount.create.mock.calls[0][0].data;
    expect(data.appSecret).toBe("enc:secret");
    expect(data.pageAccessToken).toBe("enc:tok");
  });
});
