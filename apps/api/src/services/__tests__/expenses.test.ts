import { Decimal } from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DomainError } from "../../lib/errors.ts";

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
  expenseServiceCreate,
  expenseServiceUpdate,
  expenseServiceDelete,
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
  const expenseServiceCreate = vi.fn();
  const expenseServiceUpdate = vi.fn();
  const expenseServiceDelete = vi.fn();
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
      create: (...a: unknown[]) => expenseServiceCreate(...a),
      update: (...a: unknown[]) => expenseServiceUpdate(...a),
      delete: (...a: unknown[]) => expenseServiceDelete(...a),
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
    expenseServiceCreate,
    expenseServiceUpdate,
    expenseServiceDelete,
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
  createExpenseService,
  updateExpenseService,
  deleteExpenseService,
  updateExpenseServiceOrThrow,
  listExpenses,
  getExpense,
  getExpenseOrThrow,
  createExpense,
  updateExpense,
  linkTransaction,
  unlinkTransaction,
  linkTransactionOrThrow,
  unlinkTransactionOrThrow,
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
    expect(expenseServiceFindMany).toHaveBeenCalledWith({
      where: { isActive: false },
      orderBy: { name: "asc" },
    });
  });

  it("omits where keys entirely when filter undefined and orders by name asc", async () => {
    expenseServiceFindMany.mockResolvedValue([]);
    await listExpenseServices({});
    expect(expenseServiceFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: "asc" },
    });
  });

  it("passes scope through", async () => {
    expenseServiceFindMany.mockResolvedValue([]);
    await listExpenseServices({ scope: "PERSONAL" });
    expect(expenseServiceFindMany).toHaveBeenCalledWith({
      where: { scope: "PERSONAL" },
      orderBy: { name: "asc" },
    });
  });

  it("combines isActive and scope into a single where + name-asc order", async () => {
    expenseServiceFindMany.mockResolvedValue([]);
    await listExpenseServices({ isActive: true, scope: "CLINIC" });
    expect(expenseServiceFindMany).toHaveBeenCalledWith({
      where: { isActive: true, scope: "CLINIC" },
      orderBy: { name: "asc" },
    });
  });
});

describe("getExpenseService db-call shape", () => {
  it("looks up by id via findFirst", async () => {
    expenseServiceFindFirst.mockResolvedValue(null);
    await getExpenseService(42);
    expect(expenseServiceFindFirst).toHaveBeenCalledWith({ where: { id: 42 } });
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
      expenseRow({
        scope: "PERSONAL",
        source: "TEMPLATE",
        status: "PAID",
        tags: ["x", "y"],
        dueDate,
      }),
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
        where: { expenseMonth: { gte: "2026-01", lte: "2026-03" } },
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

  it("keeps lte when only to is given (no clobber)", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ to: "2026-09" });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { expenseMonth: { lte: "2026-09" } } })
    );
  });

  it("combines scope and status into the where", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ scope: "CLINIC", status: "PAID" });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { scope: "CLINIC", status: "PAID" } })
    );
  });

  it("passes serviceId:null through (distinct from undefined)", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ serviceId: null });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { serviceId: null } })
    );
  });

  it("passes a numeric serviceId through", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({ serviceId: 7 });
    expect(expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { serviceId: 7 } })
    );
  });

  it("omits serviceId key when undefined", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({});
    const arg = expenseFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect("serviceId" in arg.where).toBe(false);
  });

  it("requests _count + tx amounts and orders by month desc, name asc", async () => {
    expenseFindMany.mockResolvedValue([]);
    await listExpenses({});
    expect(expenseFindMany).toHaveBeenCalledWith({
      where: {},
      include: {
        _count: { select: { transactions: true } },
        transactions: {
          select: { amount: true },
        },
      },
      orderBy: [{ expenseMonth: "desc" }, { name: "asc" }],
    });
  });
});

// ─── getExpense settlement mapping (null fallbacks) ───────────────────────────

