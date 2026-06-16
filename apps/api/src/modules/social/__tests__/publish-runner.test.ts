import { beforeEach, describe, expect, it, vi } from "vitest";

// State machine de publicación social (Fase A: dry-run). Cubre el avance de
// targets, el cierre del post (PUBLISHED / FAILED / parcial) y los gates de
// estado. Mockea db + logger; publishTargetToMeta corre en dry-run (default).

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    socialPost: { findUnique: vi.fn(), update: vi.fn() },
    socialPostTarget: { update: vi.fn(), findMany: vi.fn() },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});
vi.mock("../../../lib/logger.ts", () => ({ logEvent: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));

const { advanceSocialPost, publishSocialPost } = await import("../publish-runner.ts");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SOCIAL_PUBLISH_DRYRUN; // default = dry-run
});

describe("advanceSocialPost (dry-run)", () => {
  it("publica todos los targets y cierra el post en PUBLISHED", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({
      id: 1,
      status: "PUBLISHING",
      targets: [
        { id: 10, status: "PENDING", attempts: 0 },
        { id: 11, status: "PENDING", attempts: 0 },
      ],
    });
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([
      { id: 10, status: "PUBLISHED" },
      { id: 11, status: "PUBLISHED" },
    ]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(1);

    expect(res).toEqual({ status: "PUBLISHED", pending: 0 });
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledTimes(2);
    // cada target → PUBLISHED con externalId dry-run
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 }, data: expect.objectContaining({ status: "PUBLISHED" }) }),
    );
    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ status: "PUBLISHED" }) }),
    );
  });

  it("marca el post FAILED si TODOS los targets fallan (publish real apagado)", async () => {
    process.env.SOCIAL_PUBLISH_DRYRUN = "false"; // fuerza el throw del boundary
    mockDb.socialPost.findUnique.mockResolvedValue({
      id: 2,
      status: "PUBLISHING",
      targets: [{ id: 20, status: "PENDING", attempts: 0 }],
    });
    mockDb.socialPostTarget.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([{ id: 20, status: "FAILED" }]);
    mockDb.socialPost.update.mockResolvedValue({});

    const res = await advanceSocialPost(2);

    expect(res.status).toBe("FAILED");
    expect(mockDb.socialPostTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("no avanza si el post no está en PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 3, status: "DRAFT", targets: [] });
    const res = await advanceSocialPost(3);
    expect(res).toEqual({ status: "DRAFT", pending: 0 });
    expect(mockDb.socialPostTarget.update).not.toHaveBeenCalled();
  });

  it("retorna missing si el post no existe", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue(null);
    expect(await advanceSocialPost(99)).toEqual({ status: "missing", pending: 0 });
  });
});

describe("publishSocialPost", () => {
  it("pasa el post a PUBLISHING y avanza", async () => {
    mockDb.socialPost.findUnique
      .mockResolvedValueOnce({ id: 5, status: "SCHEDULED" }) // gate inicial
      .mockResolvedValueOnce({ id: 5, status: "PUBLISHING", targets: [] }); // dentro de advance
    mockDb.socialPost.update.mockResolvedValue({});
    mockDb.socialPostTarget.findMany.mockResolvedValue([]);

    await publishSocialPost(5);

    expect(mockDb.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: { status: "PUBLISHING" } }),
    );
  });

  it("no hace nada si el post no está en SCHEDULED/PUBLISHING", async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ id: 6, status: "DRAFT" });
    const res = await publishSocialPost(6);
    expect(res).toEqual({ status: "DRAFT", pending: 0 });
  });
});
