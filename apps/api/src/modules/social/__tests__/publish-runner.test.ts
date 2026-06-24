import { beforeEach, describe, expect, it, vi } from "vitest";

// State machine de publicación social. Cubre el dry-run (Fase A, simula en una
// vuelta) y el flujo real del Graph (Fase B: IG container create→poll→publish,
// FB síncrono) con los submódulos graph mockeados.

const { mockDb, igMock, fbMock, ttMock } = vi.hoisted(() => {
  const mockDb = {
    socialPost: { findUnique: vi.fn(), update: vi.fn() },
    socialPostTarget: { update: vi.fn(), findMany: vi.fn() },
    socialAccount: { findUnique: vi.fn() },
  };
  const igMock = {
    createImageContainer: vi.fn(),
    createReelContainer: vi.fn(),
    createStoryContainer: vi.fn(),
    createCarouselContainer: vi.fn(),
    getContainerStatus: vi.fn(),
    publishContainer: vi.fn(),
    getPermalink: vi.fn(),
  };
  const fbMock = { publishFbPhoto: vi.fn(), publishFbFeed: vi.fn() };
  const ttMock = {
    queryCreatorInfo: vi.fn(),
    initVideoPost: vi.fn(),
    fetchPublishStatus: vi.fn(),
  };
  return { mockDb, igMock, fbMock, ttMock };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../../lib/logger.ts", () => ({
  logEvent: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("../../../lib/social-settings.ts", () => ({ getSocialDryRun: vi.fn() }));
vi.mock("../graph/_http.ts", () => ({
  loadSocialAccount: vi.fn(async (id: number) => ({
    id,
    igUserId: "ig1",
    fbPageId: "fb1",
    pageAccessToken: "tok",
    userAccessToken: null,
    appId: null,
    appSecret: null,
    tokenExpiresAt: null,
    graphApiVersion: "v23.0",
  })),
}));
vi.mock("../graph/oauth.ts", () => ({ getValidPageToken: vi.fn(async () => "tok") }));
vi.mock("../graph/rate-limit.ts", () => ({ checkAndIncrementBuc: vi.fn() }));
vi.mock("../graph/instagram.ts", () => igMock);
vi.mock("../graph/facebook.ts", () => fbMock);
vi.mock("../tiktok/_http.ts", () => ({
  loadTiktokAccount: vi.fn(async (id: number) => ({
    id,
    openId: "open_1",
    accessToken: "tt_tok",
    refreshToken: "tt_refresh",
    tokenExpiresAt: null,
    refreshExpiresAt: null,
    clientKey: "ck",
    clientSecret: "cs",
  })),
}));
vi.mock("../tiktok/oauth.ts", () => ({ getValidTiktokAccessToken: vi.fn(async () => "tt_tok") }));
vi.mock("../tiktok/publish.ts", () => ({
  DEFAULT_PRIVACY_LEVEL: "SELF_ONLY",
  queryCreatorInfo: ttMock.queryCreatorInfo,
  initVideoPost: ttMock.initVideoPost,
  fetchPublishStatus: ttMock.fetchPublishStatus,
}));

const { advanceSocialPost, publishSocialPost } = await import("../publish-runner.ts");
const { getSocialDryRun } = await import("../../../lib/social-settings.ts");

function post(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "PUBLISHING",
    caption: "hola",
    hashtags: ["alergia"],
    mediaType: "IMAGE",
    media: [{ url: "https://cdn/x.png", type: "image" }],
    targets: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSocialDryRun).mockResolvedValue(true); // default = dry-run
});

