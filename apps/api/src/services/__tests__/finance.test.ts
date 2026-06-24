import { Decimal } from "decimal.js";
import { describe, expect, it, vi } from "vitest";

// Mutation-driven tests for the PURE-LOGIC paths in services/finance.ts.
//
// finance.ts is DB-heavy; its pure calc helpers (sign handling, aggregation,
// period bucketing, signed allocation math, variance, totalPages, rule
// normalization) are module-private. We exercise them THROUGH the exported
// async functions by mocking @finanzas/db so every DB read returns a
// controlled fixture and the only thing under test is the in-memory math.
//
// db.$queryRaw / db.$executeRaw are used as TAGGED TEMPLATES in finance.ts
// (db.$queryRaw`...${v}...`). A tagged template just invokes the function with
// (TemplateStringsArray, ...values), so a plain vi.fn() returning the desired
// rows is a faithful mock — we assert on the returned MATH, not on the SQL.
//
// Repo mock rule: also mock @finanzas/db/slices (slices.ts calls
// db.$setOptions at module load). vi.mock factories are hoisted, so all mock
// state lives inside vi.hoisted.

const {
  mockDb,
  mockSettlementFindMany,
  mockCategoryFindMany,
  mockCategoryFindFirst,
  mockCategoryFindUnique,
  mockCategoryCreate,
  mockCategoryUpdate,
  mockCategoryDelete,
  mockTxnGroupBy,
  mockTxnCount,
  mockTxnFindMany,
  mockReleaseFindMany,
  mockWithdrawFindMany,
  mockAllocationFindMany,
  mockRuleFindMany,
  mockRuleFindUnique,
  mockRuleCreate,
  mockRuleUpdate,
  mockCounterpartFindUnique,
  mockProfileFindUnique,
  mockProfileUpdate,
  mockBudgetFindMany,
  mockQbRows,
  mockQueryRaw,
  mockExecuteRaw,
  mockTransaction,
} = vi.hoisted(() => {
  const mockSettlementFindMany = vi.fn();
  const mockCategoryFindMany = vi.fn();
  const mockCategoryFindFirst = vi.fn();
  const mockCategoryFindUnique = vi.fn();
  const mockCategoryCreate = vi.fn();
  const mockCategoryUpdate = vi.fn();
  const mockCategoryDelete = vi.fn();
  const mockTxnGroupBy = vi.fn();
  const mockTxnCount = vi.fn();
  const mockTxnFindMany = vi.fn();
  const mockReleaseFindMany = vi.fn();
  const mockWithdrawFindMany = vi.fn();
  const mockAllocationFindMany = vi.fn();
  const mockRuleFindMany = vi.fn();
  const mockRuleFindUnique = vi.fn();
  const mockRuleCreate = vi.fn();
  const mockRuleUpdate = vi.fn();
  const mockCounterpartFindUnique = vi.fn();
  const mockProfileFindUnique = vi.fn();
  const mockProfileUpdate = vi.fn();
  const mockBudgetFindMany = vi.fn();
  const mockQbRows = vi.fn();
  const mockQueryRaw = vi.fn();
  const mockExecuteRaw = vi.fn();
  const mockTransaction = vi.fn();
  // Minimal Kysely-shaped builder for the compensation-profile $qb join path
  // (getCompensationProfileById). Chained methods return the builder; terminal
  // execute()/executeTakeFirst() resolve from mockQbRows().
  const makeQb = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of [
      "selectFrom",
      "innerJoin",
      "leftJoin",
      "select",
      "where",
      "orderBy",
      "limit",
    ]) {
      builder[method] = chain;
    }
    builder.execute = async () => {
      const rows = mockQbRows();
      return Array.isArray(rows) ? rows : [];
    };
    builder.executeTakeFirst = async () => {
      const rows = mockQbRows();
      return Array.isArray(rows) ? rows[0] : rows;
    };
    return builder;
  };
  const mockDb = {
    settlementTransaction: { findMany: (...a: unknown[]) => mockSettlementFindMany(...a) },
    transactionCategory: {
      findMany: (...a: unknown[]) => mockCategoryFindMany(...a),
      findFirst: (...a: unknown[]) => mockCategoryFindFirst(...a),
      findUnique: (...a: unknown[]) => mockCategoryFindUnique(...a),
      create: (...a: unknown[]) => mockCategoryCreate(...a),
      update: (...a: unknown[]) => mockCategoryUpdate(...a),
      delete: (...a: unknown[]) => mockCategoryDelete(...a),
    },
    financialTransaction: {
      groupBy: (...a: unknown[]) => mockTxnGroupBy(...a),
      count: (...a: unknown[]) => mockTxnCount(...a),
      findMany: (...a: unknown[]) => mockTxnFindMany(...a),
    },
    releaseTransaction: { findMany: (...a: unknown[]) => mockReleaseFindMany(...a) },
    withdrawTransaction: { findMany: (...a: unknown[]) => mockWithdrawFindMany(...a) },
    financialTransactionAllocation: { findMany: (...a: unknown[]) => mockAllocationFindMany(...a) },
    financialAutoCategoryRule: {
      findMany: (...a: unknown[]) => mockRuleFindMany(...a),
      findUnique: (...a: unknown[]) => mockRuleFindUnique(...a),
      create: (...a: unknown[]) => mockRuleCreate(...a),
      update: (...a: unknown[]) => mockRuleUpdate(...a),
    },
    counterpart: { findUnique: (...a: unknown[]) => mockCounterpartFindUnique(...a) },
    compensationProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      update: (...a: unknown[]) => mockProfileUpdate(...a),
    },
    compensationPeriodBudget: { findMany: (...a: unknown[]) => mockBudgetFindMany(...a) },
    get $qb() {
      return makeQb();
    },
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
    $transaction: (...a: unknown[]) => mockTransaction(...a),
    $setOptions: () => mockDb,
  };
  return {
    mockDb,
    mockSettlementFindMany,
    mockCategoryFindMany,
    mockCategoryFindFirst,
    mockCategoryFindUnique,
    mockCategoryCreate,
    mockCategoryUpdate,
    mockCategoryDelete,
    mockTxnGroupBy,
    mockTxnCount,
    mockTxnFindMany,
    mockReleaseFindMany,
    mockWithdrawFindMany,
    mockAllocationFindMany,
    mockRuleFindMany,
    mockRuleFindUnique,
    mockRuleCreate,
    mockRuleUpdate,
    mockCounterpartFindUnique,
    mockProfileFindUnique,
    mockProfileUpdate,
    mockBudgetFindMany,
    mockQbRows,
    mockQueryRaw,
    mockExecuteRaw,
    mockTransaction,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  getFinancialSummaryByCategory,
  listFinancialTransactions,
  listCompensationPeriodLedger,
  reallocateFinancialTransaction,
  listFinancialAutoCategoryRules,
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory,
  createFinancialAutoCategoryRule,
  updateFinancialAutoCategoryRule,
  createCompensationProfile,
  updateCompensationProfile,
  upsertCompensationPeriodBudget,
} = await import("../finance.ts");

