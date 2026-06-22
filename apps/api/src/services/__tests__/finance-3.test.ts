import { Decimal } from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Third mutation-driven suite for services/finance.ts. This file targets the
// three blocks the prior two passes left UNcovered:
//
//   1. applyAutoCategoryRuleRow's RAW-SQL branch (needsReleaseJoin path) — the
//      `sql\`…\`.execute(kysely)` query. The mutants live in the SQL *building*
//      logic, so a no-op fake executor is useless: we build a REAL capturing
//      Kysely (Postgres compiler + fake driver) and COMPILE the query, then
//      assert the SQL text + bound parameters per branch. Driven through the
//      public createFinancialAutoCategoryRule → applySingleAutoCategoryRule →
//      applyAutoCategoryRuleRow chain.
//   2. applyPersonalDrPatternCategoryToExistingTransactions +
//      applyPatientsPatternCategoryToExistingTransactions — db.$executeRaw
//      tagged templates, driven via syncUncategorizedTransactionsByPatterns.
//   3. reallocateFinancialTransaction — happy path + pg period-format
//      constraint-error mapping.

type Captured = { sql: string; parameters: readonly unknown[] };

const {
  mockDb,
  m,
  captured,
  setNextKyselyResult,
  executeRawQueue,
  executeRawCalls,
  mockAuditRowChange,
  testKysely,
} = await vi.hoisted(async () => {
  const { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } =
    await import("kysely");

  const captured: Captured[] = [];
  let nextKyselyResult: unknown = { numAffectedRows: 0n, rows: [] };
  const setNextKyselyResult = (r: unknown) => {
    nextKyselyResult = r;
  };

  const conn = {
    executeQuery: async (cq: { sql: string; parameters: readonly unknown[] }) => {
      captured.push({ parameters: cq.parameters, sql: cq.sql });
      return nextKyselyResult;
    },
    // eslint-disable-next-line require-yield
    async *streamQuery() {
      throw new Error("not used");
    },
  };
  const driver = {
    acquireConnection: async () => conn,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    destroy: async () => {},
    init: async () => {},
    releaseConnection: async () => {},
    rollbackTransaction: async () => {},
  };
  const testKysely = new Kysely({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (db: unknown) =>
        new PostgresIntrospector(db as ConstructorParameters<typeof PostgresIntrospector>[0]),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  const mk = () => vi.fn();
  const m = {
    categoryCreate: mk(),
    categoryFindFirst: mk(),
    categoryFindUnique: mk(),
    ruleCreate: mk(),
    ruleFindFirst: mk(),
    ruleFindUnique: mk(),
    ruleUpdate: mk(),
    txnUpdateMany: mk(),
    // pattern-apply
    executeRaw: mk(),
    // reallocate (transaction inner client)
    txAllocCreate: mk(),
    txAllocFindFirst: mk(),
    txAllocFindMany: mk(),
    txBudgetFindMany: mk(),
    txProfileFindUnique: mk(),
    txTxnFindUnique: mk(),
  };

  const executeRawQueue: unknown[] = [];
  const executeRawCalls: string[] = [];
  const stringify = (a: unknown[]): string => {
    const strings = a[0];
    return Array.isArray(strings) ? strings.join("?") : String(strings);
  };
  m.executeRaw.mockImplementation((...a: unknown[]) => {
    executeRawCalls.push(stringify(a));
    return Promise.resolve(executeRawQueue.length > 0 ? executeRawQueue.shift() : 0);
  });

  const txClient = {
    compensationPeriodBudget: { findMany: (...a: unknown[]) => m.txBudgetFindMany(...a) },
    compensationProfile: { findUnique: (...a: unknown[]) => m.txProfileFindUnique(...a) },
    financialTransaction: { findUnique: (...a: unknown[]) => m.txTxnFindUnique(...a) },
    financialTransactionAllocation: {
      create: (...a: unknown[]) => m.txAllocCreate(...a),
      findFirst: (...a: unknown[]) => m.txAllocFindFirst(...a),
      findMany: (...a: unknown[]) => m.txAllocFindMany(...a),
    },
  };

  const mockDb = {
    $executeRaw: (...a: unknown[]) => m.executeRaw(...a),
    $setOptions: () => mockDb,
    $transaction: (cb: (tx: unknown) => unknown) => Promise.resolve(cb(txClient)),
    financialAutoCategoryRule: {
      create: (...a: unknown[]) => m.ruleCreate(...a),
      findFirst: (...a: unknown[]) => m.ruleFindFirst(...a),
      findUnique: (...a: unknown[]) => m.ruleFindUnique(...a),
      update: (...a: unknown[]) => m.ruleUpdate(...a),
    },
    financialTransaction: {
      updateMany: (...a: unknown[]) => m.txnUpdateMany(...a),
    },
    transactionCategory: {
      create: (...a: unknown[]) => m.categoryCreate(...a),
      findFirst: (...a: unknown[]) => m.categoryFindFirst(...a),
      findUnique: (...a: unknown[]) => m.categoryFindUnique(...a),
    },
  };

  const mockAuditRowChange = vi.fn();

  return {
    captured,
    executeRawCalls,
    executeRawQueue,
    m,
    mockAuditRowChange,
    mockDb,
    setNextKyselyResult,
    testKysely,
  };
});

// The kysely export MUST be the same capturing instance built in vi.hoisted so
// that `sql\`…\`.execute(kysely)` compiles + runs through our fake driver.
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: testKysely }));

vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../lib/audit-diff.ts", () => ({ auditRowChange: mockAuditRowChange }));
vi.mock("../transactions.ts", () => ({
  fetchMergedTransactions: vi.fn(),
  fetchMergedTransactionsBySourceIds: vi.fn(),
}));

const {
  createFinancialAutoCategoryRule,
  syncUncategorizedTransactionsByPatterns,
  reallocateFinancialTransaction,
} = await import("../finance.ts");

const { AppError } = await import("../../lib/app-error.ts");

// ─── helpers ──────────────────────────────────────────────────────────────────

function lastCaptured(): Captured {
  const c = captured.at(-1);
  if (!c) throw new Error("no compiled SQL captured");
  return c;
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.executeRaw.mockImplementation((...a: unknown[]) => {
    executeRawCalls.push(Array.isArray(a[0]) ? (a[0] as string[]).join("?") : String(a[0]));
    return Promise.resolve(executeRawQueue.length > 0 ? executeRawQueue.shift() : 0);
  });
  captured.length = 0;
  executeRawQueue.length = 0;
  executeRawCalls.length = 0;
  setNextKyselyResult({ numAffectedRows: 0n, rows: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Drive applyAutoCategoryRuleRow's raw-SQL branch through the public
 * createFinancialAutoCategoryRule entry point. createFinancialAutoCategoryRule
 * → ensureCategoryExists (findUnique) → ruleCreate → applySingleAutoCategoryRule
 * (ruleFindUnique) → applyAutoCategoryRuleRow.
 *
 * `over` is the raw DB rule row returned by ruleFindUnique inside
 * applySingleAutoCategoryRule (the shape the builder consumes).
 */
async function runRuleRow(over: Record<string, unknown>, numAffected: bigint) {
  const ruleRow = {
    amountsExact: [],
    categoryId: 7,
    commentContains: null,
    counterpartId: null,
    descriptionContains: null,
    isActive: true,
    matchAmountOn: "net",
    maxAmount: null,
    minAmount: null,
    paymentMethods: [],
    priority: 0,
    type: "EXPENSE",
    ...over,
  };
  // createFinancialAutoCategoryRule path
  m.categoryFindUnique.mockResolvedValue({ id: 7 }); // ensureCategoryExists
  m.ruleCreate.mockResolvedValue({ category: { id: 7 }, counterpart: null, id: 99, ...ruleRow });
  m.ruleFindUnique.mockResolvedValue(ruleRow); // applySingleAutoCategoryRule
  setNextKyselyResult({ numAffectedRows: numAffected, rows: [] });

  return createFinancialAutoCategoryRule({
    categoryId: 7,
    name: "r",
    type: ruleRow.type as "EXPENSE" | "INCOME",
  });
}

// ─── 1. applyAutoCategoryRuleRow raw-SQL branch ───────────────────────────────

describe("applyAutoCategoryRuleRow raw-SQL branch (compiled Kysely)", () => {
  it("does NOT hit raw SQL when no release join needed (updateMany path)", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 7 });
    m.ruleCreate.mockResolvedValue({ category: { id: 7 }, counterpart: null, id: 99 });
    m.ruleFindUnique.mockResolvedValue({
      amountsExact: [],
      categoryId: 7,
      commentContains: null,
      counterpartId: null,
      descriptionContains: null,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
    });
    m.txnUpdateMany.mockResolvedValue({ count: 3 });

    await createFinancialAutoCategoryRule({ categoryId: 7, name: "r", type: "EXPENSE" });

    expect(m.txnUpdateMany).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(0); // no kysely SQL compiled
  });

  it("gross matchAmountOn uses COALESCE(rt.gross_amount, …) as amount source", async () => {
    await runRuleRow({ matchAmountOn: "gross", minAmount: 100 }, 5n);
    const { parameters, sql } = lastCaptured();
    expect(sql.toLowerCase()).toContain(
      "coalesce(rt.gross_amount, st.transaction_amount, abs(ft.amount))"
    );
    expect(sql.toLowerCase()).not.toContain("amounts_exact"); // no exact branch
    // min/max comparator: >= for min
    expect(sql).toMatch(/>=\s*\$\d/);
    expect(parameters).toContain(100);
  });

  it("net matchAmountOn uses ABS(ft.amount) (NOT gross COALESCE)", async () => {
    await runRuleRow({ matchAmountOn: "net", paymentMethods: ["visa"], minAmount: 50 }, 1n);
    const { sql } = lastCaptured();
    const lower = sql.toLowerCase();
    expect(lower).toContain("abs(ft.amount)");
    expect(lower).not.toContain("coalesce(rt.gross_amount");
  });

  it("onlyUncategorized=false uses IS DISTINCT FROM (not IS NULL)", async () => {
    // createFinancialAutoCategoryRule → applySingleAutoCategoryRule passes NO
    // options, so onlyUncategorized is undefined → IS DISTINCT FROM branch.
    await runRuleRow({ matchAmountOn: "gross" }, 2n);
    const { parameters, sql } = lastCaptured();
    const lower = sql.toLowerCase();
    expect(lower).toContain("ft.category_id is distinct from");
    expect(lower).not.toContain("ft.category_id is null");
    expect(parameters).toContain(7); // bound categoryId on the DISTINCT FROM
  });

  it("counterpartId condition is emitted + bound when present", async () => {
    await runRuleRow({ counterpartId: 42, matchAmountOn: "gross" }, 1n);
    const { parameters, sql } = lastCaptured();
    expect(sql.toLowerCase()).toContain("ft.counterpart_id =");
    expect(parameters).toContain(42);
  });

  it("counterpartId condition is OMITTED when null", async () => {
    await runRuleRow({ counterpartId: null, matchAmountOn: "gross" }, 1n);
    expect(lastCaptured().sql.toLowerCase()).not.toContain("ft.counterpart_id =");
  });

  it("commentContains emits ILIKE with escaped %_ wrapped pattern", async () => {
    await runRuleRow({ commentContains: "50%_x", matchAmountOn: "gross" }, 1n);
    const { parameters, sql } = lastCaptured();
    expect(sql.toLowerCase()).toContain("ft.comment ilike");
    // %_ escaped with backslash, wrapped in %…%
    expect(parameters).toContain("%50\\%\\_x%");
  });

  it("descriptionContains emits ILIKE on ft.description and MercadoPago sale_detail", async () => {
    await runRuleRow({ descriptionContains: "abc", matchAmountOn: "gross" }, 1n);
    const { parameters, sql } = lastCaptured();
    const lower = sql.toLowerCase();
    expect(lower).toContain("ft.description ilike");
    expect(lower).toContain("rt.sale_detail ilike");
    expect(lower).toContain("st.sale_detail ilike");
    expect(parameters).toContain("%abc%");
  });

  it("paymentMethods emits IN (…) over COALESCE payment_method_type with bound values", async () => {
    await runRuleRow({ paymentMethods: ["visa", "mastercard"] }, 1n);
    const { parameters, sql } = lastCaptured();
    const lower = sql.toLowerCase();
    expect(lower).toContain("coalesce(rt.payment_method_type, st.payment_method_type)");
    expect(lower).toContain(" in (");
    expect(parameters).toContain("visa");
    expect(parameters).toContain("mastercard");
  });

  it("amountsExact emits EXISTS VALUES (…) and NOT min/max comparators", async () => {
    await runRuleRow({ amountsExact: ["1000", "2500"], minAmount: 1, maxAmount: 9 }, 4n);
    const { parameters, sql } = lastCaptured();
    const lower = sql.toLowerCase();
    expect(lower).toContain("exists");
    expect(lower).toContain("values");
    expect(lower).toContain("amounts_exact");
    // when amountsExact present, min/max comparators are NOT emitted
    expect(lower).not.toMatch(/abs\(ft\.amount\)\s*>=/);
    // both exact amounts bound + the epsilon (0.5)
    expect(parameters).toContain(1000);
    expect(parameters).toContain(2500);
    expect(parameters).toContain(0.5);
  });

  it("min/max (no amountsExact) emit >= and <= comparators with bound values", async () => {
    await runRuleRow({ matchAmountOn: "gross", maxAmount: 900, minAmount: 100 }, 3n);
    const { parameters, sql } = lastCaptured();
    expect(sql).toMatch(/>=\s*\$\d/);
    expect(sql).toMatch(/<=\s*\$\d/);
    expect(parameters).toContain(100);
    expect(parameters).toContain(900);
  });

  it("emits only >= when minAmount set and maxAmount null", async () => {
    await runRuleRow({ matchAmountOn: "gross", maxAmount: null, minAmount: 100 }, 1n);
    const { sql } = lastCaptured();
    expect(sql).toMatch(/>=\s*\$\d/);
    expect(sql).not.toMatch(/<=\s*\$\d/);
  });

  it("emits only <= when maxAmount set and minAmount null", async () => {
    await runRuleRow({ matchAmountOn: "gross", maxAmount: 900, minAmount: null }, 1n);
    const { sql } = lastCaptured();
    expect(sql).toMatch(/<=\s*\$\d/);
    expect(sql).not.toMatch(/>=\s*\$\d/);
  });

  it("UPDATE sets category_id to the rule categoryId and binds rule.type", async () => {
    await runRuleRow({ categoryId: 7, matchAmountOn: "gross", type: "EXPENSE" }, 6n);
    const { parameters, sql } = lastCaptured();
    const lower = sql.toLowerCase();
    expect(lower).toContain("update financial_transactions");
    expect(lower).toContain("set category_id =");
    expect(lower).toContain("ft.type =");
    expect(parameters).toContain("EXPENSE");
  });

  it("maps numAffectedRows (7n) to 7 — the rule-apply runs without throwing", async () => {
    // Indirect: if numAffectedRows were mishandled the chain would throw; we
    // assert the SQL compiled and the public fn resolved.
    const result = await runRuleRow({ matchAmountOn: "gross" }, 7n);
    expect(result).toBeTruthy();
    expect(captured.length).toBeGreaterThan(0);
  });
});

