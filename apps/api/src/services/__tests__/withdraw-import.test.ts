import { beforeEach, describe, expect, it, vi } from "vitest";

// Characterization tests for the withdraw-import service (golden 2026 migration
// out of orpc/csv-upload.ts). Covers row parsing/validation, insert/update
// classification, and the full import pipeline's sync-log lifecycle.

const { mockDb, syncMocks } = vi.hoisted(() => ({
  mockDb: {
    counterpart: { upsert: vi.fn() },
    withdrawTransaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
  },
  syncMocks: {
    createMpSyncLogEntry: vi.fn(),
    finalizeMpSyncLogEntry: vi.fn(),
    insertMpImportChanges: vi.fn(),
  },
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../mercadopago-sync.ts", () => syncMocks);

const { parseWithdrawalRows, previewWithdrawals, importWithdrawals } =
  await import("../withdraw-import.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.withdrawTransaction.findMany.mockResolvedValue([]);
  mockDb.withdrawTransaction.createMany.mockResolvedValue({ count: 0 });
  syncMocks.createMpSyncLogEntry.mockResolvedValue(123n);
});

describe("parseWithdrawalRows", () => {
  it("flags rows missing withdrawId or an invalid dateCreated", () => {
    const { errors, validRows } = parseWithdrawalRows([
      { withdrawId: "", dateCreated: "2026-01-01 10:00:00" },
      { withdrawId: "W1", dateCreated: "not-a-date" },
      { withdrawId: "W2", dateCreated: "2026-01-02 10:00:00" },
    ]);
    expect(validRows).toHaveLength(1);
    expect(validRows[0]!.withdrawId).toBe("W2");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("Fila 1");
    expect(errors[1]).toContain("Fila 2");
  });
});

describe("previewWithdrawals", () => {
  it("classifies rows as insert vs update against existing records", async () => {
    mockDb.withdrawTransaction.findMany.mockResolvedValue([{ withdrawId: "W1" }]);

    const res = await previewWithdrawals({
      data: [
        { withdrawId: "W1", dateCreated: "2026-01-01 10:00:00", amount: "1000" },
        { withdrawId: "W2", dateCreated: "2026-01-02 10:00:00", amount: "2000" },
      ],
      includeInsertRowIndexes: true,
      includeUpdateRows: true,
    });

    expect(res.status).toBe("ok");
    expect(res.toInsert).toBe(1);
    expect(res.toUpdate).toBe(1);
    expect(res.insertRowIndexes).toEqual([1]);
    expect(res.updateRows?.[0]?.key).toBe("W1");
  });
});

describe("importWithdrawals", () => {
  it("inserts new rows and opens+closes the sync log (insert-only)", async () => {
    mockDb.withdrawTransaction.createMany.mockResolvedValue({ count: 2 });

    const res = await importWithdrawals({
      data: [
        { withdrawId: "W1", dateCreated: "2026-01-01 10:00:00", amount: "1000" },
        { withdrawId: "W2", dateCreated: "2026-01-02 10:00:00", amount: "2000" },
      ],
      mode: "insert-only",
      userId: 7,
    });

    expect(res.inserted).toBe(2);
    expect(res.status).toBe("ok");
    expect(syncMocks.createMpSyncLogEntry).toHaveBeenCalledTimes(1);
    expect(syncMocks.finalizeMpSyncLogEntry).toHaveBeenCalledTimes(1);
    const finalizeArgs = syncMocks.finalizeMpSyncLogEntry.mock.calls[0]!;
    expect(finalizeArgs[0]).toBe(123n);
    expect(finalizeArgs[1].status).toBe("SUCCESS");
  });

  it("finalizes the sync log as ERROR and rethrows when a chunk write fails", async () => {
    mockDb.withdrawTransaction.createMany.mockRejectedValue(new Error("boom"));

    const err = await importWithdrawals({
      data: [{ withdrawId: "W1", dateCreated: "2026-01-01 10:00:00", amount: "1000" }],
      mode: "insert-only",
      userId: 7,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    const finalizeArgs = syncMocks.finalizeMpSyncLogEntry.mock.calls[0]!;
    expect(finalizeArgs[1].status).toBe("ERROR");
  });
});