const { DomainError } = await import("../../lib/errors.ts");

// Default empties so getNonAccountableCategoryIds + cashback filters are no-ops
// unless a test overrides them.
function resetCommon() {
  mockSettlementFindMany.mockResolvedValue([]);
  mockCategoryFindMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// getFinancialSummaryByCategory
//   - EXPENSE totals use Math.abs(sum); INCOME totals stay raw.
//   - net = totalIncome - totalExpense.
//   - byCategory sorted by total DESC.
//   - null _sum.amount coerces to 0.
//   - count accumulates into totals.count.
// ---------------------------------------------------------------------------
describe("getFinancialSummaryByCategory", () => {
  type GroupRow = {
    categoryId: number | null;
    type: "INCOME" | "EXPENSE";
    _count: { _all: number };
    _sum: { amount: number | null };
  };

  function run(grouped: GroupRow[]) {
    resetCommon();
    // First settlement call = cashback ids (return [] so no NOT filter).
    // getNonAccountableCategoryIds reads transactionCategory.findMany (icon).
    mockCategoryFindMany.mockReset();
    // 1st category call: non-accountable ids. 2nd: category metadata.
    mockCategoryFindMany
      .mockResolvedValueOnce([]) // non-accountable ids
      .mockResolvedValueOnce([]); // category metadata lookup
    mockTxnGroupBy.mockResolvedValue(grouped);
    return getFinancialSummaryByCategory({});
  }

  it("takes absolute value for EXPENSE and keeps INCOME raw; net = income - expense", async () => {
    const res = await run([
      { categoryId: 1, type: "INCOME", _count: { _all: 3 }, _sum: { amount: 1000 } },
      { categoryId: 2, type: "EXPENSE", _count: { _all: 2 }, _sum: { amount: -400 } },
    ]);
    expect(res.totals.income).toBe(1000);
    // kills mutant that drops Math.abs on EXPENSE (would yield -400 → expense -400)
    expect(res.totals.expense).toBe(400);
    // kills mutant flipping `income - expense` to `income + expense`
    expect(res.totals.net).toBe(600);
    expect(res.totals.count).toBe(5);
  });

  it("sorts byCategory by total descending", async () => {
    const res = await run([
      { categoryId: 1, type: "INCOME", _count: { _all: 1 }, _sum: { amount: 50 } },
      { categoryId: 2, type: "INCOME", _count: { _all: 1 }, _sum: { amount: 300 } },
      { categoryId: 3, type: "INCOME", _count: { _all: 1 }, _sum: { amount: 150 } },
    ]);
    // kills mutant swapping b.total - a.total to a.total - b.total
    expect(res.byCategory.map((c) => c.total)).toEqual([300, 150, 50]);
  });

  it("treats null _sum.amount as 0 (empty aggregation)", async () => {
    const res = await run([
      { categoryId: 1, type: "INCOME", _count: { _all: 0 }, _sum: { amount: null } },
    ]);
    expect(res.byCategory[0]?.total).toBe(0);
    expect(res.totals.income).toBe(0);
    expect(res.totals.net).toBe(0);
  });

  it("a zero EXPENSE stays 0 after abs and does not flip net sign", async () => {
    const res = await run([
      { categoryId: 1, type: "INCOME", _count: { _all: 1 }, _sum: { amount: 0 } },
      { categoryId: 2, type: "EXPENSE", _count: { _all: 1 }, _sum: { amount: 0 } },
    ]);
    expect(res.totals.expense).toBe(0);
    expect(res.totals.income).toBe(0);
    expect(res.totals.net).toBe(0);
  });

  it("EXPENSE with a positive raw sum is still abs (boundary: already positive)", async () => {
    const res = await run([
      { categoryId: 1, type: "EXPENSE", _count: { _all: 1 }, _sum: { amount: 250 } },
    ]);
    expect(res.totals.expense).toBe(250);
    // net is income(0) - expense(250)
    expect(res.totals.net).toBe(-250);
  });
});

// ---------------------------------------------------------------------------
// listFinancialTransactions (non-effectivePeriod path)
//   - meta.totalPages = ceil(total / pageSize); page/pageSize defaults.
//   - allocation summary: only amounts > 0 counted; ROLLOVER_IN→in, OUT→out.
//   - hasReallocation = inTotal>0 || outTotal>0.
//   - effectiveAmount with no effectivePeriod = rawAmount (sign preserved).
// ---------------------------------------------------------------------------
describe("listFinancialTransactions", () => {
  type Txn = {
    id: number;
    amount: number;
    sourceId: string | null;
    counterpart: { accounts: { accountNumber: string }[] } | null;
  };
  type Alloc = {
    allocationType: "ROLLOVER_IN" | "ROLLOVER_OUT";
    amount: number;
    period: string;
    transactionId: number;
  };

  function run(opts: {
    total: number;
    transactions: Txn[];
    allocations?: Alloc[];
    page?: number;
    pageSize?: number;
  }) {
    resetCommon();
    mockSettlementFindMany.mockResolvedValue([]); // no cashback source ids
    mockTxnCount.mockResolvedValue(opts.total);
    mockTxnFindMany.mockResolvedValue(opts.transactions);
    mockReleaseFindMany.mockResolvedValue([]);
    mockWithdrawFindMany.mockResolvedValue([]);
    mockSettlementFindMany.mockResolvedValue([]);
    mockAllocationFindMany.mockResolvedValue(opts.allocations ?? []);
    return listFinancialTransactions({ page: opts.page, pageSize: opts.pageSize });
  }

  it("computes totalPages = ceil(total / pageSize)", async () => {
    const res = await run({ total: 101, transactions: [], pageSize: 50 });
    // 101/50 = 2.02 → ceil = 3. kills floor/round mutants.
    expect(res.meta.totalPages).toBe(3);
    expect(res.meta.pageSize).toBe(50);
  });

  it("uses default page=1 / pageSize=50 when omitted", async () => {
    const res = await run({ total: 0, transactions: [] });
    expect(res.meta.page).toBe(1);
    expect(res.meta.pageSize).toBe(50);
    // 0/50 → 0 pages
    expect(res.meta.totalPages).toBe(0);
  });

  it("exact multiple does not over-count pages", async () => {
    const res = await run({ total: 100, transactions: [], pageSize: 50 });
    expect(res.meta.totalPages).toBe(2);
  });

  it("preserves negative amount sign when no effectivePeriod", async () => {
    const res = await run({
      total: 1,
      transactions: [{ id: 1, amount: -500, sourceId: null, counterpart: null }],
    });
    expect(res.data[0]?.amount).toBe(-500);
  });

  it("aggregates ROLLOVER_IN/OUT totals and sets hasReallocation", async () => {
    const res = await run({
      total: 1,
      transactions: [{ id: 7, amount: 1000, sourceId: null, counterpart: null }],
      allocations: [
        { allocationType: "ROLLOVER_IN", amount: 200, period: "2026-02", transactionId: 7 },
        { allocationType: "ROLLOVER_IN", amount: 50, period: "2026-03", transactionId: 7 },
        { allocationType: "ROLLOVER_OUT", amount: 120, period: "2026-01", transactionId: 7 },
      ],
    });
    const row = res.data[0];
    expect(row?.reallocatedInTotal).toBe(250);
    expect(row?.reallocatedOutTotal).toBe(120);
    expect(row?.hasReallocation).toBe(true);
  });

  it("ignores non-positive allocation amounts (boundary: amount <= 0)", async () => {
    const res = await run({
      total: 1,
      transactions: [{ id: 9, amount: 0, sourceId: null, counterpart: null }],
      allocations: [
        { allocationType: "ROLLOVER_IN", amount: 0, period: "2026-02", transactionId: 9 },
        { allocationType: "ROLLOVER_OUT", amount: -5, period: "2026-01", transactionId: 9 },
      ],
    });
    const row = res.data[0];
    // amount<=0 filtered → no summary at all → defaults 0 and no reallocation
    expect(row?.reallocatedInTotal).toBe(0);
    expect(row?.reallocatedOutTotal).toBe(0);
    expect(row?.hasReallocation).toBe(false);
  });

  // effectivePeriod path: effectiveAmount = amountSign * abs(netForPeriod).
  // The net comes from $queryRaw (periodAllocations). Sign is taken from the
  // RAW transaction amount, magnitude from the period net. Also exercises the
  // per-period in/out buckets (allocation.period === effectivePeriod).
  function runEffective(opts: {
    transaction: Txn & { type?: string };
    periodNet: number; // net for the effectivePeriod from allocations query
    allocations?: Alloc[];
    effectivePeriod?: string;
  }) {
    const period = opts.effectivePeriod ?? "2026-02";
    resetCommon();
    mockSettlementFindMany.mockResolvedValue([]);
    mockTxnCount.mockResolvedValue(1);
    mockTxnFindMany.mockResolvedValue([opts.transaction]);
    mockReleaseFindMany.mockResolvedValue([]);
    mockWithdrawFindMany.mockResolvedValue([]);
    mockAllocationFindMany.mockResolvedValue(opts.allocations ?? []);
    // $queryRaw is called twice (Promise.all): periodAllocations, then
    // periodTransactionsWithoutAllocations.
    mockQueryRaw.mockReset();
    mockQueryRaw
      .mockResolvedValueOnce([{ transactionId: opts.transaction.id, netAmount: opts.periodNet }])
      .mockResolvedValueOnce([]);
    return listFinancialTransactions({ effectivePeriod: period });
  }

  it("preserves NEGATIVE sign of raw amount but uses period net magnitude", async () => {
    const res = await runEffective({
      transaction: { id: 1, amount: -1000, sourceId: null, counterpart: null },
      periodNet: 300,
    });
    // amountSign = -1 (raw -1000); magnitude = abs(300) → -300
    expect(res.data[0]?.amount).toBe(-300);
  });

  it("preserves POSITIVE sign of raw amount with period net", async () => {
    const res = await runEffective({
      transaction: { id: 1, amount: 1000, sourceId: null, counterpart: null },
      periodNet: 250,
    });
    expect(res.data[0]?.amount).toBe(250);
  });

  it("takes magnitude of a negative period net but keeps raw sign", async () => {
    const res = await runEffective({
      transaction: { id: 1, amount: 1000, sourceId: null, counterpart: null },
      periodNet: -400,
    });
    // amountSign = +1, abs(-400) = 400 → +400
    expect(res.data[0]?.amount).toBe(400);
  });

  it("buckets allocations matching effectivePeriod into *InEffectivePeriod", async () => {
    const res = await runEffective({
      transaction: { id: 1, amount: 1000, sourceId: null, counterpart: null },
      periodNet: 1000,
      effectivePeriod: "2026-02",
      allocations: [
        { allocationType: "ROLLOVER_IN", amount: 70, period: "2026-02", transactionId: 1 },
        { allocationType: "ROLLOVER_IN", amount: 30, period: "2026-03", transactionId: 1 },
        { allocationType: "ROLLOVER_OUT", amount: 40, period: "2026-02", transactionId: 1 },
        { allocationType: "ROLLOVER_OUT", amount: 10, period: "2026-01", transactionId: 1 },
      ],
    });
    const row = res.data[0];
    // totals across all periods
    expect(row?.reallocatedInTotal).toBe(100);
    expect(row?.reallocatedOutTotal).toBe(50);
    // only the 2026-02 slices land in the effective-period buckets
    expect(row?.reallocatedInEffectivePeriod).toBe(70);
    expect(row?.reallocatedOutEffectivePeriod).toBe(40);
    expect(row?.hasReallocationInEffectivePeriod).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listCompensationPeriodLedger
//   - inclusive month bucketing from..to.
//   - signedAllocationAmount: ROLLOVER_OUT → -abs, else +abs.
//   - variance = budgetAmount - allocated.
//   - missing budget → budgetAmount 0, isLocked false.
//   - rejects from > to.
// ---------------------------------------------------------------------------
describe("listCompensationPeriodLedger", () => {
  type Budget = { baseAmount: number; isLocked: boolean; period: string };
  type Alloc = { allocationType: string; amount: number; period: string };

  function run(from: string, to: string, budgets: Budget[], allocations: Alloc[]) {
    // Migrated to ORM: budgets → compensationPeriodBudget.findMany,
    // allocations → financialTransactionAllocation.findMany (Promise.all).
    mockBudgetFindMany.mockReset();
    mockAllocationFindMany.mockReset();
    mockBudgetFindMany.mockResolvedValue(budgets);
    mockAllocationFindMany.mockResolvedValue(allocations);
    return listCompensationPeriodLedger(1, from, to);
  }

  it("emits one row per month inclusive across a year boundary", async () => {
    const rows = await run("2025-11", "2026-02", [], []);
    expect(rows.map((r) => r.period)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("single-month range yields exactly one row", async () => {
    const rows = await run("2026-03", "2026-03", [], []);
    expect(rows.map((r) => r.period)).toEqual(["2026-03"]);
  });

  it("ROLLOVER_OUT subtracts, others add (signed allocation)", async () => {
    const rows = await run(
      "2026-01",
      "2026-01",
      [{ period: "2026-01", baseAmount: 1000, isLocked: false }],
      [
        { period: "2026-01", allocationType: "ORIGINAL", amount: 800 },
        { period: "2026-01", allocationType: "ROLLOVER_IN", amount: 200 },
        { period: "2026-01", allocationType: "ROLLOVER_OUT", amount: 300 },
      ]
    );
    // 800 + 200 - 300 = 700
    expect(rows[0]?.allocatedAmount).toBe(700);
    // variance = 1000 - 700 = 300 (kills `allocated - budget` mutant)
    expect(rows[0]?.variance).toBe(300);
    expect(rows[0]?.budgetAmount).toBe(1000);
  });

  it("ROLLOVER_OUT uses absolute value of a negative stored amount", async () => {
    const rows = await run(
      "2026-01",
      "2026-01",
      [],
      [{ period: "2026-01", allocationType: "ROLLOVER_OUT", amount: -300 }]
    );
    // signedAllocationAmount('ROLLOVER_OUT', -300) = -abs(-300) = -300
    expect(rows[0]?.allocatedAmount).toBe(-300);
  });

  it("defaults missing budget to 0 and isLocked false; variance reflects negative", async () => {
    const rows = await run(
      "2026-01",
      "2026-01",
      [],
      [{ period: "2026-01", allocationType: "ORIGINAL", amount: 500 }]
    );
    expect(rows[0]?.budgetAmount).toBe(0);
    expect(rows[0]?.isLocked).toBe(false);
    expect(rows[0]?.allocatedAmount).toBe(500);
    expect(rows[0]?.variance).toBe(-500);
  });

  it("carries isLocked from the budget row", async () => {
    const rows = await run(
      "2026-01",
      "2026-01",
      [{ period: "2026-01", baseAmount: 100, isLocked: true }],
      []
    );
    expect(rows[0]?.isLocked).toBe(true);
  });

  it("rejects from > to", async () => {
    await expect(listCompensationPeriodLedger(1, "2026-05", "2026-01")).rejects.toThrow(
      "Rango de periodos inválido"
    );
  });
});

// ---------------------------------------------------------------------------
// reallocateFinancialTransaction — validation boundaries + signed reduce.
//   These are the load-bearing financial guards before any write.
// ---------------------------------------------------------------------------
describe("reallocateFinancialTransaction validation", () => {
  const base = { profileId: 1, fromPeriod: "2026-01", targetPeriod: "2026-02" };

  it("rejects targetPeriod <= fromPeriod (equal)", async () => {
    await expect(
      reallocateFinancialTransaction(1, { ...base, targetPeriod: "2026-01", amount: 10 })
    ).rejects.toMatchObject({ code: "INVALID_TARGET_PERIOD" });
  });

  it("rejects targetPeriod < fromPeriod", async () => {
    await expect(
      reallocateFinancialTransaction(1, {
        profileId: 1,
        fromPeriod: "2026-05",
        targetPeriod: "2026-02",
        amount: 10,
      })
    ).rejects.toMatchObject({ code: "INVALID_TARGET_PERIOD" });
  });

  it("rejects amount <= 0 (boundary zero)", async () => {
    await expect(reallocateFinancialTransaction(1, { ...base, amount: 0 })).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });

  it("rejects negative amount", async () => {
    await expect(reallocateFinancialTransaction(1, { ...base, amount: -1 })).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });

  it("rejects non-finite amount", async () => {
    await expect(
      reallocateFinancialTransaction(1, { ...base, amount: Number.NaN })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });

  it("rejects insufficient available in source period (signed reduce)", async () => {
    // Drive the $transaction callback with a tx stub. availableInFromPeriod =
    // ORIGINAL(1000) + ROLLOVER_OUT(900→-900) = 100. amount 200 > 100 → 409.
    const txStub = {
      compensationProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 1, isActive: true, categoryId: 5, counterpartId: null }),
      },
      financialTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          amount: new Decimal(1000),
          categoryId: 5,
          counterpartId: null,
          date: new Date("2026-01-15T12:00:00Z"),
          type: "EXPENSE",
        }),
      },
      compensationPeriodBudget: { findMany: vi.fn().mockResolvedValue([]) },
      financialTransactionAllocation: {
        findFirst: vi.fn().mockResolvedValue({ id: 99 }),
        findMany: vi.fn().mockResolvedValue([
          { allocationType: "ORIGINAL", amount: new Decimal(1000) },
          { allocationType: "ROLLOVER_OUT", amount: new Decimal(900) },
        ]),
        create: vi.fn().mockResolvedValue({ id: 1000 }),
      },
    };
    mockTransaction.mockImplementation((cb: (tx: typeof txStub) => unknown) => cb(txStub));

    await expect(reallocateFinancialTransaction(1, { ...base, amount: 200 })).rejects.toMatchObject(
      { code: "INSUFFICIENT_AMOUNT_IN_SOURCE_PERIOD" }
    );
  });

  it("allows reallocation when amount equals available (boundary: amount == available)", async () => {
    // available = ORIGINAL(1000) only = 1000; amount 1000 should NOT throw the
    // insufficient guard (the check is `amount > available`, strict).
    const created: Record<string, unknown>[] = [];
    const txStub = {
      compensationProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 1, isActive: true, categoryId: 5, counterpartId: null }),
      },
      financialTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          amount: new Decimal(1000),
          categoryId: 5,
          counterpartId: null,
          date: new Date("2026-01-15T12:00:00Z"),
          type: "EXPENSE",
        }),
      },
      compensationPeriodBudget: { findMany: vi.fn().mockResolvedValue([]) },
      financialTransactionAllocation: {
        findFirst: vi.fn().mockResolvedValue({ id: 99 }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ allocationType: "ORIGINAL", amount: new Decimal(1000) }]),
        create: vi.fn().mockImplementation((args: { data?: Record<string, unknown> }) => {
          const row = { id: created.length + 1, ...args?.data };
          created.push(row);
          return Promise.resolve(row);
        }),
      },
    };
    mockTransaction.mockImplementation((cb: (tx: typeof txStub) => unknown) => cb(txStub));

    const result = await reallocateFinancialTransaction(1, { ...base, amount: 1000 });
    // returns the ROLLOVER_IN allocation for the target period
    expect(result).toMatchObject({ allocationType: "ROLLOVER_IN", period: "2026-02" });
    // ROLLOVER_OUT recorded in fromPeriod with the exact amount
    const out = created.find((r) => r.allocationType === "ROLLOVER_OUT");
    expect(out?.period).toBe("2026-01");
    expect(Number(out?.amount)).toBe(1000);
  });

  it("rejects when source period is locked", async () => {
    const txStub = {
      compensationProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 1, isActive: true, categoryId: 5, counterpartId: null }),
      },
      financialTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          amount: new Decimal(1000),
          categoryId: 5,
          counterpartId: null,
          date: new Date("2026-01-15T12:00:00Z"),
          type: "EXPENSE",
        }),
      },
      compensationPeriodBudget: {
        findMany: vi.fn().mockResolvedValue([{ isLocked: true }]),
      },
      financialTransactionAllocation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
    mockTransaction.mockImplementation((cb: (tx: typeof txStub) => unknown) => cb(txStub));

    await expect(reallocateFinancialTransaction(1, { ...base, amount: 10 })).rejects.toMatchObject({
      code: "LOCKED_PERIOD",
    });
  });

  it("rejects category mismatch between transaction and profile", async () => {
    const txStub = {
      compensationProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 1, isActive: true, categoryId: 5, counterpartId: null }),
      },
      financialTransaction: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          amount: new Decimal(1000),
          categoryId: 99,
          counterpartId: null,
          date: new Date("2026-01-15T12:00:00Z"),
          type: "EXPENSE",
        }),
      },
      compensationPeriodBudget: { findMany: vi.fn() },
      financialTransactionAllocation: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    };
    mockTransaction.mockImplementation((cb: (tx: typeof txStub) => unknown) => cb(txStub));

    await expect(reallocateFinancialTransaction(1, { ...base, amount: 10 })).rejects.toMatchObject({
      code: "PROFILE_CATEGORY_MISMATCH",
    });
  });
});