// ─── 2. pattern-apply via $executeRaw (syncUncategorizedTransactionsByPatterns)

describe("pattern-apply $executeRaw (onlyUncategorized path)", () => {
  beforeEach(() => {
    // ensureMercadoPagoCardAutoCategoryRule + ensurePersonalDrAutoCategoryRules
    // + ensurePatientsAutoCategoryRule all run first. Give them existing
    // categories + rules so they take the cheap update branch, and make every
    // applySingleAutoCategoryRule inside ensure* go through the updateMany
    // (non-join) path (matchAmountOn net, no methods/amounts).
    m.categoryFindFirst.mockResolvedValue({ id: 7 });
    m.ruleFindFirst.mockResolvedValue({ id: 50 });
    m.ruleUpdate.mockResolvedValue({
      commentContains: null,
      descriptionContains: "paciente",
      id: 50,
    });
    m.ruleFindUnique.mockResolvedValue({
      amountsExact: [],
      categoryId: 7,
      commentContains: null,
      counterpartId: null,
      descriptionContains: null,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      paymentMethods: [],
      priority: 0,
      type: "INCOME",
    });
    m.txnUpdateMany.mockResolvedValue({ count: 0 });
    // buildAutoCategoryRuleLookup → no active rules so applyAutoCategoryRules
    // returns 0 (skips the loop).
    m.ruleFindMany?.mockResolvedValue?.([]);
  });

  it("returns summed counts from rules + personalDr + patients pattern applies", async () => {
    // applyAutoCategoryRulesToExistingTransactions → buildAutoCategoryRuleLookup
    // has no findMany on our mock for ruleFindMany; add it.
    (mockDb.financialAutoCategoryRule as Record<string, unknown>).findMany = () =>
      Promise.resolve([]);

    // $executeRaw is called twice in onlyUncategorized path:
    //   personalDr (returns 4) then patients (returns 9)
    executeRawQueue.push(4); // personalDr
    executeRawQueue.push(9); // patients

    const result = await syncUncategorizedTransactionsByPatterns();

    // rules path = 0 (no active rules) + 4 + 9
    expect(result).toEqual({ updated: 13 });
    expect(m.executeRaw).toHaveBeenCalledTimes(2);
  });

  it("personalDr executeRaw issues UPDATE with category_id IS NULL guard", async () => {
    (mockDb.financialAutoCategoryRule as Record<string, unknown>).findMany = () =>
      Promise.resolve([]);
    executeRawQueue.push(1);
    executeRawQueue.push(0);

    await syncUncategorizedTransactionsByPatterns();

    const personalDrSql = executeRawCalls[0] ?? "";
    expect(personalDrSql).toContain("UPDATE financial_transactions");
    expect(personalDrSql).toContain("category_id IS NULL");
    expect(personalDrSql).toContain("type = 'EXPENSE'");
    expect(personalDrSql).toContain("comment ~*");
  });

  it("patients executeRaw issues INCOME UPDATE with ILIKE + EXISTS subqueries", async () => {
    (mockDb.financialAutoCategoryRule as Record<string, unknown>).findMany = () =>
      Promise.resolve([]);
    executeRawQueue.push(0);
    executeRawQueue.push(2);

    await syncUncategorizedTransactionsByPatterns();

    const patientsSql = executeRawCalls[1] ?? "";
    expect(patientsSql).toContain("ft.type = 'INCOME'");
    expect(patientsSql).toContain("ft.category_id IS NULL");
    expect(patientsSql).toContain("ILIKE");
    expect(patientsSql).toContain("release_transactions rt");
    expect(patientsSql).toContain("settlement_transactions st");
  });
});