describe("getExpense", () => {
  it("returns null when expense not found", async () => {
    expenseFindFirst.mockResolvedValue(null);
    expect(await getExpense("missing")).toBeNull();
  });

  it("looks up the expense by publicId with tx include ordered by createdAt asc", async () => {
    expenseFindFirst.mockResolvedValue(null);
    await getExpense("exp_x");
    expect(expenseFindFirst).toHaveBeenCalledWith({
      where: { publicId: "exp_x" },
      include: {
        _count: { select: { transactions: true } },
        transactions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
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
    expect(e?.transactions[0]).toEqual({
      amount: 120,
      description: "wire",
      direction: "DEBIT",
      timestamp: txDate,
      transactionId: 77,
    });
    // settlement looked up by the tx id with exactly the 3 selected fields
    expect(settlementFindFirst).toHaveBeenCalledWith({
      where: { id: 77 },
      select: {
        description: true,
        transactionDate: true,
        transactionType: true,
      },
    });
    // top-level expense fields flow through buildExpenseItem unchanged
    expect(e).toMatchObject({
      amountExpected: 1500,
      category: "rent",
      detail: "feb rent",
      expenseMonth: "2026-02",
      name: "Rent Feb",
      notes: "note",
      publicId: "exp_10",
      scope: "CLINIC",
      source: "MANUAL",
      status: "PENDING",
      tags: ["t"],
      transactionCount: 1,
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

  it("builds the full data object with all null/[]/default fallbacks", async () => {
    expenseCreate.mockResolvedValue(expenseRow());
    await createExpense({ amountExpected: 5, expenseMonth: "2026-02", name: "X", scope: "CLINIC" });
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["category"]).toBeNull();
    expect(data["detail"]).toBeNull();
    expect(data["notes"]).toBeNull();
    expect(data["serviceId"]).toBeNull();
    expect(data["dueDate"]).toBeNull();
    expect(data["tags"]).toEqual([]);
    expect(data["name"]).toBe("X");
    expect(data["scope"]).toBe("CLINIC");
    expect(data["expenseMonth"]).toBe("2026-02");
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(5);
  });

  it("passes explicit source/status/category/notes/serviceId/tags through (no default override)", async () => {
    expenseCreate.mockResolvedValue(expenseRow());
    await createExpense({
      amountExpected: 1,
      expenseMonth: "2026-02",
      name: "X",
      scope: "PERSONAL",
      source: "TEMPLATE",
      status: "PAID",
      category: "utilities",
      detail: "d",
      notes: "nn",
      serviceId: 9,
      tags: ["q"],
    });
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["source"]).toBe("TEMPLATE");
    expect(data["status"]).toBe("PAID");
    expect(data["category"]).toBe("utilities");
    expect(data["detail"]).toBe("d");
    expect(data["notes"]).toBe("nn");
    expect(data["serviceId"]).toBe(9);
    expect(data["tags"]).toEqual(["q"]);
    expect(data["scope"]).toBe("PERSONAL");
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
    // expense resolved by publicId selecting only id
    expect(expenseFindFirst).toHaveBeenCalledWith({
      where: { publicId: "exp_10" },
      select: { id: true },
    });
    // settlement looked up by id selecting only transactionAmount
    expect(settlementFindFirst).toHaveBeenCalledWith({
      where: { id: 77 },
      select: { transactionAmount: true },
    });
    // recalc reads tx amounts scoped to the expense id
    expect(expenseTransactionFindMany).toHaveBeenCalledWith({
      where: { expenseId: 10 },
      select: { amount: true },
    });
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
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({
        id: 1,
        startDate: null,
        endDate: null,
        defaultAmount: 1000,
        category: "rent",
        detail: "office rent",
        notes: "n",
        scope: "CLINIC",
        tags: ["fixed"],
      }),
    ]);
    expenseFindFirst.mockResolvedValue(null);
    expenseCreate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 1, skipped: 0 });
    expect(expenseCreate).toHaveBeenCalledTimes(1);
    // queries active monthly templates only
    expect(expenseServiceFindMany).toHaveBeenCalledWith({
      where: { isActive: true, recurrence: "MONTHLY" },
    });
    // dedupe lookup scoped to (month, serviceId)
    expect(expenseFindFirst).toHaveBeenCalledWith({
      where: { expenseMonth: "2026-03", serviceId: 1 },
    });
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(1000);
    expect(data["expenseMonth"]).toBe("2026-03");
    expect(data["serviceId"]).toBe(1);
    expect(data["source"]).toBe("TEMPLATE");
    expect(data["status"]).toBe("PENDING");
    expect(data["category"]).toBe("rent");
    expect(data["detail"]).toBe("office rent");
    expect(data["notes"]).toBe("n");
    expect(data["scope"]).toBe("CLINIC");
    expect(data["tags"]).toEqual(["fixed"]);
    // exact field set — kills mutants that add or remove a create field
    expect(Object.keys(data).sort()).toEqual([
      "amountExpected",
      "category",
      "detail",
      "expenseMonth",
      "name",
      "notes",
      "scope",
      "serviceId",
      "source",
      "status",
      "tags",
    ]);
    expect(data["name"]).toBe("Rent");
  });

  it("coalesces null category/detail/notes to null in the create payload", async () => {
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({ id: 1, category: null, detail: null, notes: null, tags: [] }),
    ]);
    expenseFindFirst.mockResolvedValue(null);
    expenseCreate.mockResolvedValue({});
    await generateExpensesFromTemplates("2026-03");
    const data = (expenseCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["category"]).toBeNull();
    expect(data["detail"]).toBeNull();
    expect(data["notes"]).toBeNull();
    expect(data["tags"]).toEqual([]);
  });

  it("skips when monthStart is strictly before startDate", async () => {
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({ startDate: D("2026-04-01T00:00:00Z") }),
    ]);
    const res = await generateExpensesFromTemplates("2026-03");
    expect(res).toEqual({ created: 0, skipped: 1 });
    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it("does NOT skip when monthStart equals startDate (boundary, inclusive)", async () => {
    expenseServiceFindMany.mockResolvedValue([
      serviceRow({ startDate: D("2026-03-01T00:00:00Z") }),
    ]);
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
    const arg = expenseUpdate.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: 99 });
    expect((arg.data["amountExpected"] as Decimal).toNumber()).toBe(800);
    expect(arg.data["source"]).toBe("TEMPLATE");
    expect(arg.data["status"]).toBe("PENDING");
    expect(arg.data["name"]).toBe("Rent");
    expect(arg.data["scope"]).toBe("CLINIC");
    // overwrite update writes exactly these 5 fields (not the full create set)
    expect(Object.keys(arg.data).sort()).toEqual([
      "amountExpected",
      "name",
      "scope",
      "source",
      "status",
    ]);
  });

  it("overwrite=true uses 0 amountExpected when defaultAmount is null (?? fallback)", async () => {
    expenseServiceFindMany.mockResolvedValue([serviceRow({ defaultAmount: null })]);
    expenseFindFirst.mockResolvedValue({ id: 99 });
    expenseUpdate.mockResolvedValue({});
    const res = await generateExpensesFromTemplates("2026-03", true);
    expect(res).toEqual({ created: 1, skipped: 0 });
    const arg = expenseUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect((arg.data["amountExpected"] as Decimal).toNumber()).toBe(0);
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

  it("adds a >= clause only for `from`, keyed on a column sql expr", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ from: "2026-01" });
    expect(qbWhere).toHaveBeenCalledTimes(1);
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual([">=", "2026-01"]);
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain("<=");
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain("=");
    // first arg is the expense_month column sql expression (truthy, object)
    expect(qbWhere.mock.calls[0]?.[0]).toBeTruthy();
    expect(typeof qbWhere.mock.calls[0]?.[0]).toBe("object");
  });

  it("adds a <= clause only for `to`", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ to: "2026-12" });
    expect(qbWhere).toHaveBeenCalledTimes(1);
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual(["<=", "2026-12"]);
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain(">=");
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain("=");
    expect(qbWhere.mock.calls[0]?.[0]).toBeTruthy();
  });

  it("adds an = clause only for `scope`", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ scope: "CLINIC" });
    expect(qbWhere).toHaveBeenCalledTimes(1);
    const ops = qbWhere.mock.calls.map((c) => [c[1], c[2]]);
    expect(ops).toContainEqual(["=", "CLINIC"]);
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain(">=");
    expect(qbWhere.mock.calls.map((c) => c[1])).not.toContain("<=");
    expect(qbWhere.mock.calls[0]?.[0]).toBeTruthy();
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

  it("does NOT use the from value for the to clause (operands not swapped)", async () => {
    qbExecute.mockResolvedValue([]);
    await getExpenseStats({ from: "2026-01", to: "2026-12" });
    // the >= clause carries the from value, the <= clause carries the to value
    const geCall = qbWhere.mock.calls.find((c) => c[1] === ">=");
    const leCall = qbWhere.mock.calls.find((c) => c[1] === "<=");
    expect(geCall?.[2]).toBe("2026-01");
    expect(leCall?.[2]).toBe("2026-12");
  });

  it("executes the built query and returns its mapped rows", async () => {
    qbExecute.mockResolvedValue([
      { period: "2026-02", scope: "CLINIC", expenseCount: 1, totalExpected: 10, totalApplied: 5 },
    ]);
    const rows = await getExpenseStats();
    expect(qbExecute).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });
});