// ---------------------------------------------------------------------------
// listFinancialAutoCategoryRules → mapFinancialAutoCategoryRule +
// asAmountArray / asStringArray / normalizeMatchAmountOn normalization.
// ---------------------------------------------------------------------------
describe("listFinancialAutoCategoryRules normalization", () => {
  function run(rule: Record<string, unknown>) {
    mockRuleFindMany.mockReset();
    mockRuleFindMany.mockResolvedValue([rule]);
    return listFinancialAutoCategoryRules();
  }

  const baseCategory = { color: "#fff", icon: null, id: 1, name: "Cat" };

  it("coerces amountsExact entries to finite numbers and drops non-finite", async () => {
    const rules = await run({
      amountsExact: [new Decimal(100), "200", null, "not-a-number"],
      category: baseCategory,
      categoryId: 1,
      commentContains: null,
      counterpart: null,
      counterpartId: null,
      descriptionContains: null,
      id: 1,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
    });
    // null → NaN dropped; "not-a-number" → NaN dropped; rest kept
    expect(rules[0]?.amountsExact).toEqual([100, 200]);
  });

  it("normalizes matchAmountOn: only 'gross' stays gross, everything else net", async () => {
    const grossRule = await run({
      amountsExact: [],
      category: baseCategory,
      categoryId: 1,
      commentContains: null,
      counterpart: null,
      counterpartId: null,
      descriptionContains: null,
      id: 1,
      isActive: true,
      matchAmountOn: "gross",
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
    });
    expect(grossRule[0]?.matchAmountOn).toBe("gross");

    const weirdRule = await run({
      amountsExact: [],
      category: baseCategory,
      categoryId: 1,
      commentContains: null,
      counterpart: null,
      counterpartId: null,
      descriptionContains: null,
      id: 1,
      isActive: true,
      matchAmountOn: "GROSS", // wrong case → net
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
    });
    expect(weirdRule[0]?.matchAmountOn).toBe("net");
  });

  it("trims and drops empty paymentMethods strings", async () => {
    const rules = await run({
      amountsExact: [],
      category: baseCategory,
      categoryId: 1,
      commentContains: null,
      counterpart: null,
      counterpartId: null,
      descriptionContains: null,
      id: 1,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: ["  card  ", "", "   ", "cash", 42],
      priority: 0,
      type: "EXPENSE",
    });
    expect(rules[0]?.paymentMethods).toEqual(["card", "cash"]);
  });

  it("converts Decimal min/max to numbers and keeps null", async () => {
    const rules = await run({
      amountsExact: [],
      category: baseCategory,
      categoryId: 1,
      commentContains: null,
      counterpart: null,
      counterpartId: null,
      descriptionContains: null,
      id: 1,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: new Decimal(5000),
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
    });
    expect(rules[0]?.maxAmount).toBe(5000);
    expect(rules[0]?.minAmount).toBeNull();
  });

  it("defaults counterpart string fields to empty when null on the relation", async () => {
    const rules = await run({
      amountsExact: [],
      category: baseCategory,
      categoryId: 1,
      commentContains: null,
      counterpart: { bankAccountHolder: null, id: 7, identificationNumber: null },
      counterpartId: 7,
      descriptionContains: null,
      id: 1,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
    });
    expect(rules[0]?.counterpart).toEqual({
      bankAccountHolder: "",
      id: 7,
      identificationNumber: "",
    });
  });
});

