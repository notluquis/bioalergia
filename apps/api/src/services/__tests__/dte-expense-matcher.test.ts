import { describe, expect, it, vi } from "vitest";

// dte-expense-matcher orchestrates DB lookups (db.dTEPurchaseDetail,
// db.counterpart, db.expenseService, db.expense) but the financial-critical
// pure logic lives in deriveExpenseMonth (period YYYYMM slice vs documentDate
// fallback) which is exercised through the expenseMonth / publicId of the
// Expense that tryMatchDTEPurchaseToExpense creates. We mock @finanzas/db
// (+ slices per repo rule). Decimal columns are emulated as plain numbers —
// the matcher only passes them through to db.expense.create, never inspects.

const {
  mockDb,
  mockDteFindFirst,
  mockDteUpdate,
  mockDteFindMany,
  mockCounterpartFindFirst,
  mockExpenseServiceFindFirst,
  mockExpenseFindFirst,
  mockExpenseCreate,
} = vi.hoisted(() => {
  const mockDteFindFirst = vi.fn();
  const mockDteUpdate = vi.fn();
  const mockDteFindMany = vi.fn();
  const mockCounterpartFindFirst = vi.fn();
  const mockExpenseServiceFindFirst = vi.fn();
  const mockExpenseFindFirst = vi.fn();
  const mockExpenseCreate = vi.fn();
  const mockDb = {
    dTEPurchaseDetail: {
      findFirst: (...a: unknown[]) => mockDteFindFirst(...a),
      findMany: (...a: unknown[]) => mockDteFindMany(...a),
      update: (...a: unknown[]) => mockDteUpdate(...a),
    },
    counterpart: { findFirst: (...a: unknown[]) => mockCounterpartFindFirst(...a) },
    expenseService: { findFirst: (...a: unknown[]) => mockExpenseServiceFindFirst(...a) },
    expense: {
      findFirst: (...a: unknown[]) => mockExpenseFindFirst(...a),
      create: (...a: unknown[]) => mockExpenseCreate(...a),
    },
  };
  return {
    mockDb,
    mockDteFindFirst,
    mockDteUpdate,
    mockDteFindMany,
    mockCounterpartFindFirst,
    mockExpenseServiceFindFirst,
    mockExpenseFindFirst,
    mockExpenseCreate,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { tryMatchDTEPurchaseToExpense, reconcileUnmatchedDTEs, linkDTEToExpense, unlinkDTE } =
  await import("../dte-expense-matcher.ts");

// ── fixtures ────────────────────────────────────────────────────────────────

interface DteOverrides {
  id?: string;
  providerRUT?: string;
  period?: null | string;
  documentDate?: Date;
  totalAmount?: number;
  folio?: number;
  expenseId?: null | number;
}

function dte(o: DteOverrides = {}) {
  return {
    id: o.id ?? "dte-1234abcd-9999",
    providerRUT: o.providerRUT ?? "76123456-7",
    period: o.period === undefined ? "202403" : o.period,
    documentDate: o.documentDate ?? new Date("2024-03-15T12:00:00Z"),
    totalAmount: o.totalAmount ?? 50000,
    folio: o.folio ?? 88,
    expenseId: o.expenseId === undefined ? null : o.expenseId,
  };
}

function counterpart() {
  return { id: 42, bankAccountHolder: "Proveedor SA", identificationNumber: "76123456-7" };
}

function expenseService() {
  return {
    id: 7,
    counterpartId: 42,
    isActive: true,
    name: "Arriendo",
    category: "OPERACIONES",
    detail: "Mensual",
    scope: "GLOBAL",
  };
}

/** Wire up the full happy path (DTE → counterpart → service → no existing expense → create). */
function wireFullCreatePath() {
  mockDteFindFirst.mockResolvedValue(dte());
  mockCounterpartFindFirst.mockResolvedValue(counterpart());
  mockExpenseServiceFindFirst.mockResolvedValue(expenseService());
  mockExpenseFindFirst.mockResolvedValue(null);
  mockExpenseCreate.mockResolvedValue({ id: 555 });
  mockDteUpdate.mockResolvedValue({});
}

function clearAll() {
  for (const m of [
    mockDteFindFirst,
    mockDteUpdate,
    mockDteFindMany,
    mockCounterpartFindFirst,
    mockExpenseServiceFindFirst,
    mockExpenseFindFirst,
    mockExpenseCreate,
  ]) {
    m.mockReset();
  }
}

// ── tryMatchDTEPurchaseToExpense ─────────────────────────────────────────────

describe("tryMatchDTEPurchaseToExpense", () => {
  it("returns ERROR when the DTE does not exist", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(null);
    const r = await tryMatchDTEPurchaseToExpense("missing");
    expect(r).toEqual({
      dteId: "missing",
      expenseId: null,
      reason: "DTE not found",
      status: "ERROR",
    });
  });

  it("returns ALREADY_LINKED when the DTE already has an expenseId", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte({ expenseId: 321 }));
    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("ALREADY_LINKED");
    expect(r.expenseId).toBe(321);
    expect(r.reason).toBe("DTE already linked");
    // must NOT proceed to counterpart lookup
    expect(mockCounterpartFindFirst).not.toHaveBeenCalled();
  });

  it("treats expenseId 0 as not-linked (falsy) and proceeds", async () => {
    clearAll();
    // expenseId 0 is falsy → should fall through to matching, not ALREADY_LINKED
    mockDteFindFirst.mockResolvedValue(dte({ expenseId: 0 }));
    mockCounterpartFindFirst.mockResolvedValue(null);
    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("NO_MATCH");
    expect(mockCounterpartFindFirst).toHaveBeenCalledOnce();
  });

  it("looks up the counterpart by the DTE providerRUT exactly", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte({ providerRUT: "99887766-5" }));
    mockCounterpartFindFirst.mockResolvedValue(null);
    await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(mockCounterpartFindFirst).toHaveBeenCalledWith({
      where: { identificationNumber: "99887766-5" },
    });
  });

  it("returns NO_MATCH (with the RUT in the reason) when no counterpart exists", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte({ providerRUT: "99887766-5" }));
    mockCounterpartFindFirst.mockResolvedValue(null);
    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("NO_MATCH");
    expect(r.expenseId).toBeNull();
    expect(r.reason).toBe("No Counterpart found for RUT 99887766-5");
    expect(mockExpenseServiceFindFirst).not.toHaveBeenCalled();
  });

  it("queries the ExpenseService by counterpartId AND isActive: true", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte());
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    mockExpenseServiceFindFirst.mockResolvedValue(null);
    await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(mockExpenseServiceFindFirst).toHaveBeenCalledWith({
      where: { counterpartId: 42, isActive: true },
    });
  });

  it("returns NO_MATCH (with holder + id in reason) when no ExpenseService is configured", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte());
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    mockExpenseServiceFindFirst.mockResolvedValue(null);
    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("NO_MATCH");
    expect(r.reason).toBe("No ExpenseService configured for Counterpart Proveedor SA (id=42)");
    expect(mockExpenseFindFirst).not.toHaveBeenCalled();
  });

  it("LINKED_EXISTING: links to a pre-existing Expense for the month without creating one", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte());
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    mockExpenseServiceFindFirst.mockResolvedValue(expenseService());
    mockExpenseFindFirst.mockResolvedValue({ id: 900 });
    mockDteUpdate.mockResolvedValue({});

    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("LINKED_EXISTING");
    expect(r.expenseId).toBe(900);
    expect(r.reason).toBe("Linked to existing Expense 2024-03 for Arriendo");
    expect(mockExpenseCreate).not.toHaveBeenCalled();
    // expense lookup keyed on serviceId + derived expenseMonth
    expect(mockExpenseFindFirst).toHaveBeenCalledWith({
      where: { serviceId: 7, expenseMonth: "2024-03" },
    });
  });

  it("CREATED_EXPENSE: creates a new Expense when none exists for the month", async () => {
    clearAll();
    wireFullCreatePath();
    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("CREATED_EXPENSE");
    expect(r.expenseId).toBe(555);
    expect(r.reason).toBe("Created Expense 2024-03 for Arriendo");
    expect(mockExpenseCreate).toHaveBeenCalledOnce();
  });

  it("populates the created Expense from the ExpenseService template + DTE", async () => {
    clearAll();
    wireFullCreatePath();
    await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    const arg = mockExpenseCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.serviceId).toBe(7);
    expect(arg.data.expenseMonth).toBe("2024-03");
    expect(arg.data.name).toBe("Arriendo");
    expect(arg.data.category).toBe("OPERACIONES");
    expect(arg.data.detail).toBe("Mensual");
    expect(arg.data.scope).toBe("GLOBAL");
    expect(arg.data.source).toBe("TRANSACTION");
    expect(arg.data.status).toBe("PENDING");
    expect(arg.data.tags).toEqual(["auto-dte"]);
    expect(arg.data.amountExpected).toBe(50000);
    expect(arg.data.notes).toBe("Auto-creado desde DTE compra folio 88");
    // publicId uses the FIRST 8 chars of the dteId + expenseMonth
    expect(arg.data.publicId).toBe("dte_dte-1234_2024-03");
  });

  it("falls back category/detail to null when the ExpenseService omits them", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte());
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    mockExpenseServiceFindFirst.mockResolvedValue({
      ...expenseService(),
      category: null,
      detail: null,
    });
    mockExpenseFindFirst.mockResolvedValue(null);
    mockExpenseCreate.mockResolvedValue({ id: 1 });
    mockDteUpdate.mockResolvedValue({});

    await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    const arg = mockExpenseCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.category).toBeNull();
    expect(arg.data.detail).toBeNull();
  });

  it("links the DTE with matchSource AUTO and a matchedAt timestamp", async () => {
    clearAll();
    wireFullCreatePath();
    await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(mockDteUpdate).toHaveBeenCalledOnce();
    const arg = mockDteUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { expenseId: number; matchSource: string; matchedAt: Date };
    };
    expect(arg.where).toEqual({ id: "dte-1234abcd-9999" });
    expect(arg.data.expenseId).toBe(555);
    expect(arg.data.matchSource).toBe("AUTO");
    expect(arg.data.matchedAt).toBeInstanceOf(Date);
  });

  it("is fail-soft: returns ERROR with the thrown message instead of throwing", async () => {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte());
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    mockExpenseServiceFindFirst.mockResolvedValue(expenseService());
    mockExpenseFindFirst.mockResolvedValue(null);
    mockExpenseCreate.mockRejectedValue(new Error("DB exploded"));
    const r = await tryMatchDTEPurchaseToExpense("dte-1234abcd-9999");
    expect(r.status).toBe("ERROR");
    expect(r.reason).toBe("DB exploded");
    expect(r.expenseId).toBeNull();
  });

  it("stringifies non-Error throws in the catch", async () => {
    clearAll();
    mockDteFindFirst.mockRejectedValue("raw string failure");
    const r = await tryMatchDTEPurchaseToExpense("dte-x");
    expect(r.status).toBe("ERROR");
    expect(r.reason).toBe("raw string failure");
  });
});

