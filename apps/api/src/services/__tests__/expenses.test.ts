import { Decimal } from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// expenses.ts is mostly DB-glue, but several PURE logic paths live inside the
// exported async functions and are only reachable by driving them with mocked
// rows: the defaultAmount normalization in mapExpenseService (4 branches), the
// Number() coercion + field passthrough in buildExpenseItem, the amountApplied
// reduce summation, the settlement direction/timestamp null-fallbacks, the
// date-bounds + overwrite branching in generateExpensesFromTemplates, the
// groupBy period-expression selection in getExpenseStats, and the amount
// resolution fallback in linkTransaction. We mock @finanzas/db (+ /slices per
// repo rule) and only stub the methods each function actually calls.
//
// Dates: generateExpensesFromTemplates does `new Date(`${month}-01`)` which
// parses as UTC midnight, and we hand it Date bounds at fixed UTC instants, so
// every comparison here is TZ-independent.

const {
  mockDb,
  expenseServiceFindMany,
  expenseServiceFindFirst,
  expenseFindMany,
  expenseFindFirst,
  expenseCreate,
  expenseUpdate,
  expenseTransactionFindMany,
  expenseTransactionUpsert,
  expenseTransactionDelete,
  settlementFindFirst,
  qbExecute,
  qbWhere,
} = vi.hoisted(() => {
  const expenseServiceFindMany = vi.fn();
  const expenseServiceFindFirst = vi.fn();
  const expenseFindMany = vi.fn();
  const expenseFindFirst = vi.fn();
  const expenseCreate = vi.fn();
  const expenseUpdate = vi.fn();
  const expenseTransactionFindMany = vi.fn();
  const expenseTransactionUpsert = vi.fn();
  const expenseTransactionDelete = vi.fn();
  const settlementFindFirst = vi.fn();
  const qbExecute = vi.fn();
  const qbWhere = vi.fn();

  // Chainable $qb stub — every builder method returns the same object,
  // execute() resolves to whatever the test queued. qbWhere records each
  // .where(col, op, val) call so we can assert which stats filters fired.
  const qb = {
    selectFrom: (..._a: unknown[]) => qb,
    select: (..._a: unknown[]) => qb,
    groupBy: (..._a: unknown[]) => qb,
    orderBy: (..._a: unknown[]) => qb,
    where: (...a: unknown[]) => {
      qbWhere(...a);
      return qb;
    },
    execute: (...a: unknown[]) => qbExecute(...a),
  };

  const mockDb = {
    expenseService: {
      findMany: (...a: unknown[]) => expenseServiceFindMany(...a),
      findFirst: (...a: unknown[]) => expenseServiceFindFirst(...a),
    },
    expense: {
      findMany: (...a: unknown[]) => expenseFindMany(...a),
      findFirst: (...a: unknown[]) => expenseFindFirst(...a),
      create: (...a: unknown[]) => expenseCreate(...a),
      update: (...a: unknown[]) => expenseUpdate(...a),
    },
    expenseTransaction: {
      findMany: (...a: unknown[]) => expenseTransactionFindMany(...a),
      upsert: (...a: unknown[]) => expenseTransactionUpsert(...a),
      delete: (...a: unknown[]) => expenseTransactionDelete(...a),
    },
    settlementTransaction: {
      findFirst: (...a: unknown[]) => settlementFindFirst(...a),
    },
    $qb: qb,
  };

  return {
    mockDb,
    expenseServiceFindMany,
    expenseServiceFindFirst,
    expenseFindMany,
    expenseFindFirst,
    expenseCreate,
    expenseUpdate,
    expenseTransactionFindMany,
    expenseTransactionUpsert,
    expenseTransactionDelete,
    settlementFindFirst,
    qbExecute,
    qbWhere,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  listExpenseServices,
  getExpenseService,
  listExpenses,
  getExpense,
  createExpense,
  linkTransaction,
  unlinkTransaction,
  generateExpensesFromTemplates,
  getExpenseStats,
} = await import("../expenses.ts");

// Reset call history + queued one-shot resolutions between tests so counts and
// mockResolvedValueOnce queues never leak across cases.
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ───────────────────────────────────────────────────────────────

function serviceRow(over: Record<string, unknown> = {}) {
  return {
    billingDay: 5,
    category: "rent",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    defaultAmount: 1000,
    detail: "office rent",
    dueDateRule: "EOM",
    endDate: null,
    id: 1,
    isActive: true,
    isFixed: true,
    name: "Rent",
    notes: "n",
    publicId: "svc_1",
    recurrence: "MONTHLY",
    scope: "CLINIC",
    startDate: null,
    tags: ["fixed"],
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...over,
  };
}

function expenseRow(over: Record<string, unknown> = {}) {
  return {
    amountApplied: 0,
    amountExpected: 1500,
    category: "rent",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    detail: "feb rent",
    dueDate: new Date("2026-02-10T00:00:00Z"),
    expenseMonth: "2026-02",
    id: 10,
    name: "Rent Feb",
    notes: "note",
    publicId: "exp_10",
    scope: "CLINIC",
    serviceId: 1,
    source: "MANUAL",
    status: "PENDING",
    tags: ["t"],
    updatedAt: new Date("2026-02-02T00:00:00Z"),
    _count: { transactions: 0 },
    transactions: [],
    ...over,
  };
}

// ─── mapExpenseService: defaultAmount normalization (4 branches) ──────────────

describe("mapExpenseService defaultAmount normalization", () => {
  it("passes through a plain number unchanged", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: 1234.5 })]);
    const [s] = await listExpenseServices();
    expect(s.defaultAmount).toBe(1234.5);
  });

  it("calls .toNumber() on a Decimal-like object", async () => {
    const toNumber = vi.fn(() => 42);
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: { toNumber } })]);
    const [s] = await listExpenseServices();
    expect(s.defaultAmount).toBe(42);
    expect(toNumber).toHaveBeenCalledTimes(1);
  });

  it("uses real Decimal.toNumber (boundary: large value)", async () => {
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({ defaultAmount: new Decimal("99999999.99") }),
    ]);
    const [s] = await listExpenseServices();
    expect(s.defaultAmount).toBe(99999999.99);
  });

  it("falls back to Number() when object has no toNumber method", async () => {
    // valueOf lets Number() coerce; this hits the final ternary branch.
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({ defaultAmount: { valueOf: () => 7 } as unknown as number }),
    ]);
    const [s] = await listExpenseServices();
    expect(s.defaultAmount).toBe(7);
  });

  it("returns null for null defaultAmount (does not coerce to 0)", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: null })]);
    const [s] = await listExpenseServices();
    expect(s.defaultAmount).toBeNull();
  });

  it("treats zero as a real number, not null", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: 0 })]);
    const [s] = await listExpenseServices();
    expect(s.defaultAmount).toBe(0);
  });

  it("preserves every other field on the mapped service", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow()]);
    const [s] = await listExpenseServices();
    expect(s).toMatchObject({
      billingDay: 5,
      category: "rent",
      detail: "office rent",
      dueDateRule: "EOM",
      id: 1,
      isActive: true,
      isFixed: true,
      name: "Rent",
      notes: "n",
      publicId: "svc_1",
      recurrence: "MONTHLY",
      scope: "CLINIC",
      tags: ["fixed"],
    });
  });

  it("getExpenseService returns null when row is missing", async () => {
    expenseServiceFindFirst.mockResolvedValue(null);
    expect(await getExpenseService(999)).toBeNull();
  });

  it("getExpenseService maps a found row", async () => {
    expenseServiceFindFirst.mockResolvedValue(serviceRow({ id: 3, defaultAmount: 50 }));
    const s = await getExpenseService(3);
    expect(s).not.toBeNull();
    expect(s?.id).toBe(3);
    expect(s?.defaultAmount).toBe(50);
  });
});