// ===========================================================================
// DomainError branches — mutation-killing assertions.
//
// A recent commit converted ~15 `throw new Error(...)` into
// `throw new DomainError(kind, message)`. Stryker mutates each: flips the
// `kind` literal, empties the `message` string, removes the `throw`.
// To kill ALL three classes of mutant per site we assert that the rejection
// is a real `DomainError` instance AND carries the EXACT `.kind` and exact
// `.message`. `instanceof` kills the throw-removal mutant; `.kind` kills the
// kind-swap mutant; `.message` kills the string-literal mutant.
//
// Helper: assert a thenable rejects with a DomainError matching kind+message.
// We `await` + try/catch (instead of rejects.toMatchObject only) so we can
// run an explicit `instanceof DomainError` check.
// ===========================================================================
async function expectDomainError(promise: Promise<unknown>, kind: string, message: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(DomainError);
  expect((caught as { kind: string }).kind).toBe(kind);
  expect((caught as { message: string }).message).toBe(message);
}

describe("createTransactionCategory DomainError branches", () => {
  it("BAD_REQUEST when the cleaned name is empty", async () => {
    // mergeDuplicateTransactionCategoriesByName() reads transactionCategory.findMany → [].
    mockCategoryFindMany.mockReset();
    mockCategoryFindMany.mockResolvedValue([]);
    await expectDomainError(
      createTransactionCategory({ name: "   " }),
      "BAD_REQUEST",
      "El nombre de la categoría es obligatorio"
    );
  });

  it("CONFLICT when a category with the same normalized name already exists", async () => {
    mockCategoryFindMany.mockReset();
    // 1st findMany: mergeDuplicate (group dedupe) — return [] so no merge.
    // 2nd findMany: findCategoryByNormalizedName — return an existing match.
    mockCategoryFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, name: "Servicios" }]);
    await expectDomainError(
      createTransactionCategory({ name: "servicios" }),
      "CONFLICT",
      "Ya existe una categoría con ese nombre"
    );
  });
});