// ── deriveExpenseMonth (exercised via the created Expense expenseMonth) ───────

describe("deriveExpenseMonth (via expenseMonth of created expense)", () => {
  async function monthFor(d: DteOverrides): Promise<string> {
    clearAll();
    mockDteFindFirst.mockResolvedValue(dte(d));
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    mockExpenseServiceFindFirst.mockResolvedValue(expenseService());
    mockExpenseFindFirst.mockResolvedValue(null);
    mockExpenseCreate.mockResolvedValue({ id: 1 });
    mockDteUpdate.mockResolvedValue({});
    await tryMatchDTEPurchaseToExpense("anything");
    const arg = mockExpenseCreate.mock.calls[0][0] as { data: { expenseMonth: string } };
    return arg.data.expenseMonth;
  }

  it("uses period YYYYMM split into YYYY-MM when period is 6 chars", async () => {
    expect(await monthFor({ period: "202311" })).toBe("2023-11");
  });

  it("preserves the period over the documentDate when both are present", async () => {
    // period says Jan 2020, documentDate says Mar 2024 → period wins
    expect(
      await monthFor({ period: "202001", documentDate: new Date("2024-03-15T12:00:00Z") })
    ).toBe("2020-01");
  });

  it("falls back to documentDate when period is null", async () => {
    expect(await monthFor({ period: null, documentDate: new Date("2025-07-09T12:00:00Z") })).toBe(
      "2025-07"
    );
  });

  it("falls back to documentDate when period length is not exactly 6", async () => {
    // 5 chars → not a valid YYYYMM → use the date instead
    expect(await monthFor({ period: "20240", documentDate: new Date("2022-02-02T12:00:00Z") })).toBe(
      "2022-02"
    );
  });

  it("falls back to documentDate for a 7-char period (boundary above 6)", async () => {
    expect(
      await monthFor({ period: "2024030", documentDate: new Date("2019-12-31T12:00:00Z") })
    ).toBe("2019-12");
  });

  it("falls back to documentDate when period is the empty string", async () => {
    expect(await monthFor({ period: "", documentDate: new Date("2026-01-15T12:00:00Z") })).toBe(
      "2026-01"
    );
  });

  it("zero-pads single-digit months from the documentDate", async () => {
    // March (getMonth()=2 → +1 = 3) must render as "03", not "3"
    expect(await monthFor({ period: null, documentDate: new Date("2024-03-15T12:00:00Z") })).toBe(
      "2024-03"
    );
  });

  it("does not zero-pad two-digit months from the documentDate", async () => {
    // December → "12"
    expect(await monthFor({ period: null, documentDate: new Date("2024-12-01T12:00:00Z") })).toBe(
      "2024-12"
    );
  });
});

