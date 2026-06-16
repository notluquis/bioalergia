import { beforeEach, describe, expect, it, vi } from "vitest";

// State machine de publicación social. Cubre el dry-run (Fase A, simula en una
// vuelta) y el flujo real del Graph (Fase B: IG container create→poll→publish,
// FB síncrono) con los submódulos graph mockeados.

const { mockDb, igMock, fbMock } = vi.hoisted(() => {
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
  return { mockDb, igMock, fbMock };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../../lib/logger.ts", () => ({ logEvent: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));
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

const { advanceSocialPost, publishSocialPost } = await import("../publish-runner.ts");

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
  delete process.env.SOCIAL_PUBLISH_DRYRUN; // default = dry-run
});

describe("advanceSocialPost — dry-run (Fase A)", () => {
  it("publica todos los targets y cierra el post en PUBLISHED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({ targets: [{ id: 10, accountId: 1, network: "INSTAGRAM", placement: "IG_FEED", status: "PENDING", containerId: null, captionOverride: null, attempts: 0 }] }),
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(res).toEqual({ status: "PUBLISHED", pending: 0 });
    expect(igMock.createImageContainer).not.toHaveBeenCalled(); // dry-run no toca Graph
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PUBLISHED" }) }),
    );
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
    process.env.SOCIAL_PUBLISH_DRYRUN = "false";
  });

  it("IG feed PENDING → crea container y queda CREATING (pendiente)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({ targets: [{ id: 10, accountId: 1, network: "INSTAGRAM", placement: "IG_FEED", status: "PENDING", containerId: null, captionOverride: null, attempts: 0 }] }),
    );
    igMock.createImageContainer.mockResolvedValue("cont_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 10, status: "CREATING" }]);

    const res = await advanceSocialPost(1);

    expect(igMock.createImageContainer).toHaveBeenCalledWith(expect.anything(), "https://cdn/x.png", expect.stringContaining("hola"));
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CREATING", containerId: "cont_1" }) }),
    );
    expect(res).toEqual({ status: "PUBLISHING", pending: 1 });
  });

  it("IG feed CREATING + container FINISHED → publica y queda PUBLISHED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({ targets: [{ id: 10, accountId: 1, network: "INSTAGRAM", placement: "IG_FEED", status: "CREATING", containerId: "cont_1", captionOverride: null, attempts: 1 }] }),
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
      expect.objectContaining({ data: expect.objectContaining({ status: "PUBLISHED", externalId: "media_99", permalink: "https://instagram.com/p/abc" }) }),
    );
    expect(res.status).toBe("PUBLISHED");
  });

  it("IG container IN_PROGRESS → sigue pendiente (no publica)", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({ targets: [{ id: 10, accountId: 1, network: "INSTAGRAM", placement: "IG_FEED", status: "CREATING", containerId: "cont_1", captionOverride: null, attempts: 1 }] }),
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
      post({ targets: [{ id: 11, accountId: 1, network: "FACEBOOK", placement: "FB_FEED", status: "PENDING", containerId: null, captionOverride: null, attempts: 0 }] }),
    );
    fbMock.publishFbPhoto.mockResolvedValue("fbpost_1");
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 11, status: "PUBLISHED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(fbMock.publishFbPhoto).toHaveBeenCalled();
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PUBLISHED", externalId: "fbpost_1" }) }),
    );
  });

  it("cuenta inexistente → target FAILED", async () => {
    const { loadSocialAccount } = await import("../graph/_http.ts");
    vi.mocked(loadSocialAccount).mockResolvedValueOnce(null);
    mockDb.socialPost.findUnique.mockResolvedValue(
      post({ targets: [{ id: 12, accountId: 999, network: "INSTAGRAM", placement: "IG_FEED", status: "PENDING", containerId: null, captionOverride: null, attempts: 0 }] }),
    );
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 12, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    await advanceSocialPost(1);

    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
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
      expect.objectContaining({ where: { id: 5 }, data: { status: "PUBLISHING" } }),
    );
  });

  it("no hace nada si el post no está en SCHEDULED/PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 6, status: "DRAFT" });
    expect(await publishSocialPost(6)).toEqual({ status: "DRAFT", pending: 0 });
  });
});