describe("updateTransactionCategory DomainError branches", () => {
  it("BAD_REQUEST when the cleaned name is empty", async () => {
    mockCategoryFindMany.mockReset();
    mockCategoryFindMany.mockResolvedValue([]);
    await expectDomainError(
      updateTransactionCategory(5, { name: "   " }),
      "BAD_REQUEST",
      "El nombre de la categoría es obligatorio"
    );
  });

  it("CONFLICT when another category (excluding self) has the same name", async () => {
    mockCategoryFindMany.mockReset();
    // mergeDuplicate findMany → []; findCategoryByNormalizedName findMany → a
    // DIFFERENT id (7 ≠ updated id 5) with the same normalized name → conflict.
    mockCategoryFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 7, name: "Servicios" }]);
    await expectDomainError(
      updateTransactionCategory(5, { name: "servicios" }),
      "CONFLICT",
      "Ya existe una categoría con ese nombre"
    );
  });
});

describe("deleteTransactionCategory DomainError branches", () => {
  it("CONFLICT when the category is still used by financial transactions", async () => {
    mockTxnCount.mockReset();
    mockTxnCount.mockResolvedValue(3); // usageCount > 0
    await expectDomainError(
      deleteTransactionCategory(5),
      "CONFLICT",
      "No se puede eliminar: la categoría está en uso por movimientos financieros."
    );
  });
});