describe("advanceSocialPost — dry-run (Fase A)", () => {
  it("publica todos los targets y cierra el post en PUBLISHED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(res).toEqual({ status: "PUBLISHED", pending: 0 });
    expect(igMock.createImageContainer).not.toHaveBeenCalled(); // dry-run no toca Graph
    // post-level close: no fallos → errorMessage null
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", errorMessage: null }),
      })
    );
  });

  it("simula con externalId dryrun_ y suma un intento (attempts+1)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 2,
          },
        ],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    const patch = mockDb.socialPostTarget.update.mock.calls[0][0].data;
    expect(patch.status).toBe("PUBLISHED");
    expect(patch.externalId).toMatch(/^dryrun_\d+$/);
    expect(patch.permalink).toBeNull();
    expect(patch.attempts).toBe(3); // 2 + 1
    expect(patch.errorCode).toBeNull();
    expect(patch.errorMessage).toBeNull();
  });

  it("salta los targets ya terminales (no los re-procesa)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PUBLISHED",
            containerId: null,
            captionOverride: null,
            attempts: 1,
          },
        ],
      })
    );
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(mockDb.socialPostTarget.update).not.toHaveBeenCalled(); // TERMINAL → continue
  });

  it("mezcla de fallos: 1 PUBLISHED + 1 FAILED → post PUBLISHED con errorMessage parcial", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(post({ targets: [] }));
    mockDb.socialPostTarget.findMany.mockResolvedValue([
      { id: 10, status: "PUBLISHED" },
      { id: 11, status: "FAILED" },
    ]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(res).toEqual({ status: "PUBLISHED", pending: 0 });
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          errorMessage: "Algunos destinos fallaron",
        }),
      })
    );
  });

  it("todos FAILED → post FAILED con errorMessage 'Publicación fallida'", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(post({ targets: [] }));
    mockDb.socialPostTarget.findMany.mockResolvedValue([
      { id: 10, status: "FAILED" },
      { id: 11, status: "FAILED" },
    ]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(res).toEqual({ status: "FAILED", pending: 0 });
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorMessage: "Publicación fallida" }),
      })
    );
  });

  it("hay un target aún pendiente → no cierra el post (pending>0)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(post({ targets: [] }));
    mockDb.socialPostTarget.findMany.mockResolvedValue([
      { id: 10, status: "PUBLISHED" },
      { id: 11, status: "CREATING" },
    ]);

    const res = await advanceSocialPost(1);

    expect(res).toEqual({ status: "PUBLISHING", pending: 1 });
    expect(mockDb.socialPost.update).not.toHaveBeenCalled(); // sigue abierto
  });

  it("no avanza si el post no está en PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(post({ status: "DRAFT", targets: [] }));
    expect(await advanceSocialPost(1)).toEqual({ status: "DRAFT", pending: 0 });
  });

  it("retorna missing si el post no existe", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null);
    expect(await advanceSocialPost(99)).toEqual({ status: "missing", pending: 0 });
  });
});

