import { Decimal } from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// DB-orchestration glue of the DTE import: importDteSaleRow / importDtePurchaseRow.
// Covers the mode matrix (insert-only / insert-or-update / update-only) ×
// (existing / new) × (data different / same) + validation + catch fail-soft.
// db is mocked; the post-import matcher hook is stubbed so it can't interfere.

const {
  mockDb,
  saleFindFirst,
  saleUpdate,
  saleCreate,
  purchaseFindFirst,
  purchaseUpdate,
  purchaseCreate,
  matchMock,
} = vi.hoisted(() => {
  const saleFindFirst = vi.fn();
  const saleUpdate = vi.fn();
  const saleCreate = vi.fn();
  const purchaseFindFirst = vi.fn();
  const purchaseUpdate = vi.fn();
  const purchaseCreate = vi.fn();
  const matchMock = vi.fn();
  const mockDb = {
    dTESaleDetail: {
      findFirst: (...a: unknown[]) => saleFindFirst(...a),
      update: (...a: unknown[]) => saleUpdate(...a),
      create: (...a: unknown[]) => saleCreate(...a),
    },
    dTEPurchaseDetail: {
      findFirst: (...a: unknown[]) => purchaseFindFirst(...a),
      update: (...a: unknown[]) => purchaseUpdate(...a),
      create: (...a: unknown[]) => purchaseCreate(...a),
    },
  };
  return {
    mockDb,
    saleFindFirst,
    saleUpdate,
    saleCreate,
    purchaseFindFirst,
    purchaseUpdate,
    purchaseCreate,
    matchMock,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../dte-expense-matcher.ts", () => ({
  tryMatchDTEPurchaseToExpense: (...a: unknown[]) => matchMock(...a),
}));

const { importDteSaleRow, importDtePurchaseRow, buildDteSaleDetail, buildDtePurchaseDetail } =
  await import("../dte-import.ts");

beforeEach(() => {
  saleFindFirst.mockReset();
  saleUpdate.mockReset();
  saleCreate.mockReset();
  purchaseFindFirst.mockReset();
  purchaseUpdate.mockReset();
  purchaseCreate.mockReset();
  matchMock.mockReset();
  matchMock.mockResolvedValue({ status: "NO_MATCH", reason: "stub" });
});

