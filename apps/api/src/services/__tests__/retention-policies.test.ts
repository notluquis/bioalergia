import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    dataRetentionPolicy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listRetentionPolicies, upsertRetentionPolicy, deleteRetentionPolicy } =
  await import("../retention-policies.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.dataRetentionPolicy.findMany.mockResolvedValue([]);
  mockDb.dataRetentionPolicy.findUnique.mockResolvedValue({ table: "audit_logs" });
  mockDb.dataRetentionPolicy.upsert.mockResolvedValue({ table: "audit_logs" });
  mockDb.dataRetentionPolicy.delete.mockResolvedValue({});
});

describe("listRetentionPolicies", () => {
  it("lists ordered by table", async () => {
    await listRetentionPolicies();
    expect(mockDb.dataRetentionPolicy.findMany).toHaveBeenCalledWith({ orderBy: { table: "asc" } });
  });
});

describe("upsertRetentionPolicy", () => {
  it("upserts by table; defaults anonymizeMap to {} and notes to null", async () => {
    await upsertRetentionPolicy({
      table: "audit_logs",
      action: "delete",
      windowDays: 5475,
      dateColumn: "created_at",
      enabled: true,
    });
    const call = mockDb.dataRetentionPolicy.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ table: "audit_logs" });
    expect(call.create.anonymizeMap).toEqual({});
    expect(call.create.notes).toBeNull();
    expect(call.update.action).toBe("delete");
  });
});

describe("deleteRetentionPolicy", () => {
  it("throws NOT_FOUND when the policy does not exist", async () => {
    mockDb.dataRetentionPolicy.findUnique.mockResolvedValue(null);
    await expect(deleteRetentionPolicy("nope")).rejects.toThrow(/no encontrada/);
    expect(mockDb.dataRetentionPolicy.delete).not.toHaveBeenCalled();
  });

  it("deletes when present", async () => {
    const r = await deleteRetentionPolicy("audit_logs");
    expect(r).toEqual({ status: "ok" });
    expect(mockDb.dataRetentionPolicy.delete).toHaveBeenCalledWith({
      where: { table: "audit_logs" },
    });
  });
});