describe("createFinancialAutoCategoryRule / ensureCategoryExists DomainError branches", () => {
  it("NOT_FOUND when the referenced category does not exist", async () => {
    mockCategoryFindUnique.mockReset();
    mockCategoryFindUnique.mockResolvedValue(null); // ensureCategoryExists → null
    await expectDomainError(
      createFinancialAutoCategoryRule({ categoryId: 999, name: "R", type: "EXPENSE" }),
      "NOT_FOUND",
      "Categoría no encontrada"
    );
  });
});

describe("updateFinancialAutoCategoryRule DomainError branches", () => {
  it("NOT_FOUND when the rule does not exist", async () => {
    mockRuleFindUnique.mockReset();
    mockRuleFindUnique.mockResolvedValue(null);
    await expectDomainError(
      updateFinancialAutoCategoryRule(123, { name: "X" }),
      "NOT_FOUND",
      "Regla no encontrada"
    );
  });
});

describe("createCompensationProfile DomainError branches", () => {
  it("NOT_FOUND when the category does not exist", async () => {
    mockCategoryFindUnique.mockReset();
    mockCategoryFindUnique.mockResolvedValue(null);
    await expectDomainError(
      createCompensationProfile({ categoryId: 999, name: "P" }),
      "NOT_FOUND",
      "Categoría no encontrada"
    );
  });

  it("NOT_FOUND when the counterpart does not exist", async () => {
    mockCategoryFindUnique.mockReset();
    mockCounterpartFindUnique.mockReset();
    mockCategoryFindUnique.mockResolvedValue({ id: 5 }); // category OK
    mockCounterpartFindUnique.mockResolvedValue(null); // counterpart missing
    await expectDomainError(
      createCompensationProfile({ categoryId: 5, counterpartId: 42, name: "P" }),
      "NOT_FOUND",
      "Contraparte no encontrada"
    );
  });

  it("BAD_REQUEST when the trimmed profile name is empty", async () => {
    mockCategoryFindUnique.mockReset();
    mockCategoryFindUnique.mockResolvedValue({ id: 5 }); // category OK, no counterpart
    await expectDomainError(
      createCompensationProfile({ categoryId: 5, name: "   " }),
      "BAD_REQUEST",
      "El nombre del perfil es obligatorio"
    );
  });
});