describe("advanceSocialPost — real Graph (Fase B)", () => {
  beforeEach(() => {
    vi.mocked(getSocialDryRun).mockResolvedValue(false);
  });

  it("IG feed PENDING → crea container y queda CREATING (pendiente)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    igMock.createImageContainer.mockResolvedValue("cont_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    const res = await advanceSocialPost(1);

    expect(igMock.createImageContainer).toHaveBeenCalledWith(
      expect.anything(),
      "https://cdn/x.png",
      expect.stringContaining("hola")
    );
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CREATING", containerId: "cont_1" }),
      })
    );
    expect(res).toEqual({ status: "PUBLISHING", pending: 1 });
  });

  it("IG feed CREATING + container FINISHED → publica y queda PUBLISHED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "CREATING",
            containerId: "cont_1",
            captionOverride: null,
            attempts: 1,
          },
        ],
      })
    );
    igMock.getContainerStatus.mockResolvedValue("FINISHED");
    igMock.publishContainer.mockResolvedValue("media_99");
    igMock.getPermalink.mockResolvedValue("https://instagram.com/p/abc");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(igMock.publishContainer).toHaveBeenCalledWith(expect.anything(), "cont_1");
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          externalId: "media_99",
          permalink: "https://instagram.com/p/abc",
        }),
      })
    );
    expect(res.status).toBe("PUBLISHED");
  });

  it("IG container IN_PROGRESS → sigue pendiente (no publica)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "CREATING",
            containerId: "cont_1",
            captionOverride: null,
            attempts: 1,
          },
        ],
      })
    );
    igMock.getContainerStatus.mockResolvedValue("IN_PROGRESS");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    const res = await advanceSocialPost(1);

    expect(igMock.publishContainer).not.toHaveBeenCalled();
    expect(res).toEqual({ status: "PUBLISHING", pending: 1 });
  });

  it("FB feed PENDING → publica foto síncrona y queda PUBLISHED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 11,
            accountId: 1,
            network: "FACEBOOK",
            placement: "FB_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    fbMock.publishFbPhoto.mockResolvedValue("fbpost_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 11, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(fbMock.publishFbPhoto).toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", externalId: "fbpost_1" }),
      })
    );
  });

  it("cuenta inexistente → target FAILED (post FAILED, msg recortado a 500)", async () => {
    const { loadSocialAccount } = await import("../graph/_http.ts");
    vi.mocked(loadSocialAccount).mockResolvedValueOnce(null);
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 12,
            accountId: 999,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 3,
          },
        ],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 12, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    const targetPatch = mockDb.socialPostTarget.update.mock.calls[0][0].data;
    expect(targetPatch.status).toBe("FAILED");
    expect(targetPatch.errorMessage).toContain("999");
    expect(targetPatch.errorMessage.length).toBeLessThanOrEqual(500);
    expect(targetPatch.attempts).toBe(4); // 3 + 1
    // único target falló → post FAILED
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });

  it("caption: antepone # a hashtags sin prefijo y trimea (no dobla los que ya lo tienen)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        caption: "hola",
        hashtags: ["alergia", "#salud"],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    igMock.createImageContainer.mockResolvedValue("cont_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    await advanceSocialPost(1);

    const caption = igMock.createImageContainer.mock.calls[0][2] as string;
    expect(caption).toContain("#alergia"); // sin prefijo → se le agrega
    expect(caption).toContain("#salud"); // ya tenía # → no se dobla
    expect(caption).not.toContain("##");
    expect(caption.startsWith("hola")).toBe(true); // trimeado, empieza con el base
  });

  it("caption override del target gana sobre el caption del post", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        caption: "post-caption",
        hashtags: [],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: "override!",
            attempts: 0,
          },
        ],
      })
    );
    igMock.createImageContainer.mockResolvedValue("cont_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    await advanceSocialPost(1);

    expect(igMock.createImageContainer).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "override!"
    );
  });

  it("story NO lleva caption (undefined) y usa createStoryContainer con isVideo", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        media: [{ url: "https://cdn/v.mp4", type: "video" }],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_STORY",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    igMock.createStoryContainer.mockResolvedValue("cont_story");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    await advanceSocialPost(1);

    expect(igMock.createStoryContainer).toHaveBeenCalledWith(
      expect.anything(),
      "https://cdn/v.mp4",
      true
    );
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CREATING", containerId: "cont_story" }),
      })
    );
  });

  it("story sin media → target FAILED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        media: [],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_STORY",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(igMock.createStoryContainer).not.toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorMessage: "Story sin media" }),
      })
    );
  });

  it("reel → createReelContainer con caption", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        media: [{ url: "https://cdn/v.mp4", type: "video" }],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_REEL",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    igMock.createReelContainer.mockResolvedValue("cont_reel");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    await advanceSocialPost(1);

    expect(igMock.createReelContainer).toHaveBeenCalledWith(
      expect.anything(),
      "https://cdn/v.mp4",
      expect.stringContaining("hola")
    );
  });

  it("carousel → createCarouselContainer con items mapeados (isVideo por type)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        mediaType: "CAROUSEL",
        media: [
          { url: "https://cdn/a.png", type: "image" },
          { url: "https://cdn/b.mp4", type: "video" },
        ],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    igMock.createCarouselContainer.mockResolvedValue("cont_carousel");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    await advanceSocialPost(1);

    expect(igMock.createCarouselContainer).toHaveBeenCalledWith(
      expect.anything(),
      [
        { url: "https://cdn/a.png", isVideo: false },
        { url: "https://cdn/b.mp4", isVideo: true },
      ],
      expect.any(String)
    );
  });

  it("IG image PENDING sin media → target FAILED ('Post sin media')", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        media: [],
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(igMock.createImageContainer).not.toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", errorMessage: "Post sin media" }),
      })
    );
  });

  it("IG container ERROR → target FAILED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 10,
            accountId: 1,
            network: "INSTAGRAM",
            placement: "IG_FEED",
            status: "CREATING",
            containerId: "cont_1",
            captionOverride: null,
            attempts: 1,
          },
        ],
      })
    );
    igMock.getContainerStatus.mockResolvedValue("ERROR");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(igMock.publishContainer).not.toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("ERROR"),
        }),
      })
    );
  });

  it("FB feed sin foto → publishFbFeed con texto (caption ?? '')", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        caption: "solo texto",
        hashtags: [],
        media: [],
        targets: [
          {
            id: 11,
            accountId: 1,
            network: "FACEBOOK",
            placement: "FB_FEED",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    fbMock.publishFbFeed.mockResolvedValue("fbfeed_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 11, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(fbMock.publishFbPhoto).not.toHaveBeenCalled();
    expect(fbMock.publishFbFeed).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("solo texto")
    );
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", externalId: "fbfeed_1" }),
      })
    );
  });

  it("placement de Facebook no soportado → target FAILED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        targets: [
          {
            id: 11,
            accountId: 1,
            network: "FACEBOOK",
            placement: "FB_STORY",
            status: "PENDING",
            containerId: null,
            captionOverride: null,
            attempts: 0,
          },
        ],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 11, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(fbMock.publishFbPhoto).not.toHaveBeenCalled();
    expect(fbMock.publishFbFeed).not.toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("FB_STORY"),
        }),
      })
    );
  });
});