/** Wait for fire-and-forget matcher hook microtasks to settle. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

const SALE_ROW = {
  folio: "100",
  documentType: 41,
  netAmount: "1000",
  ivaAmount: "190",
  totalAmount: "1190",
};

describe("importDteSaleRow", () => {
  it("skips a row with empty folio without hitting the DB", async () => {
    expect(await importDteSaleRow({ folio: "  " })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(saleFindFirst).not.toHaveBeenCalled();
  });

  it("skips a row with missing folio (undefined) without hitting the DB", async () => {
    expect(await importDteSaleRow({})).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(saleFindFirst).not.toHaveBeenCalled();
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it("looks up the existing row by exact (folio, documentType) pair", async () => {
    saleFindFirst.mockResolvedValue(null);
    saleCreate.mockResolvedValue({ id: 1 });
    await importDteSaleRow(SALE_ROW);
    expect(saleFindFirst).toHaveBeenCalledWith({ where: { folio: "100", documentType: 41 } });
  });

  it("creates a new record in insert-or-update mode with the built sale data", async () => {
    saleFindFirst.mockResolvedValue(null);
    saleCreate.mockResolvedValue({ id: 1 });
    expect(await importDteSaleRow(SALE_ROW)).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(saleCreate).toHaveBeenCalledTimes(1);
    const createArg = saleCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.folio).toBe("100");
    expect(createArg.data.documentType).toBe(41);
    expect(String(createArg.data.netAmount)).toBe("1000");
    expect(String(createArg.data.ivaAmount)).toBe("190");
    expect(String(createArg.data.totalAmount)).toBe("1190");
    // Sale create path must NOT trigger the purchase→expense matcher hook.
    expect(matchMock).not.toHaveBeenCalled();
  });

  it("skips a new record in update-only mode (no create)", async () => {
    saleFindFirst.mockResolvedValue(null);
    expect(await importDteSaleRow(SALE_ROW, "update-only")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it("skips an existing record in insert-only mode (no update)", async () => {
    saleFindFirst.mockResolvedValue({ id: 5, folio: "100" });
    expect(await importDteSaleRow(SALE_ROW, "insert-only")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(saleUpdate).not.toHaveBeenCalled();
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it("updates an existing record when data differs, targeting it by id", async () => {
    const same = buildDteSaleDetail(SALE_ROW);
    saleFindFirst.mockResolvedValue({ ...same, id: "sale-5", totalAmount: new Decimal(9999) });
    saleUpdate.mockResolvedValue({ id: "sale-5" });
    expect(await importDteSaleRow(SALE_ROW, "insert-or-update")).toEqual({
      inserted: 0,
      updated: 1,
      skipped: 0,
    });
    expect(saleUpdate).toHaveBeenCalledTimes(1);
    const updateArg = saleUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateArg.where).toEqual({ id: "sale-5" });
    expect(String(updateArg.data.totalAmount)).toBe("1190");
  });

  it("update-only mode updates an existing differing record (does not skip)", async () => {
    const same = buildDteSaleDetail(SALE_ROW);
    saleFindFirst.mockResolvedValue({ ...same, id: "sale-9", totalAmount: new Decimal(1) });
    saleUpdate.mockResolvedValue({ id: "sale-9" });
    expect(await importDteSaleRow(SALE_ROW, "update-only")).toEqual({
      inserted: 0,
      updated: 1,
      skipped: 0,
    });
    expect(saleUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips an existing record when data is identical (no update)", async () => {
    const same = buildDteSaleDetail(SALE_ROW);
    saleFindFirst.mockResolvedValue({ ...same, id: 5 });
    expect(await importDteSaleRow(SALE_ROW, "insert-or-update")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(saleUpdate).not.toHaveBeenCalled();
  });

  it("fail-soft skips when the DB throws", async () => {
    saleFindFirst.mockRejectedValue(new Error("db down"));
    expect(await importDteSaleRow(SALE_ROW)).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(saleCreate).not.toHaveBeenCalled();
  });
});

describe("importDtePurchaseRow", () => {
  const PURCHASE_ROW = {
    providerRUT: "76123456-7",
    folio: "200",
    netAmount: "1000",
    totalAmount: "1190",
  };

  it("skips when providerRUT is missing", async () => {
    expect(await importDtePurchaseRow({ folio: "200" })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseFindFirst).not.toHaveBeenCalled();
  });

  it("skips when providerRUT is whitespace only", async () => {
    expect(await importDtePurchaseRow({ providerRUT: "   ", folio: "200" })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseFindFirst).not.toHaveBeenCalled();
  });

  it("skips when folio is missing", async () => {
    expect(await importDtePurchaseRow({ providerRUT: "76123456-7" })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseFindFirst).not.toHaveBeenCalled();
  });

  it("skips when folio is whitespace only", async () => {
    expect(await importDtePurchaseRow({ providerRUT: "76123456-7", folio: "  " })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseFindFirst).not.toHaveBeenCalled();
  });

  it("looks up the existing row by exact (providerRUT, folio) pair", async () => {
    purchaseFindFirst.mockResolvedValue(null);
    purchaseCreate.mockResolvedValue({ id: "pur-1" });
    await importDtePurchaseRow(PURCHASE_ROW);
    expect(purchaseFindFirst).toHaveBeenCalledWith({
      where: { providerRUT: "76123456-7", folio: "200" },
    });
  });

  it("creates a new purchase record (insert-or-update) and fires the matcher hook with the new id", async () => {
    purchaseFindFirst.mockResolvedValue(null);
    purchaseCreate.mockResolvedValue({ id: "pur-1" });
    expect(await importDtePurchaseRow(PURCHASE_ROW)).toEqual({
      inserted: 1,
      updated: 0,
      skipped: 0,
    });
    expect(purchaseCreate).toHaveBeenCalledTimes(1);
    const createArg = purchaseCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.providerRUT).toBe("76123456-7");
    expect(createArg.data.folio).toBe("200");
    expect(createArg.data.documentType).toBe(33);
    expect(String(createArg.data.netAmount)).toBe("1000");
    expect(String(createArg.data.totalAmount)).toBe("1190");
    await flushMicrotasks();
    expect(matchMock).toHaveBeenCalledTimes(1);
    expect(matchMock).toHaveBeenCalledWith("pur-1");
  });

  it("skips a new purchase in update-only mode (no create, no matcher hook)", async () => {
    purchaseFindFirst.mockResolvedValue(null);
    expect(await importDtePurchaseRow(PURCHASE_ROW, "update-only")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseCreate).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(matchMock).not.toHaveBeenCalled();
  });

  it("skips an existing purchase in insert-only mode (no update, no hook)", async () => {
    purchaseFindFirst.mockResolvedValue({ id: "pur-7" });
    expect(await importDtePurchaseRow(PURCHASE_ROW, "insert-only")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseUpdate).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(matchMock).not.toHaveBeenCalled();
  });

  it("updates an existing differing purchase by id and fires the matcher hook with the existing id", async () => {
    const same = buildDtePurchaseDetail(PURCHASE_ROW);
    purchaseFindFirst.mockResolvedValue({ ...same, id: "pur-42", totalAmount: new Decimal(1) });
    purchaseUpdate.mockResolvedValue({ id: "pur-42" });
    expect(await importDtePurchaseRow(PURCHASE_ROW, "insert-or-update")).toEqual({
      inserted: 0,
      updated: 1,
      skipped: 0,
    });
    expect(purchaseUpdate).toHaveBeenCalledTimes(1);
    const updateArg = purchaseUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateArg.where).toEqual({ id: "pur-42" });
    expect(String(updateArg.data.totalAmount)).toBe("1190");
    await flushMicrotasks();
    expect(matchMock).toHaveBeenCalledWith("pur-42");
  });

  it("skips an existing identical purchase (no update, no hook)", async () => {
    const same = buildDtePurchaseDetail(PURCHASE_ROW);
    purchaseFindFirst.mockResolvedValue({ ...same, id: "pur-99" });
    expect(await importDtePurchaseRow(PURCHASE_ROW, "insert-or-update")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseUpdate).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(matchMock).not.toHaveBeenCalled();
  });

  it("fail-soft skips when the DB throws and never fires the hook", async () => {
    purchaseFindFirst.mockRejectedValue(new Error("db down"));
    expect(await importDtePurchaseRow(PURCHASE_ROW)).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseCreate).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(matchMock).not.toHaveBeenCalled();
  });
});