describe("updateCompensationProfile DomainError branches", () => {
  it("NOT_FOUND when the category does not exist", async () => {
    mockCategoryFindUnique.mockReset();
    mockCategoryFindUnique.mockResolvedValue(null);
    await expectDomainError(
      updateCompensationProfile(1, { categoryId: 999 }),
      "NOT_FOUND",
      "Categoría no encontrada"
    );
  });

  it("NOT_FOUND when the counterpart does not exist", async () => {
    mockCounterpartFindUnique.mockReset();
    mockCounterpartFindUnique.mockResolvedValue(null);
    await expectDomainError(
      updateCompensationProfile(1, { counterpartId: 42 }),
      "NOT_FOUND",
      "Contraparte no encontrada"
    );
  });

  it("NOT_FOUND when the compensation profile row is missing", async () => {
    // No categoryId / counterpartId in payload → both guards skipped. The
    // existing-profile lookup (ORM findUnique) returns null → NOT_FOUND perfil.
    mockProfileFindUnique.mockReset();
    mockProfileFindUnique.mockResolvedValue(null);
    await expectDomainError(
      updateCompensationProfile(1, { name: "New" }),
      "NOT_FOUND",
      "Perfil de compensación no encontrado"
    );
  });
});

describe("upsertCompensationPeriodBudget DomainError branches", () => {
  it("NOT_FOUND when the compensation profile does not exist", async () => {
    // assertPeriodOrThrow passes for a valid period; profile findUnique → null.
    mockProfileFindUnique.mockReset();
    mockProfileFindUnique.mockResolvedValue(null);
    await expectDomainError(
      upsertCompensationPeriodBudget(1, { baseAmount: 1000, period: "2026-01" }),
      "NOT_FOUND",
      "Perfil de compensación no encontrado"
    );
  });
});

describe("listCompensationPeriodLedger DomainError branch", () => {
  it("BAD_REQUEST when fromPeriod > toPeriod (kind + exact message)", async () => {
    // No $queryRaw needed — the guard throws before the Promise.all queries.
    await expectDomainError(
      listCompensationPeriodLedger(1, "2026-05", "2026-01"),
      "BAD_REQUEST",
      "Rango de periodos inválido"
    );
  });
});