// ─── createExpenseService: defaults + Decimal + Date coercion ─────────────────

describe("createExpenseService", () => {
  it("applies defaults (isActive true, isFixed false, MONTHLY, nulls, []) and maps", async () => {
    expenseServiceCreate.mockResolvedValue(serviceRow());
    const r = await createExpenseService({ name: "Internet", scope: "CLINIC" });
    expect(r.id).toBe(1);
    const data = (expenseServiceCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(data).toEqual({
      billingDay: null,
      category: null,
      defaultAmount: null,
      detail: null,
      dueDateRule: null,
      endDate: null,
      isActive: true,
      isFixed: false,
      name: "Internet",
      notes: null,
      recurrence: "MONTHLY",
      scope: "CLINIC",
      startDate: null,
      tags: [],
    });
  });

  it("wraps defaultAmount in a Decimal and coerces start/end date strings to Date", async () => {
    expenseServiceCreate.mockResolvedValue(serviceRow());
    await createExpenseService({
      name: "Rent",
      scope: "CLINIC",
      defaultAmount: 12345,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      billingDay: 10,
      category: "office",
      detail: "d",
      dueDateRule: "EOM",
      isActive: false,
      isFixed: true,
      notes: "n",
      recurrence: "YEARLY",
      tags: ["a", "b"],
    });
    const data = (expenseServiceCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(data["defaultAmount"]).toBeInstanceOf(Decimal);
    expect((data["defaultAmount"] as Decimal).toNumber()).toBe(12345);
    expect(data["startDate"]).toBeInstanceOf(Date);
    expect(data["endDate"]).toBeInstanceOf(Date);
    expect(data["isActive"]).toBe(false);
    expect(data["isFixed"]).toBe(true);
    expect(data["recurrence"]).toBe("YEARLY");
    expect(data["tags"]).toEqual(["a", "b"]);
    expect(data["billingDay"]).toBe(10);
  });

  it("keeps defaultAmount null when explicitly null (no Decimal)", async () => {
    expenseServiceCreate.mockResolvedValue(serviceRow());
    await createExpenseService({ name: "X", scope: "CLINIC", defaultAmount: null });
    const data = (expenseServiceCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(data["defaultAmount"]).toBeNull();
  });
});

// ─── updateExpenseService: partial spread (only provided keys) ────────────────

describe("updateExpenseService", () => {
  it("targets the row by id and only sends provided keys", async () => {
    expenseServiceUpdate.mockResolvedValue(serviceRow({ id: 8 }));
    await updateExpenseService(8, { name: "New name" });
    const arg = expenseServiceUpdate.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: 8 });
    expect(arg.data).toEqual({ name: "New name" });
    expect("scope" in arg.data).toBe(false);
    expect("defaultAmount" in arg.data).toBe(false);
  });

  it("wraps a provided defaultAmount in Decimal, null stays null", async () => {
    expenseServiceUpdate.mockResolvedValue(serviceRow());
    await updateExpenseService(1, { defaultAmount: 500 });
    let data = (expenseServiceUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect((data["defaultAmount"] as Decimal).toNumber()).toBe(500);

    expenseServiceUpdate.mockClear();
    expenseServiceUpdate.mockResolvedValue(serviceRow());
    await updateExpenseService(1, { defaultAmount: null });
    data = (expenseServiceUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["defaultAmount"]).toBeNull();
  });

  it("coerces start/end date strings to Date and nullifies empty", async () => {
    expenseServiceUpdate.mockResolvedValue(serviceRow());
    await updateExpenseService(1, { startDate: "2026-05-01", endDate: null });
    const data = (expenseServiceUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(data["startDate"]).toBeInstanceOf(Date);
    expect(data["endDate"]).toBeNull();
  });

  it("includes isActive:false (does not drop a falsy provided value)", async () => {
    expenseServiceUpdate.mockResolvedValue(serviceRow());
    await updateExpenseService(1, { isActive: false });
    const data = (expenseServiceUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(data).toEqual({ isActive: false });
  });

  it("forwards every provided field into the update data (full payload)", async () => {
    expenseServiceUpdate.mockResolvedValue(serviceRow({ id: 2 }));
    await updateExpenseService(2, {
      billingDay: 12,
      category: "c",
      defaultAmount: 90,
      detail: "d",
      dueDateRule: "EOM",
      endDate: "2026-12-31",
      isActive: true,
      isFixed: true,
      name: "N",
      notes: "no",
      recurrence: "YEARLY",
      scope: "PERSONAL",
      startDate: "2026-01-01",
      tags: ["z"],
    });
    const arg = expenseServiceUpdate.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: 2 });
    expect(arg.data["billingDay"]).toBe(12);
    expect(arg.data["category"]).toBe("c");
    expect((arg.data["defaultAmount"] as Decimal).toNumber()).toBe(90);
    expect(arg.data["detail"]).toBe("d");
    expect(arg.data["dueDateRule"]).toBe("EOM");
    expect(arg.data["endDate"]).toBeInstanceOf(Date);
    expect(arg.data["isActive"]).toBe(true);
    expect(arg.data["isFixed"]).toBe(true);
    expect(arg.data["name"]).toBe("N");
    expect(arg.data["notes"]).toBe("no");
    expect(arg.data["recurrence"]).toBe("YEARLY");
    expect(arg.data["scope"]).toBe("PERSONAL");
    expect(arg.data["startDate"]).toBeInstanceOf(Date);
    expect(arg.data["tags"]).toEqual(["z"]);
    expect(Object.keys(arg.data).sort()).toEqual([
      "billingDay",
      "category",
      "defaultAmount",
      "detail",
      "dueDateRule",
      "endDate",
      "isActive",
      "isFixed",
      "name",
      "notes",
      "recurrence",
      "scope",
      "startDate",
      "tags",
    ]);
  });
});

describe("deleteExpenseService", () => {
  it("deletes by id", async () => {
    expenseServiceDelete.mockResolvedValue({ id: 4 });
    await deleteExpenseService(4);
    expect(expenseServiceDelete).toHaveBeenCalledWith({ where: { id: 4 } });
  });
});

// ─── updateExpenseServiceOrThrow: NOT_FOUND guard ─────────────────────────────

describe("updateExpenseServiceOrThrow", () => {
  it("throws DomainError NOT_FOUND when the service is missing", async () => {
    expenseServiceFindFirst.mockResolvedValue(null);
    const err = await updateExpenseServiceOrThrow(99, { name: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("NOT_FOUND");
    expect((err as DomainError).message).toBe("ExpenseService not found");
    expect(expenseServiceUpdate).not.toHaveBeenCalled();
  });

  it("updates and returns the mapped service when it exists", async () => {
    expenseServiceFindFirst.mockResolvedValue(serviceRow({ id: 5 }));
    expenseServiceUpdate.mockResolvedValue(serviceRow({ id: 5, name: "Updated" }));
    const r = await updateExpenseServiceOrThrow(5, { name: "Updated" });
    expect(r.name).toBe("Updated");
    expect(expenseServiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } })
    );
  });
});

// ─── getExpenseOrThrow: NOT_FOUND guard ───────────────────────────────────────

describe("getExpenseOrThrow", () => {
  it("throws DomainError NOT_FOUND when the expense is missing", async () => {
    expenseFindFirst.mockResolvedValue(null);
    const err = await getExpenseOrThrow("nope").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("NOT_FOUND");
    expect((err as DomainError).message).toBe("Expense not found");
  });

  it("returns the expense when found", async () => {
    expenseFindFirst.mockResolvedValue(expenseRow({ publicId: "exp_10", transactions: [] }));
    const r = await getExpenseOrThrow("exp_10");
    expect(r.publicId).toBe("exp_10");
  });
});

// ─── updateExpense: partial spread + re-fetch + plain-Error fallback ───────────

describe("updateExpense", () => {
  it("targets by publicId, sends only provided keys, then re-fetches", async () => {
    expenseUpdate.mockResolvedValue({});
    expenseFindFirst.mockResolvedValue(expenseRow({ publicId: "exp_10", name: "Renamed" }));
    const r = await updateExpense("exp_10", { name: "Renamed" });
    const arg = expenseUpdate.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ publicId: "exp_10" });
    expect(arg.data).toEqual({ name: "Renamed" });
    expect("scope" in arg.data).toBe(false);
    expect(r.name).toBe("Renamed");
  });

  it("wraps amountExpected in Decimal and coerces dueDate string to Date", async () => {
    expenseUpdate.mockResolvedValue({});
    expenseFindFirst.mockResolvedValue(expenseRow({ publicId: "exp_10" }));
    await updateExpense("exp_10", { amountExpected: 42, dueDate: "2026-03-01" });
    const data = (expenseUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(42);
    expect(data["dueDate"]).toBeInstanceOf(Date);
  });

  it("nullifies dueDate when an empty string/null is provided", async () => {
    expenseUpdate.mockResolvedValue({});
    expenseFindFirst.mockResolvedValue(expenseRow({ publicId: "exp_10" }));
    await updateExpense("exp_10", { dueDate: null });
    const data = (expenseUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["dueDate"]).toBeNull();
  });

  it("forwards every provided field into the update data (full payload)", async () => {
    expenseUpdate.mockResolvedValue({});
    expenseFindFirst.mockResolvedValue(expenseRow({ publicId: "exp_10" }));
    await updateExpense("exp_10", {
      amountExpected: 7,
      category: "c",
      detail: "d",
      dueDate: "2026-04-01",
      expenseMonth: "2026-04",
      name: "N",
      notes: "no",
      scope: "PERSONAL",
      serviceId: 3,
      source: "TEMPLATE",
      status: "PAID",
      tags: ["z"],
    });
    const data = (expenseUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect((data["amountExpected"] as Decimal).toNumber()).toBe(7);
    expect(data["category"]).toBe("c");
    expect(data["detail"]).toBe("d");
    expect(data["dueDate"]).toBeInstanceOf(Date);
    expect(data["expenseMonth"]).toBe("2026-04");
    expect(data["name"]).toBe("N");
    expect(data["notes"]).toBe("no");
    expect(data["scope"]).toBe("PERSONAL");
    expect(data["serviceId"]).toBe(3);
    expect(data["source"]).toBe("TEMPLATE");
    expect(data["status"]).toBe("PAID");
    expect(data["tags"]).toEqual(["z"]);
    expect(Object.keys(data).sort()).toEqual(
      [
        "amountExpected",
        "category",
        "detail",
        "dueDate",
        "expenseMonth",
        "name",
        "notes",
        "scope",
        "serviceId",
        "status",
        "source",
        "tags",
      ].sort()
    );
  });

  it("re-fetches via findFirst (getExpense) after the update", async () => {
    expenseUpdate.mockResolvedValue({});
    expenseFindFirst.mockResolvedValue(expenseRow({ publicId: "exp_10" }));
    await updateExpense("exp_10", { name: "x" });
    expect(expenseFindFirst).toHaveBeenCalledWith({
      where: { publicId: "exp_10" },
      include: {
        _count: { select: { transactions: true } },
        transactions: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });

  it("throws a plain Error when the row vanishes after update (infra invariant)", async () => {
    expenseUpdate.mockResolvedValue({});
    expenseFindFirst.mockResolvedValue(null);
    const err = await updateExpense("gone", { name: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(DomainError);
    expect((err as Error).message).toBe("Expense gone not found after update");
  });
});

// ─── linkTransactionOrThrow / unlinkTransactionOrThrow: NOT_FOUND guards ───────

describe("linkTransactionOrThrow", () => {
  it("throws DomainError NOT_FOUND when the expense is missing", async () => {
    expenseFindFirst.mockResolvedValue(null);
    const err = await linkTransactionOrThrow("nope", 1, 100).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("NOT_FOUND");
    expect((err as DomainError).message).toBe("Expense not found");
  });

  it("returns the recomputed amountApplied on success", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionUpsert.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 100 }, { amount: 25 }]);
    expenseUpdate.mockResolvedValue({});
    const r = await linkTransactionOrThrow("exp_10", 7, 100);
    expect(r).toBe(125);
  });
});

describe("unlinkTransactionOrThrow", () => {
  it("throws DomainError NOT_FOUND when the expense is missing", async () => {
    expenseFindFirst.mockResolvedValue(null);
    const err = await unlinkTransactionOrThrow("nope", 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("NOT_FOUND");
    expect((err as DomainError).message).toBe("Expense not found");
  });

  it("returns the recomputed amountApplied on success", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionDelete.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 40 }]);
    expenseUpdate.mockResolvedValue({});
    const r = await unlinkTransactionOrThrow("exp_10", 7);
    expect(r).toBe(40);
  });
});