// ─── listExpenseServices where-builder ────────────────────────────────────────

describe("listExpenseServices filters", () => {
  it("includes isActive:false (does not drop it via falsy check)", async () => {
    expenseServiceFindMany.mockResolvedValue([]);
    await listExpenseServices({ isActive: false });
    expect(expenseServiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: false } })
    );
  });

  it("omits where keys entirely when filter undefined", async () => {
    expenseServiceFindMany.mockResolvedValue([]);
    await listExpenseServices({});
    expect(expenseServiceFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("passes scope through", async () => {
    expenseServiceFindMany.mockResolvedValue([]);
    await listExpenseServices({ scope: "PERSONAL" });
    expect(expenseServiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scope: "PERSONAL" } })
    );
  });
});

// ─── buildExpenseItem + amountApplied reduce (via listExpenses) ───────────────

describe("listExpenses amountApplied summation", () => {
  it("sums to 0 when there are no transactions", async () => {
    expenseFindMany.mockResolvedValue([expenseRow({ transactions: [] })]);
    const [e] = await listExpenses();
    expect(e.amountApplied).toBe(0);
    expect(e.amountExpected).toBe(1500);
  });

  it("sums multiple transaction amounts", async () => {
    expenseFindMany.mockResolvedValue([
      expenseRow({
        transactions: [{ amount: 100 }, { amount: 250 }, { amount: 50 }],
        _count: { transactions: 3 },
      }),
    ]);
    const [e] = await listExpenses();
    expect(e.amountApplied).toBe(400);
    expect(e.transactionCount).toBe(3);
  });

  it("handles negative (refund) amounts in the sum", async () => {
    expenseFindMany.mockResolvedValue([
      expenseRow({ transactions: [{ amount: 300 }, { amount: -100 }] }),
    ]);
    const [e] = await listExpenses();
    expect(e.amountApplied).toBe(200);
  });

  it("coerces Decimal-like tx amounts via Number()", async () => {
    expenseFindMany.mockResolvedValue([
      expenseRow({
        transactions: [{ amount: new Decimal("10.25") }, { amount: new Decimal("0.75") }],
      }),
    ]);
    const [e] = await listExpenses();
    expect(e.amountApplied).toBe(11);
  });

  it("coerces a Decimal amountExpected through Number()", async () => {
    expenseFindMany.mockResolvedValue([expenseRow({ amountExpected: new Decimal("2500.50") })]);
    const [e] = await listExpenses();
    expect(e.amountExpected).toBe(2500.5);
  });

  it("preserves passthrough fields (scope/source/status/tags/dueDate)", async () => {
    const dueDate = new Date("2026-02-10T00:00:00Z");
    expenseFindMany.mockResolvedValue([
      expenseRow({ scope: "PERSONAL", source: "TEMPLATE", status: "PAID", tags: ["x", "y"], dueDate }),
    ]);
    const [e] = await listExpenses();
    expect(e.scope).toBe("PERSONAL");
    expect(e.source).toBe("TEMPLATE");
    expect(e.status).toBe("PAID");
    expect(e.tags).toEqual(["x", "y"]);
    expect(e.dueDate).toBe(dueDate);
  });
});

