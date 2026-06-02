import { Decimal } from "decimal.js";
import { describe, expect, it, vi } from "vitest";

// DB-orchestration glue of the DTE import: importDteSaleRow / importDtePurchaseRow.
// Covers the mode matrix (insert-only / insert-or-update / update-only) ×
// (existing / new) × (data different / same) + validation + catch fail-soft.
// db is mocked; the post-import matcher hook is stubbed so it can't interfere.

const { mockDb, saleFindFirst, saleUpdate, saleCreate, purchaseFindFirst, purchaseUpdate, purchaseCreate } =
  vi.hoisted(() => {
    const saleFindFirst = vi.fn();
    const saleUpdate = vi.fn();
    const saleCreate = vi.fn();
    const purchaseFindFirst = vi.fn();
    const purchaseUpdate = vi.fn();
    const purchaseCreate = vi.fn();
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
    return { mockDb, saleFindFirst, saleUpdate, saleCreate, purchaseFindFirst, purchaseUpdate, purchaseCreate };
  });

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../dte-expense-matcher.ts", () => ({
  tryMatchDTEPurchaseToExpense: vi.fn().mockResolvedValue({ status: "NO_MATCH", reason: "stub" }),
}));

const { importDteSaleRow, importDtePurchaseRow, buildDteSaleDetail } = await import("../dte-import.ts");

const SALE_ROW = { folio: "100", documentType: 41, netAmount: "1000", ivaAmount: "190", totalAmount: "1190" };

describe("importDteSaleRow", () => {
  it("skips a row with empty folio without hitting the DB", async () => {
    expect(await importDteSaleRow({ folio: "  " })).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(saleFindFirst).not.toHaveBeenCalled();
  });

  it("creates a new record in insert-or-update mode", async () => {
    saleFindFirst.mockResolvedValue(null);
    saleCreate.mockResolvedValue({ id: 1 });
    expect(await importDteSaleRow(SALE_ROW)).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(saleCreate).toHaveBeenCalledTimes(1);
  });

  it("skips a new record in update-only mode (no create)", async () => {
    saleFindFirst.mockResolvedValue(null);
    saleCreate.mockClear();
    expect(await importDteSaleRow(SALE_ROW, "update-only")).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(saleCreate).not.toHaveBeenCalled();
  });

  it("skips an existing record in insert-only mode (no update)", async () => {
    saleUpdate.mockClear();
    saleFindFirst.mockResolvedValue({ id: 5, folio: "100" });
    expect(await importDteSaleRow(SALE_ROW, "insert-only")).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(saleUpdate).not.toHaveBeenCalled();
  });

  it("updates an existing record when data differs", async () => {
    const same = buildDteSaleDetail(SALE_ROW);
    saleFindFirst.mockResolvedValue({ ...same, id: 5, totalAmount: new Decimal(9999) });
    saleUpdate.mockResolvedValue({ id: 5 });
    expect(await importDteSaleRow(SALE_ROW, "insert-or-update")).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(saleUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips an existing record when data is identical (no update)", async () => {
    const same = buildDteSaleDetail(SALE_ROW);
    saleUpdate.mockClear();
    saleFindFirst.mockResolvedValue({ ...same, id: 5 });
    expect(await importDteSaleRow(SALE_ROW, "insert-or-update")).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(saleUpdate).not.toHaveBeenCalled();
  });

  it("fail-soft skips when the DB throws", async () => {
    saleFindFirst.mockRejectedValue(new Error("db down"));
    expect(await importDteSaleRow(SALE_ROW)).toEqual({ inserted: 0, updated: 0, skipped: 1 });
  });
});

describe("importDtePurchaseRow", () => {
  const PURCHASE_ROW = { providerRUT: "76123456-7", folio: "200", netAmount: "1000", totalAmount: "1190" };

  it("skips when providerRUT is missing", async () => {
    expect(await importDtePurchaseRow({ folio: "200" })).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(purchaseFindFirst).not.toHaveBeenCalled();
  });

  it("skips when folio is missing", async () => {
    expect(await importDtePurchaseRow({ providerRUT: "76123456-7" })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
  });

  it("creates a new purchase record (insert-or-update)", async () => {
    purchaseFindFirst.mockResolvedValue(null);
    purchaseCreate.mockResolvedValue({ id: "pur-1" });
    expect(await importDtePurchaseRow(PURCHASE_ROW)).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(purchaseCreate).toHaveBeenCalledTimes(1);
  });

  it("skips a new purchase in update-only mode", async () => {
    purchaseFindFirst.mockResolvedValue(null);
    purchaseCreate.mockClear();
    expect(await importDtePurchaseRow(PURCHASE_ROW, "update-only")).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    expect(purchaseCreate).not.toHaveBeenCalled();
  });
});