// ─── linkTransaction: upsert keys + persisted amountApplied ────────────────────

describe("linkTransaction db-call shape", () => {
  it("scopes the upsert by the composite expenseId_transactionId key and persists", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionUpsert.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([{ amount: 60 }]);
    expenseUpdate.mockResolvedValue({});
    await linkTransaction("exp_10", 77, 60);
    const upsertArg = expenseTransactionUpsert.mock.calls[0]?.[0] as {
      where: { expenseId_transactionId: { expenseId: number; transactionId: number } };
      create: { expenseId: number; transactionId: number; amount: Decimal };
      update: { amount: Decimal };
    };
    expect(upsertArg.where.expenseId_transactionId).toEqual({ expenseId: 10, transactionId: 77 });
    expect(upsertArg.create.expenseId).toBe(10);
    expect(upsertArg.create.transactionId).toBe(77);
    expect((upsertArg.create.amount as Decimal).toNumber()).toBe(60);
    expect((upsertArg.update.amount as Decimal).toNumber()).toBe(60);
    // upsert payload has exactly create + update + where keys (no stray fields)
    expect(Object.keys(upsertArg).sort()).toEqual(["create", "update", "where"]);
    expect(Object.keys(upsertArg.create).sort()).toEqual(["amount", "expenseId", "transactionId"]);

    const updArg = expenseUpdate.mock.calls[0]?.[0] as {
      where: { id: number };
      data: { amountApplied: Decimal };
    };
    expect(updArg.where).toEqual({ id: 10 });
    expect((updArg.data.amountApplied as Decimal).toNumber()).toBe(60);
    // persisted update carries only amountApplied
    expect(Object.keys(updArg.data)).toEqual(["amountApplied"]);
  });
});