describe("listExpenses where-builder", () => {
  it("builds an expenseMonth range from both from and to", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ from: "2026-01", to: "2026-03" });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ expenseMonth: { gte: "2026-01", lte: "2026-03" } }),
      })
    );
  });

  it("keeps gte when only from is given (no clobber)", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ from: "2026-01" });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expenseMonth: { gte: "2026-01" } } })
    );
  });

  it("passes serviceId:null through (distinct from undefined)", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ serviceId: null });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { serviceId: null } })
    );
  });

  it("omits serviceId key when undefined", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({});
    const arg = expenseFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect("serviceId" in arg.where).toBe(false);
  });
});

// ─── getExpense settlement mapping (null fallbacks) ───────────────────────────

describe("getExpense", () => {
  it("returns null when expense not found", async () => {
    expenseFindFirst.mockResolvedValue(null);
    expect(await getExpense("missing")).toBeNull();
  });

  it("maps settlement description/direction/timestamp when present", async () => {
    const txDate = new Date("2026-02-05T00:00:00Z");
    expenseFindFirst.mockResolvedValue(
      expenseRow({
        _count: { transactions: 1 },
        transactions: [
          {
            amount: 120,
            transactionId: 77,
            createdAt: new Date("2026-02-01T00:00:00Z"),
          },
        ],
      })
    );
    settlementFindFirst.mockResolvedValue({
      description: "wire",
      transactionDate: txDate,
      transactionType: "DEBIT",
    });
    const e = await getExpense("exp_10");
    expect(e?.amountApplied).toBe(120);
    expect(e?.transactions[0]).toMatchObject({
      amount: 120,
      description: "wire",
      direction: "DEBIT",
      timestamp: txDate,
      transactionId: 77,
    });
  });

  it("falls back to UNKNOWN direction and createdAt timestamp when settlement missing", async () => {
    const created = new Date("2026-02-01T00:00:00Z");
    expenseFindFirst.mockResolvedValue(
      expenseRow({
        _count: { transactions: 1 },
        transactions: [{ amount: 90, transactionId: 5, createdAt: created }],
      })
    );
    settlementFindFirst.mockResolvedValue(null);
    const e = await getExpense("exp_10");
    expect(e?.transactions[0]).toMatchObject({
      description: null,
      direction: "UNKNOWN",
      timestamp: created,
      transactionId: 5,
    });
  });
});

