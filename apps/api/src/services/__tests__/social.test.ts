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
vi.mock("../../modules/social/render.ts", () => ({
  renderAndUploadSocialImage: vi.fn(async () => ({
    key: "social/1/x.png",
    url: "https://cdn.test/social/1/x.png",
    type: "image" as const,
    width: 1080,
    height: 1350,
  })),
}));

const {
  createSocialPost,
  updateSocialPost,
  approveSocialPost,
  rejectSocialPost,
  scheduleSocialPost,
  renderSocialMedia,
  connectMetaAccount,
} = await import("../social.ts");

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
      42,
    );
    const arg = mockDb.socialPost.create.mock.calls[0][0];
    expect(arg.data.status).toBe("DRAFT");
    expect(arg.data.createdByUserId).toBe(42);
    expect(arg.data.targets.create).toEqual([
      { accountId: 7, network: "INSTAGRAM", placement: "IG_FEED", captionOverride: null },
    ]);
  });
});

describe("updateSocialPost", () => {
  it("rechaza editar un post no editable (CONFLICT)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PUBLISHED" }));
    await expect(updateSocialPost({ id: 1, caption: "x" })).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "CONFLICT",
    );
  });
});

describe("approveSocialPost", () => {
  it("DRAFT sin agenda → PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ media: [{ key: "k", url: "u", type: "image" }] }));
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "PUBLISHING" }));
    await approveSocialPost(1, 9);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("PUBLISHING");
    expect(mockDb.socialPost.update.mock.calls[0][0].data.approvedByUserId).toBe(9);
  });

  it("DRAFT con agenda futura → SCHEDULED", async () => {
    const future = new Date(Date.now() + 3_600_000);
    mockDb.socialPost.findUnique.mockResolvedValue(
      draft({ scheduledAt: future, media: [{ key: "k", url: "u", type: "image" }] }),
    );
    mockDb.socialPost.update.mockResolvedValue(draft({ status: "SCHEDULED" }));
    await approveSocialPost(1, 9);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.status).toBe("SCHEDULED");
  });

  it("rechaza aprobar un post ya publicado", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft({ status: "PUBLISHED" }));
    await expect(approveSocialPost(1, 9)).rejects.toSatisfy((e) => isDomainError(e) && e.kind === "CONFLICT");
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
    await expect(rejectSocialPost(1, "x")).rejects.toSatisfy((e) => isDomainError(e) && e.kind === "CONFLICT");
  });
});

describe("scheduleSocialPost", () => {
  it("rechaza agenda en el pasado (BAD_REQUEST)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft());
    await expect(scheduleSocialPost(1, new Date(Date.now() - 1000).toISOString())).rejects.toSatisfy(
      (e) => isDomainError(e) && e.kind === "BAD_REQUEST",
    );
  });
});

describe("renderSocialMedia", () => {
  it("renderiza y agrega a media[]", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(draft());
    mockDb.socialPost.update.mockResolvedValue(draft({ media: [{ key: "social/1/x.png", url: "https://cdn.test/social/1/x.png", type: "image" }] }));
    const res = await renderSocialMedia({ id: 1, template: "tip-card", props: {} });
    expect(res.media).toHaveLength(1);
    expect(mockDb.socialPost.update.mock.calls[0][0].data.media[0].url).toContain("cdn.test");
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