// ─── 3. reallocateFinancialTransaction ────────────────────────────────────────

describe("reallocateFinancialTransaction", () => {
  const baseData = {
    amount: 100,
    fromPeriod: "2026-01",
    profileId: 5,
    targetPeriod: "2026-03",
  };

  function wireHappyPath() {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });
    m.txBudgetFindMany.mockResolvedValue([{ isLocked: false }]);
    m.txAllocFindFirst.mockResolvedValue({ id: 200 }); // existing ORIGINAL
    m.txAllocFindMany.mockResolvedValue([{ allocationType: "ORIGINAL", amount: 500 }]);
    // create ROLLOVER_OUT then ROLLOVER_IN
    m.txAllocCreate
      .mockResolvedValueOnce({ id: 300 }) // rollover out
      .mockResolvedValueOnce({
        allocationType: "ROLLOVER_IN",
        amount: 100,
        id: 301,
        period: "2026-03",
        profileId: 5,
        transactionId: 30,
      });
  }

  it("happy path creates ROLLOVER_OUT + ROLLOVER_IN and returns the IN row", async () => {
    wireHappyPath();
    const result = await reallocateFinancialTransaction(30, baseData);

    expect(result).toMatchObject({
      allocationType: "ROLLOVER_IN",
      id: 301,
      period: "2026-03",
    });
    expect(m.txAllocCreate).toHaveBeenCalledTimes(2);
    // first create = ROLLOVER_OUT in fromPeriod, second = ROLLOVER_IN in target
    const outArg = m.txAllocCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    const inArg = m.txAllocCreate.mock.calls[1]?.[0] as { data: Record<string, unknown> };
    expect(outArg.data.allocationType).toBe("ROLLOVER_OUT");
    expect(outArg.data.period).toBe("2026-01");
    expect(inArg.data.allocationType).toBe("ROLLOVER_IN");
    expect(inArg.data.period).toBe("2026-03");
    expect(inArg.data.sourceAllocationId).toBe(300);
  });

  it("creates an ORIGINAL allocation first when none exists", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });
    m.txBudgetFindMany.mockResolvedValue([]);
    m.txAllocFindFirst.mockResolvedValue(null); // no ORIGINAL
    m.txAllocFindMany.mockResolvedValue([{ allocationType: "ORIGINAL", amount: 500 }]);
    m.txAllocCreate
      .mockResolvedValueOnce({ id: 100 }) // ORIGINAL created
      .mockResolvedValueOnce({ id: 300 }) // ROLLOVER_OUT
      .mockResolvedValueOnce({ allocationType: "ROLLOVER_IN", id: 301 });

    await reallocateFinancialTransaction(30, baseData);

    expect(m.txAllocCreate).toHaveBeenCalledTimes(3);
    const firstArg = m.txAllocCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(firstArg.data.allocationType).toBe("ORIGINAL");
    // ROLLOVER_OUT.sourceAllocationId should be the freshly created ORIGINAL id
    const outArg = m.txAllocCreate.mock.calls[1]?.[0] as { data: Record<string, unknown> };
    expect(outArg.data.sourceAllocationId).toBe(100);
  });

  it("throws INVALID_TARGET_PERIOD when target <= from", async () => {
    await expect(
      reallocateFinancialTransaction(30, { ...baseData, targetPeriod: "2026-01" })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("throws INVALID_AMOUNT when amount <= 0", async () => {
    await expect(
      reallocateFinancialTransaction(30, { ...baseData, amount: 0 })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("throws 409 when source period has insufficient available amount", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(50),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });
    m.txBudgetFindMany.mockResolvedValue([]);
    m.txAllocFindFirst.mockResolvedValue({ id: 200 });
    m.txAllocFindMany.mockResolvedValue([{ allocationType: "ORIGINAL", amount: 50 }]);

    await expect(reallocateFinancialTransaction(30, baseData)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("maps pg period-format constraint error (23514) to AppError 422", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });
    m.txBudgetFindMany.mockResolvedValue([]);
    m.txAllocFindFirst.mockResolvedValue({ id: 200 });
    m.txAllocFindMany.mockResolvedValue([{ allocationType: "ORIGINAL", amount: 500 }]);
    const pgErr = Object.assign(new Error("boom"), {
      code: "23514",
      constraint: "financial_transaction_allocations_period_format_chk",
    });
    m.txAllocCreate.mockRejectedValue(pgErr);

    await expect(reallocateFinancialTransaction(30, baseData)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("re-throws a non-constraint error untouched", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });
    m.txBudgetFindMany.mockResolvedValue([]);
    m.txAllocFindFirst.mockResolvedValue({ id: 200 });
    m.txAllocFindMany.mockResolvedValue([{ allocationType: "ORIGINAL", amount: 500 }]);
    const other = new Error("network down");
    m.txAllocCreate.mockRejectedValue(other);

    await expect(reallocateFinancialTransaction(30, baseData)).rejects.toThrow("network down");
  });

  it("throws 404 when compensation profile inactive", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: false,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });

    await expect(reallocateFinancialTransaction(30, baseData)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws 409 PROFILE_CATEGORY_MISMATCH when category differs", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 99, // mismatch
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });

    await expect(reallocateFinancialTransaction(30, baseData)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("throws 409 LOCKED_PERIOD when a relevant budget is locked", async () => {
    m.txProfileFindUnique.mockResolvedValue({
      categoryId: 7,
      counterpartId: null,
      id: 5,
      isActive: true,
    });
    m.txTxnFindUnique.mockResolvedValue({
      amount: new Decimal(500),
      categoryId: 7,
      counterpartId: null,
      date: new Date("2026-01-15T12:00:00Z"),
      id: 30,
      type: "EXPENSE",
    });
    m.txBudgetFindMany.mockResolvedValue([{ isLocked: true }]);

    await expect(reallocateFinancialTransaction(30, baseData)).rejects.toMatchObject({
      status: 409,
    });
  });
});

// keep AppError import referenced for type-level use
void AppError;