// ─── createExpense ────────────────────────────────────────────────────────────

describe("createExpense", () => {
  it("returns an item with empty transactions and zero applied/count", async () => {
    expenseCreate.mockResolvedValue(expenseRow({ amountExpected: 999 }));
    const e = await createExpense({
      amountExpected: 999,
      expenseMonth: "2026-02",
      name: "X",
      scope: "CLINIC",
    });
    expect(e.amountApplied).toBe(0);
    expect(e.transactionCount).toBe(0);
    expect(e.transactions).toEqual([]);
    expect(e.amountExpected).toBe(999);
  });

  it("defaults source=MANUAL and status=PENDING when omitted", async () => {
    expenseCreate.mockResolvedValue(expenseRow());
    await createExpense({ amountExpected: 1, expenseMonth: "2026-02", name: "X", scope: "CLINIC" });
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["source"]).toBe("MANUAL");
    expect(data["status"]).toBe("PENDING");
  });

  it("wraps amountExpected in a Decimal", async () => {
    expenseCreate.mockResolvedValue(expenseRow());
    await createExpense({
      amountExpected: 12.34,
      expenseMonth: "2026-02",
      name: "X",
      scope: "CLINIC",
    });
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["amountExpected"]).toBeInstanceOf(Decimal);
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(12.34);
  });

  it("converts a dueDate string into a Date, null when absent", async () => {
    expenseCreate.mockResolvedValue(expenseRow());
    await createExpense({
      amountExpected: 1,
      dueDate: "2026-02-15",
      expenseMonth: "2026-02",
      name: "X",
      scope: "CLINIC",
    });
    const d1 = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(d1["dueDate"]).toBeInstanceOf(Date);

    expenseCreate.mockClear();
    expenseCreate.mockResolvedValue(expenseRow());
    await createExpense({ amountExpected: 1, expenseMonth: "2026-02", name: "X", scope: "CLINIC" });
    const d2 = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(d2["dueDate"]).toBeNull();
  });
});

// ─── linkTransaction amount resolution ────────────────────────────────────────