describe("unlinkTransaction db-call shape", () => {
  it("deletes by the composite key before recomputing", async () => {
    expenseFindFirst.mockResolvedValue({ id: 10 });
    expenseTransactionDelete.mockResolvedValue({});
    expenseTransactionFindMany.mockResolvedValue([]);
    expenseUpdate.mockResolvedValue({});
    const total = await unlinkTransaction("exp_10", 77);
    expect(total).toBe(0);
    expect(expenseFindFirst).toHaveBeenCalledWith({
      where: { publicId: "exp_10" },
      select: { id: true },
    });
    const delArg = expenseTransactionDelete.mock.calls[0]?.[0] as {
      where: { expenseId_transactionId: { expenseId: number; transactionId: number } };
    };
    expect(delArg.where.expenseId_transactionId).toEqual({ expenseId: 10, transactionId: 77 });
    expect(expenseTransactionFindMany).toHaveBeenCalledWith({
      where: { expenseId: 10 },
      select: { amount: true },
    });
    const updArg = expenseUpdate.mock.calls[0]?.[0] as {
      where: { id: number };
      data: { amountApplied: Decimal };
    };
    expect(updArg.where).toEqual({ id: 10 });
    expect((updArg.data.amountApplied as Decimal).toNumber()).toBe(0);
  });
});