describe("advanceSocialPost — TikTok (Fase B)", () => {
  beforeEach(() => {
    vi.mocked(getSocialDryRun).mockResolvedValue(false);
  });

  function ttTarget(over: Record<string, unknown> = {}) {
    return {
      id: 20,
      accountId: 1,
      network: "TIKTOK",
      placement: "TIKTOK_VIDEO",
      status: "PENDING",
      containerId: null,
      captionOverride: null,
      attempts: 0,
      ...over,
    };
  }

  it("PENDING → queryCreatorInfo + init PULL_FROM_URL → CREATING con publish_id", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        caption: "video tip",
        mediaType: "VIDEO",
        media: [{ url: "https://cdn/v.mp4", type: "video" }],
        targets: [ttTarget()],
      })
    );
    ttMock.queryCreatorInfo.mockResolvedValue({
      privacyLevelOptions: ["SELF_ONLY"],
      maxVideoPostDurationSec: 600,
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
    });
    ttMock.initVideoPost.mockResolvedValue("publish_123");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 20, status: "CREATING" }]);

    const res = await advanceSocialPost(1);

    expect(ttMock.queryCreatorInfo).toHaveBeenCalled();
    expect(ttMock.initVideoPost).toHaveBeenCalledWith(
      expect.anything(),
      "tt_tok",
      expect.objectContaining({
        videoUrl: "https://cdn/v.mp4",
        privacyLevel: "SELF_ONLY", // pre-audit default
        title: "video tip",
      })
    );
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CREATING", containerId: "publish_123" }),
      })
    );
    expect(res).toEqual({ status: "PUBLISHING", pending: 1 });
  });

  it("CREATING + status PUBLISH_COMPLETE → PUBLISHED con externalId del post", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        mediaType: "VIDEO",
        media: [{ url: "https://cdn/v.mp4", type: "video" }],
        targets: [ttTarget({ status: "CREATING", containerId: "publish_123", attempts: 1 })],
      })
    );
    ttMock.fetchPublishStatus.mockResolvedValue({
      status: "PUBLISH_COMPLETE",
      postId: "tt_post_99",
    });
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 20, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(ttMock.fetchPublishStatus).toHaveBeenCalledWith(
      expect.anything(),
      "tt_tok",
      "publish_123"
    );
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", externalId: "tt_post_99" }),
      })
    );
    expect(res.status).toBe("PUBLISHED");
  });

  it("CREATING + status PROCESSING → sigue pendiente (no publica)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        mediaType: "VIDEO",
        media: [{ url: "https://cdn/v.mp4", type: "video" }],
        targets: [ttTarget({ status: "CREATING", containerId: "publish_123", attempts: 1 })],
      })
    );
    ttMock.fetchPublishStatus.mockResolvedValue({ status: "PROCESSING_DOWNLOAD" });
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 20, status: "CREATING" }]);

    const res = await advanceSocialPost(1);

    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CREATING", containerId: "publish_123" }),
      })
    );
    expect(res).toEqual({ status: "PUBLISHING", pending: 1 });
  });

  it("status FAILED → target FAILED con fail_reason", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        mediaType: "VIDEO",
        media: [{ url: "https://cdn/v.mp4", type: "video" }],
        targets: [ttTarget({ status: "CREATING", containerId: "publish_123", attempts: 1 })],
      })
    );
    ttMock.fetchPublishStatus.mockResolvedValue({ status: "FAILED", failReason: "url_not_reachable" });
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 20, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("url_not_reachable"),
        }),
      })
    );
  });

  it("post sin video (solo imagen) → target FAILED con mensaje claro", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({
        mediaType: "IMAGE",
        media: [{ url: "https://cdn/x.png", type: "image" }],
        targets: [ttTarget()],
      })
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 20, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(ttMock.initVideoPost).not.toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("video"),
        }),
      })
    );
  });
});

describe("publishSocialPost", () => {
  it("pasa el post a PUBLISHING y avanza", async () => {
    mockDb.socialPost.findUnique
      .mockResolvedValueOnce({ id: 5, status: "SCHEDULED" })
      .mockResolvedValueOnce(post({ id: 5, targets: [] }));
    mockDb.socialPost.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([]);

    await publishSocialPost(5);

    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: { status: "PUBLISHING" } })
    );
  });

  it("no hace nada si el post no está en SCHEDULED/PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 6, status: "DRAFT" });
    expect(await publishSocialPost(6)).toEqual({ status: "DRAFT", pending: 0 });
    expect(mockDb.socialPost.update).not.toHaveBeenCalled(); // guard cortó antes del update
  });

  it("post inexistente → missing sin tocar la DB", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null);
    expect(await publishSocialPost(7)).toEqual({ status: "missing", pending: 0 });
    expect(mockDb.socialPost.update).not.toHaveBeenCalled();
  });

  it("post ya en PUBLISHING → re-marca PUBLISHING y avanza", async () => {
    mockDb.socialPost.findUnique
      .mockResolvedValueOnce({ id: 8, status: "PUBLISHING" })
      .mockResolvedValueOnce(post({ id: 8, targets: [] }));
    mockDb.socialPost.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([]);

    await publishSocialPost(8);

    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 8 }, data: { status: "PUBLISHING" } })
    );
  });
});