describe("linkTransaction amount resolution", () => {
  it("returns null when expense not found", async () => {
    expenseFindFirst.mockResolvedValue(null);
    expect(await linkTransaction("nope", 1)).toBeNull();
  });

  it("uses the explicit amount and recomputes amountApplied from all txs", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionUpsert.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 200 }, { amount: 50 }]);
    expenseUpdate.mockResolvedValue({});
    const total = await linkTransaction("exp_10", 77, 200);
    expect(total).toBe(250);
    const upsertData = (
      expenseTransactionUpsert.mock.calls[0]?.[0] as { create: { amount: Decimal } }
    ).create.amount;
    expect((upsertData as Decimal).toNumber()).toBe(200);
  });

  it("falls back to the settlement transactionAmount when amount omitted", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    settlementFindFirst.mockResolvedValue({ transactionAmount: 333 });
    expenseTransactionUpsert.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 333 }]);
    expenseUpdate.mockResolvedValue({});
    const total = await linkTransaction("exp_10", 77);
    expect(total).toBe(333);
    const created = (expenseTransactionUpsert.mock.calls[0]?.[0] as { create: { amount: Decimal } })
      .create.amount;
    expect((created as Decimal).toNumber()).toBe(333);
  });

  it("falls back to 0 when amount omitted and settlement missing", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    settlementFindFirst.mockResolvedValue(null);
    expenseTransactionUpsert.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 0 }]);
    expenseUpdate.mockResolvedValue({});
    const total = await linkTransaction("exp_10", 77);
    expect(total).toBe(0);
    const created = (expenseTransactionUpsert.mock.calls[0]?.[0] as { create: { amount: Decimal } })
      .create.amount;
    expect((created as Decimal).toNumber()).toBe(0);
  });

  it("respects an explicit amount of 0 (does NOT fall back to settlement)", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionUpsert.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 0 }]);
    expenseUpdate.mockResolvedValue({});
    await linkTransaction("exp_10", 77, 0);
    expect(settlementFindFirst).not.toHaveBeenCalled();
    const created = (expenseTransactionUpsert.mock.calls[0]?.[0] as { create: { amount: Decimal } })
      .create.amount;
    expect((created as Decimal).toNumber()).toBe(0);
  });
});

describe("unlinkTransaction", () => {
  it("returns null when expense not found", async () => {
    expenseFindFirst.mockResolvedValue(null);
    expect(await unlinkTransaction("nope", 1)).toBeNull();
  });

  it("recomputes and persists amountApplied after delete", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionDelete.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 70 }, { amount: 30 }]);
    expenseUpdate.mockResolvedValue({});
    const total = await unlinkTransaction("exp_10", 77);
    expect(total).toBe(100);
    const updated = (expenseUpdate.mock.calls[0]?.[0] as { data: { amountApplied: Decimal } }).data
      .amountApplied;
    expect((updated as Decimal).toNumber()).toBe(100);
  });
});

// ─── generateExpensesFromTemplates: date bounds + overwrite ───────────────────