// ── reconcileUnmatchedDTEs ───────────────────────────────────────────────────

describe("reconcileUnmatchedDTEs", () => {
  it("defaults to daysBack 90 / limit 500 and queries unmatched DTEs by document date desc", async () => {
    clearAll();
    mockDteFindMany.mockResolvedValue([]);
    await reconcileUnmatchedDTEs();
    expect(mockDteFindMany).toHaveBeenCalledOnce();
    const arg = mockDteFindMany.mock.calls[0][0] as {
      orderBy: { documentDate: string };
      take: number;
      where: { documentDate: { gte: Date }; expenseId: null };
    };
    expect(arg.take).toBe(500);
    expect(arg.orderBy).toEqual({ documentDate: "desc" });
    expect(arg.where.expenseId).toBeNull();
    expect(arg.where.documentDate.gte).toBeInstanceOf(Date);

    // since ≈ now - 90 days. setDate() works in local time, so a DST
    // transition inside the window can shift the wall clock by ±1h; allow for it.
    const since = arg.where.documentDate.gte.getTime();
    const expected = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(since - expected)).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it("honours custom daysBack and limit options", async () => {
    clearAll();
    mockDteFindMany.mockResolvedValue([]);
    await reconcileUnmatchedDTEs({ daysBack: 7, limit: 10 });
    const arg = mockDteFindMany.mock.calls[0][0] as {
      take: number;
      where: { documentDate: { gte: Date } };
    };
    expect(arg.take).toBe(10);
    const since = arg.where.documentDate.gte.getTime();
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(since - expected)).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it("aggregates a per-status summary across all processed DTEs", async () => {
    clearAll();
    // 5 DTEs landing on each distinct status
    mockDteFindMany.mockResolvedValue([
      { id: "linked" },
      { id: "created" },
      { id: "existing" },
      { id: "nomatch" },
      { id: "error" },
    ]);
    mockDteFindFirst.mockImplementation((args: { where: { id: string } }) => {
      const id = args.where.id;
      if (id === "linked") return Promise.resolve(dte({ id, expenseId: 9 })); // ALREADY_LINKED
      if (id === "error") return Promise.resolve(null); // ERROR (not found)
      return Promise.resolve(dte({ id }));
    });
    mockExpenseServiceFindFirst.mockResolvedValue(expenseService());
    // All non-error/non-linked rows get a counterpart → fall through to expense.
    mockCounterpartFindFirst.mockResolvedValue(counterpart());
    // existing → LINKED_EXISTING (expense exists); created → CREATED_EXPENSE (expense null)
    mockExpenseFindFirst.mockImplementation(() => Promise.resolve(null));
    mockExpenseCreate.mockResolvedValue({ id: 1 });
    mockDteUpdate.mockResolvedValue({});

    const { summary, results } = await reconcileUnmatchedDTEs();
    expect(summary.total).toBe(5);
    expect(results).toHaveLength(5);
    // linked → ALREADY_LINKED, error → ERROR, the other 3 → CREATED_EXPENSE
    expect(summary.alreadyLinked).toBe(1);
    expect(summary.error).toBe(1);
    expect(summary.createdExpense).toBe(3);
    expect(summary.linkedExisting).toBe(0);
    expect(summary.noMatch).toBe(0);
  });

  it("counts noMatch and linkedExisting buckets correctly", async () => {
    clearAll();
    mockDteFindMany.mockResolvedValue([{ id: "nomatch" }, { id: "existing" }]);
    mockDteFindFirst.mockImplementation((args: { where: { id: string } }) =>
      Promise.resolve(dte({ id: args.where.id }))
    );
    // Drive by call sequence: first row (nomatch) gets no counterpart → NO_MATCH;
    // second row (existing) gets a counterpart → falls through to an existing expense.
    let cpCall = 0;
    mockCounterpartFindFirst.mockImplementation(() => {
      cpCall += 1;
      return Promise.resolve(cpCall === 1 ? null : counterpart());
    });
    mockExpenseServiceFindFirst.mockResolvedValue(expenseService());
    mockExpenseFindFirst.mockResolvedValue({ id: 77 }); // existing expense
    mockDteUpdate.mockResolvedValue({});

    const { summary } = await reconcileUnmatchedDTEs();
    expect(summary.total).toBe(2);
    expect(summary.noMatch).toBe(1);
    expect(summary.linkedExisting).toBe(1);
  });

  it("returns empty results and zeroed summary when there are no unmatched DTEs", async () => {
    clearAll();
    mockDteFindMany.mockResolvedValue([]);
    const { results, summary } = await reconcileUnmatchedDTEs();
    expect(results).toEqual([]);
    expect(summary).toEqual({
      alreadyLinked: 0,
      createdExpense: 0,
      error: 0,
      linkedExisting: 0,
      noMatch: 0,
      total: 0,
    });
  });
});

// ── linkDTEToExpense ─────────────────────────────────────────────────────────

describe("linkDTEToExpense", () => {
  it("returns ERROR when the target Expense does not exist (no update)", async () => {
    clearAll();
    mockExpenseFindFirst.mockResolvedValue(null);
    const r = await linkDTEToExpense("dte-1", 12);
    expect(r).toEqual({
      dteId: "dte-1",
      expenseId: null,
      reason: "Expense not found",
      status: "ERROR",
    });
    expect(mockDteUpdate).not.toHaveBeenCalled();
  });

  it("links the DTE with matchSource MANUAL when the Expense exists", async () => {
    clearAll();
    mockExpenseFindFirst.mockResolvedValue({ id: 12 });
    mockDteUpdate.mockResolvedValue({});
    const r = await linkDTEToExpense("dte-1", 12);
    expect(r.status).toBe("LINKED_EXISTING");
    expect(r.expenseId).toBe(12);
    expect(r.reason).toBe("Manual link");

    const arg = mockDteUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { expenseId: number; matchSource: string; matchedAt: Date };
    };
    expect(arg.where).toEqual({ id: "dte-1" });
    expect(arg.data.expenseId).toBe(12);
    expect(arg.data.matchSource).toBe("MANUAL");
    expect(arg.data.matchedAt).toBeInstanceOf(Date);
  });

  it("looks up the Expense by the provided id", async () => {
    clearAll();
    mockExpenseFindFirst.mockResolvedValue({ id: 99 });
    mockDteUpdate.mockResolvedValue({});
    await linkDTEToExpense("dte-2", 99);
    expect(mockExpenseFindFirst).toHaveBeenCalledWith({ where: { id: 99 } });
  });
});

// ── unlinkDTE ────────────────────────────────────────────────────────────────

describe("unlinkDTE", () => {
  it("nulls expenseId, matchedAt and matchSource for the DTE", async () => {
    clearAll();
    mockDteUpdate.mockResolvedValue({});
    await unlinkDTE("dte-9");
    expect(mockDteUpdate).toHaveBeenCalledOnce();
    expect(mockDteUpdate).toHaveBeenCalledWith({
      where: { id: "dte-9" },
      data: { expenseId: null, matchedAt: null, matchSource: null },
    });
  });
});