describe("generateExpensesFromTemplates", () => {
  const D = (iso: string) => new Date(iso);

  it("creates an expense when no bounds and none exists", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ startDate: null, endDate: null })]);
    expenseFindFirst.mockResolvedValue(null);
    expenseCreate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 1, skipped: 0 });
    expect(expenseCreate).toHaveBeenCalledTimes(1);
  });

  it("skips when monthStart is strictly before startDate", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ startDate: D("2026-04-01T00:00:00Z") })]);
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 0, skipped: 1 });
    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it("does NOT skip when monthStart equals startDate (boundary, inclusive)", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ startDate: D("2026-03-01T00:00:00Z") })]);
    expenseFindFirst.mockResolvedValue(null);
    expenseCreate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 1, skipped: 0 });
  });

  it("skips when monthStart is strictly after endDate", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ endDate: D("2026-02-28T00:00:00Z") })]);
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 0, skipped: 1 });
  });

  it("does NOT skip when monthStart equals endDate (boundary, inclusive)", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ endDate: D("2026-03-01T00:00:00Z") })]);
    expenseFindFirst.mockResolvedValue(null);
    expenseCreate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 1, skipped: 0 });
  });

  it("skips an existing expense when overwrite=false", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow()]);
    expenseFindFirst.mockResolvedValue({ id: 99 });
    const res = await generateExpensesFromTemplates("2026-03", false);
    expect(res).toEqual({ created: 0, skipped: 1 });
    expect(expenseUpdate).not.toHaveBeenCalled();
    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it("updates an existing expense and counts it as created when overwrite=true", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: 800 })]);
    expenseFindFirst.mockResolvedValue({ id: 99 });
    expenseUpdate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03", true);
    expect(res).toEqual({ created: 1, skipped: 0 });
    expect(expenseUpdate).toHaveBeenCalledTimes(1);
    expect(expenseCreate).not.toHaveBeenCalled();
    const data = (expenseUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(800);
    expect(data["source"]).toBe("TEMPLATE");
    expect(data["status"]).toBe("PENDING");
  });

  it("uses 0 as amountExpected when defaultAmount is null (?? fallback)", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: null })]);
    expenseFindFirst.mockResolvedValue(null);
    expenseCreate.mockResolvedValue({});
    await generateExpensesFromTemplates("2026-03");
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(0);
    expect(data["source"]).toBe("TEMPLATE");
  });

  it("accumulates created/skipped across multiple services", async () => {
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({ id: 1, startDate: D("2026-05-01T00:00:00Z") }), // skip (future)
      serviceRow({ id: 2 }), // create
      serviceRow({ id: 3 }), // existing, no overwrite -> skip
    ]);
    expenseFindFirst
      .mockResolvedValueOnce(null) // service 2
      .mockResolvedValueOnce({ id: 50 }); // service 3
    expenseCreate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 1, skipped: 2 });
  });
});

// ─── getExpenseStats: period grouping + coalescing ────────────────────────────

describe("getExpenseStats", () => {
  it("maps rows and coerces counts/totals via Number()", async () => {
    qbExecute.mockResolvedValue([
      {
        period: "2026-02",
        scope: "CLINIC",
        expenseCount: "4",
        totalExpected: "1500.5",
        totalApplied: "1000",
      },
    ]);
    const rows = await getExpenseStats();
    expect(rows).toEqual([
      {
        expenseCount: 4,
        period: "2026-02",
        scope: "CLINIC",
        totalApplied: 1000,
        totalExpected: 1500.5,
      },
    ]);
  });

  it("coalesces null scope to null and null totals to 0", async () => {
    qbExecute.mockResolvedValue([
      { period: "2026", scope: null, expenseCount: 0, totalExpected: null, totalApplied: null },
    ]);
    const rows = await getExpenseStats({ groupBy: "year" });
    expect(rows[0]).toEqual({
      expenseCount: 0,
      period: "2026",
      scope: null,
      totalApplied: 0,
      totalExpected: 0,
    });
  });

  it("returns an empty array when no rows", async () => {
    qbExecute.mockResolvedValue([]);
    expect(await getExpenseStats({ groupBy: "quarter" })).toEqual([]);
  });

  it("adds no where clauses when no filters are given", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats();
    expect(qbWhere).not.toHaveBeenCalled();
  });

  it("adds a >= clause only for `from`", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ from: "2026-01" });
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual([">=", "2026-01"]);
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain("<=");
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain("=");
  });

  it("adds a <= clause only for `to`", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ to: "2026-12" });
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual(["<=", "2026-12"]);
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain(">=");
  });

  it("adds an = clause only for `scope`", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ scope: "CLINIC" });
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual(["=", "CLINIC"]);
  });

  it("adds all three clauses when from+to+scope are given", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ from: "2026-01", to: "2026-12", scope: "PERSONAL" });
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual([">=", "2026-01"]);
    expect(ops).toContainEqual(["<=", "2026-12"]);
    expect(ops).toContainEqual(["=", "PERSONAL"]);
    expect(qbWhere).toHaveBeenCalledTimes(3);
  });
});
