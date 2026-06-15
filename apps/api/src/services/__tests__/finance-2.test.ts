import { Decimal } from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Second mutation-driven suite for services/finance.ts. The first file
// (finance.test.ts) covers pure calc + DomainError guards. This file targets
// the LARGE no-coverage blocks: the whole syncUnifiedTransactions pipeline
// (counterpart/withdraw lookups, auto-category rule matching, personal-dr +
// patients pattern matching, dedupe + create paths) plus the simpler exported
// CRUD that the first file never calls (create/update/delete transaction,
// list categories, list months, auto-rule create/update/delete, compensation
// happy paths).
//
// We mock @finanzas/db (vi.hoisted), @finanzas/db/slices ($setOptions guard),
// ./transactions.ts (the merged-transaction source) and ../lib/audit-diff.ts
// (no real audit write). $queryRaw / $executeRaw are tagged-template fns; we
// assert on the returned MATH and the recorded calls, not the SQL text.

const { mockDb, m, mockAuditRowChange, mockFetchMerged, mockFetchMergedBySourceIds } = vi.hoisted(
  () => {
    const mk = () => vi.fn();
    const m = {
      counterpartFindMany: mk(),
      counterpartFindUnique: mk(),
      withdrawFindMany: mk(),
      ruleFindMany: mk(),
      ruleFindFirst: mk(),
      ruleFindUnique: mk(),
      ruleCreate: mk(),
      ruleUpdate: mk(),
      ruleUpdateMany: mk(),
      ruleDelete: mk(),
      categoryFindMany: mk(),
      categoryFindFirst: mk(),
      categoryFindUnique: mk(),
      categoryCreate: mk(),
      categoryUpdate: mk(),
      categoryDelete: mk(),
      txnFindMany: mk(),
      txnFindFirst: mk(),
      txnFindUnique: mk(),
      txnCount: mk(),
      txnCreate: mk(),
      txnUpdate: mk(),
      txnUpdateMany: mk(),
      txnDelete: mk(),
      releaseFindMany: mk(),
      settlementFindMany: mk(),
      queryRaw: mk(),
      executeRaw: mk(),
      transaction: mk(),
    };
    const mockDb = {
      counterpart: {
        findMany: (...a: unknown[]) => m.counterpartFindMany(...a),
        findUnique: (...a: unknown[]) => m.counterpartFindUnique(...a),
      },
      withdrawTransaction: { findMany: (...a: unknown[]) => m.withdrawFindMany(...a) },
      financialAutoCategoryRule: {
        findMany: (...a: unknown[]) => m.ruleFindMany(...a),
        findFirst: (...a: unknown[]) => m.ruleFindFirst(...a),
        findUnique: (...a: unknown[]) => m.ruleFindUnique(...a),
        create: (...a: unknown[]) => m.ruleCreate(...a),
        update: (...a: unknown[]) => m.ruleUpdate(...a),
        updateMany: (...a: unknown[]) => m.ruleUpdateMany(...a),
        delete: (...a: unknown[]) => m.ruleDelete(...a),
      },
      transactionCategory: {
        findMany: (...a: unknown[]) => m.categoryFindMany(...a),
        findFirst: (...a: unknown[]) => m.categoryFindFirst(...a),
        findUnique: (...a: unknown[]) => m.categoryFindUnique(...a),
        create: (...a: unknown[]) => m.categoryCreate(...a),
        update: (...a: unknown[]) => m.categoryUpdate(...a),
        delete: (...a: unknown[]) => m.categoryDelete(...a),
      },
      financialTransaction: {
        findMany: (...a: unknown[]) => m.txnFindMany(...a),
        findFirst: (...a: unknown[]) => m.txnFindFirst(...a),
        findUnique: (...a: unknown[]) => m.txnFindUnique(...a),
        count: (...a: unknown[]) => m.txnCount(...a),
        create: (...a: unknown[]) => m.txnCreate(...a),
        update: (...a: unknown[]) => m.txnUpdate(...a),
        updateMany: (...a: unknown[]) => m.txnUpdateMany(...a),
        delete: (...a: unknown[]) => m.txnDelete(...a),
      },
      releaseTransaction: { findMany: (...a: unknown[]) => m.releaseFindMany(...a) },
      settlementTransaction: { findMany: (...a: unknown[]) => m.settlementFindMany(...a) },
      $queryRaw: (...a: unknown[]) => m.queryRaw(...a),
      $executeRaw: (...a: unknown[]) => m.executeRaw(...a),
      $transaction: (...a: unknown[]) => m.transaction(...a),
      $setOptions: () => mockDb,
    };
    const mockAuditRowChange = vi.fn();
    const mockFetchMerged = vi.fn();
    const mockFetchMergedBySourceIds = vi.fn();
    return { mockDb, m, mockAuditRowChange, mockFetchMerged, mockFetchMergedBySourceIds };
  }
);

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../lib/audit-diff.ts", () => ({ auditRowChange: mockAuditRowChange }));
vi.mock("../transactions.ts", () => ({
  fetchMergedTransactions: (...a: unknown[]) => mockFetchMerged(...a),
  fetchMergedTransactionsBySourceIds: (...a: unknown[]) => mockFetchMergedBySourceIds(...a),
}));

const {
  syncFinancialTransactions,
  syncFinancialTransactionsBySourceIds,
  syncUncategorizedTransactionsByPatterns,
  listAvailableFinancialTransactionMonths,
  listTransactionCategories,
  createFinancialTransaction,
  updateFinancialTransaction,
  deleteFinancialTransaction,
  createTransactionCategory,
  createFinancialAutoCategoryRule,
  updateFinancialAutoCategoryRule,
  deleteFinancialAutoCategoryRule,
  listCompensationProfiles,
  createCompensationProfile,
  updateCompensationProfile,
  upsertCompensationPeriodBudget,
} = await import("../finance.ts");

// ─── shared fixtures / helpers ────────────────────────────────────────────────

function unified(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    source: "release",
    transactionDate: new Date("2026-05-10T12:00:00Z"),
    description: "Pago",
    transactionType: "PAYMENT",
    transactionAmount: 1000,
    grossAmount: null,
    status: null,
    externalReference: null,
    sourceId: "src-1",
    paymentMethod: null,
    paymentMethodType: null,
    settlementNetAmount: null,
    identificationNumber: null,
    bankAccountHolder: null,
    bankAccountNumber: null,
    bankAccountType: null,
    bankName: null,
    withdrawId: null,
    ...over,
  };
}

// The three ensure* helpers run at the top of syncUnifiedTransactions. We give
// them findFirst→existing category + findFirst→existing rule so they take the
// "update existing" branch and applySingleAutoCategoryRule sees an active rule
// (which then calls applyAutoCategoryRuleRow → updateMany / sql). We default
// everything to benign no-ops; individual tests override what they assert.
function primeSyncScaffold() {
  // ensureMercadoPagoCardAutoCategoryRule, ensurePersonalDrAutoCategoryRules (x2),
  // ensurePatientsAutoCategoryRule all do: categoryFindFirst → category,
  // ruleFindFirst → rule, ruleUpdate → {id}, applySingleAutoCategoryRule:
  // ruleFindUnique → rule, applyAutoCategoryRuleRow.
  m.categoryFindFirst.mockResolvedValue({ id: 10 });
  m.categoryCreate.mockResolvedValue({ id: 10 });
  m.ruleFindFirst.mockResolvedValue({ id: 20 });
  m.ruleUpdate.mockResolvedValue({
    id: 20,
    commentContains: null,
    descriptionContains: "paciente",
  });
  m.ruleFindUnique.mockResolvedValue({
    id: 20,
    amountsExact: [],
    categoryId: 10,
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
  // buildCounterpartLookup, buildWithdrawLookup, buildAutoCategoryRuleLookup
  m.counterpartFindMany.mockResolvedValue([]);
  m.withdrawFindMany.mockResolvedValue([]);
  m.ruleFindMany.mockResolvedValue([]);
  // sourceId ref lookups (release/settlement) + existing financial txns
  m.releaseFindMany.mockResolvedValue([]);
  m.settlementFindMany.mockResolvedValue([]);
  m.txnFindMany.mockResolvedValue([]);
  m.txnFindFirst.mockResolvedValue(null);
  m.txnCreate.mockResolvedValue({ id: 500 });
  m.executeRaw.mockResolvedValue(0);
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  mockAuditRowChange.mockReset();
  mockFetchMerged.mockReset();
  mockFetchMergedBySourceIds.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── syncFinancialTransactionsBySourceIds (drives the whole pipeline) ──────────

describe("syncFinancialTransactionsBySourceIds", () => {
  it("creates a NEW transaction (no existing) with INCOME type for a positive amount", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "new-1", transactionAmount: 1500, description: "Venta" }),
    ]);

    const r = await syncFinancialTransactionsBySourceIds(["new-1"], 7);

    expect(r).toEqual({ created: 1, duplicates: 0, failed: 0, errors: [], total: 1 });
    expect(m.txnCreate).toHaveBeenCalledTimes(1);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.type).toBe("INCOME");
    expect(created.data.description).toBe("Venta");
    expect(Number(created.data.amount as Decimal)).toBe(1500);
    // applyGlobalRules:false on the bySourceIds path → no global re-apply.
    expect(m.executeRaw).not.toHaveBeenCalled();
  });

  it("creates an EXPENSE transaction for a negative amount and defaults a blank description", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "neg-1", transactionAmount: -200, description: null }),
    ]);

    await syncFinancialTransactionsBySourceIds(["neg-1"], 7);

    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.type).toBe("EXPENSE");
    expect(created.data.description).toBe("Sin descripcion");
  });

  it("builds a 'Ref: …' comment from externalReference", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "ref-1", externalReference: "ABC-123" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["ref-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.comment).toBe("Ref: ABC-123");
  });

  it("filters out settlement CASHBACK rows (excluded from total)", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ source: "settlement", transactionType: "cashback", sourceId: "cb-1" }),
    ]);
    const r = await syncFinancialTransactionsBySourceIds(["cb-1"], 7);
    expect(r.total).toBe(0);
    expect(r.created).toBe(0);
    expect(m.txnCreate).not.toHaveBeenCalled();
  });

  it("treats an EXISTING (same sourceId) row as a duplicate and may patch its counterpart", async () => {
    primeSyncScaffold();
    // resolve a counterpart by RUT so the existing row gets a counterpart update
    m.counterpartFindMany.mockResolvedValue([
      { id: 88, identificationNumber: "12.345.678-9", accounts: [] },
    ]);
    m.txnFindMany.mockResolvedValue([
      {
        id: 42,
        amount: new Decimal(1000),
        categoryId: null,
        comment: null,
        counterpartId: null,
        description: "Pago",
        sourceId: "dup-1",
        type: "INCOME",
      },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "dup-1", identificationNumber: "12345678-9", transactionAmount: 1000 }),
    ]);

    const r = await syncFinancialTransactionsBySourceIds(["dup-1"], 7);
    expect(r.duplicates).toBe(1);
    expect(r.created).toBe(0);
    expect(m.txnUpdate).toHaveBeenCalledTimes(1);
    const upd = m.txnUpdate.mock.calls[0]?.[0] as {
      where: { id: number };
      data: Record<string, unknown>;
    };
    expect(upd.where.id).toBe(42);
    expect(upd.data.counterpartId).toBe(88);
  });

  it("does NOT update an existing duplicate when nothing changed", async () => {
    primeSyncScaffold();
    m.txnFindMany.mockResolvedValue([
      {
        id: 43,
        amount: new Decimal(1000),
        categoryId: null,
        comment: null,
        counterpartId: null,
        description: "Pago",
        sourceId: "dup-2",
        type: "INCOME",
      },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "dup-2", transactionAmount: 1000 }),
    ]);

    const r = await syncFinancialTransactionsBySourceIds(["dup-2"], 7);
    expect(r.duplicates).toBe(1);
    expect(m.txnUpdate).not.toHaveBeenCalled();
  });

  it("counts a create failure into `failed` and records the error message", async () => {
    primeSyncScaffold();
    m.txnCreate.mockRejectedValue(new Error("db down"));
    mockFetchMergedBySourceIds.mockResolvedValue([unified({ sourceId: "boom-1" })]);

    const r = await syncFinancialTransactionsBySourceIds(["boom-1"], 7);
    expect(r.failed).toBe(1);
    expect(r.created).toBe(0);
    expect(r.errors).toEqual(["db down"]);
  });

  it("caps recorded errors at 10 even with more failures", async () => {
    primeSyncScaffold();
    m.txnCreate.mockRejectedValue(new Error("nope"));
    mockFetchMergedBySourceIds.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => unified({ sourceId: `e-${i}`, transactionAmount: 100 }))
    );
    const r = await syncFinancialTransactionsBySourceIds(
      Array.from({ length: 15 }, (_, i) => `e-${i}`),
      7
    );
    expect(r.failed).toBe(15);
    expect(r.errors).toHaveLength(10);
  });

  it("dedupes rows WITHOUT a sourceId via the (date, amount, description) fallback", async () => {
    primeSyncScaffold();
    // existing fallback row found via findFirst
    m.txnFindFirst.mockResolvedValue({
      id: 77,
      amount: new Decimal(500),
      categoryId: null,
      comment: null,
      counterpartId: null,
      description: "Manual",
      type: "INCOME",
    });
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: null, transactionAmount: 500, description: "Manual" }),
    ]);

    const r = await syncFinancialTransactionsBySourceIds([], 7);
    expect(r.duplicates).toBe(1);
    expect(m.txnFindFirst).toHaveBeenCalledTimes(1);
  });
});

// ─── auto-category rule matching during create (resolveAutoCategoryId) ─────────

describe("syncFinancialTransactionsBySourceIds — auto-category matching", () => {
  // Active rule that targets INCOME 1000..2000 → category 555. The buildAuto
  // CategoryRuleLookup reads ruleFindMany; we override it AFTER primeSyncScaffold.
  function ruleRow(over: Partial<Record<string, unknown>> = {}) {
    return {
      amountsExact: [],
      categoryId: 555,
      commentContains: null,
      counterpartId: null,
      descriptionContains: null,
      matchAmountOn: "net",
      maxAmount: 2000,
      minAmount: 1000,
      paymentMethods: [],
      priority: 100,
      type: "INCOME",
      ...over,
    };
  }

  it("assigns the rule category when amount falls inside [min,max]", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([ruleRow()]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-1", transactionAmount: 1500 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["r-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(555);
  });

  it("does NOT assign when amount is below the rule minAmount (boundary)", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([ruleRow({ minAmount: 1000, maxAmount: 2000 })]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-2", transactionAmount: 999 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["r-2"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBeNull();
  });

  it("does NOT assign when the rule type differs from the transaction type", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([ruleRow({ type: "EXPENSE" })]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-3", transactionAmount: 1500 }), // INCOME
    ]);
    await syncFinancialTransactionsBySourceIds(["r-3"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBeNull();
  });

  it("matches an amountsExact rule within the epsilon and ignores min/max", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ amountsExact: [1500], minAmount: null, maxAmount: null }),
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-4", transactionAmount: 1500.4 }), // within 0.5 epsilon
    ]);
    await syncFinancialTransactionsBySourceIds(["r-4"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(555);
  });

  it("rejects an amountsExact rule when outside the epsilon", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ amountsExact: [1500], minAmount: null, maxAmount: null }),
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-5", transactionAmount: 1502 }), // 2 away → no match
    ]);
    await syncFinancialTransactionsBySourceIds(["r-5"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBeNull();
  });

  it("requires the payment method to match when the rule lists methods", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ paymentMethods: ["credit_card"], minAmount: null, maxAmount: null }),
    ]);
    // release ref provides paymentMethodType for the sourceId
    m.releaseFindMany.mockResolvedValue([
      { sourceId: "pm-1", grossAmount: null, paymentMethodType: "credit_card", saleDetail: null },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "pm-1", transactionAmount: 1500, paymentMethodType: "credit_card" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pm-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(555);
  });

  it("skips a payment-method rule when the transaction method differs", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ paymentMethods: ["credit_card"], minAmount: null, maxAmount: null }),
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "pm-2", transactionAmount: 1500, paymentMethodType: "debit_card" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pm-2"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBeNull();
  });

  it("classifies an EXPENSE with a Personal-Dr reference comment as the personal-dr category", async () => {
    primeSyncScaffold();
    // ensurePersonalDrAutoCategoryRules returns category id 10 (categoryFindFirst).
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        sourceId: "pd-1",
        transactionAmount: -500,
        externalReference: "db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17",
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pd-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // comment becomes "Ref: <uuid>-17" which matches PERSONAL_DR_REFERENCE_REGEX
    expect(created.data.categoryId).toBe(10);
  });

  it("classifies an INCOME mentioning 'paciente' as the patients category", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "pt-1", transactionAmount: 800, description: "Pago de paciente Juan" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pt-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(10);
  });
});

// ─── counterpart resolution (release source via withdraw lookup) ───────────────

describe("syncFinancialTransactionsBySourceIds — counterpart resolution", () => {
  it("resolves a release-source counterpart by RUT recovered from the linked withdraw", async () => {
    primeSyncScaffold();
    m.counterpartFindMany.mockResolvedValue([
      { id: 91, identificationNumber: "9.876.543-2", accounts: [] },
    ]);
    // withdraw row keyed by withdrawId == release sourceId
    m.withdrawFindMany.mockResolvedValue([
      { withdrawId: "rel-1", identificationNumber: "9876543-2", bankAccountNumber: null },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ source: "release", sourceId: "rel-1", transactionAmount: 700 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["rel-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.counterpartId).toBe(91);
  });

  it("falls back to counterpart-by-account for a non-release transaction", async () => {
    primeSyncScaffold();
    m.counterpartFindMany.mockResolvedValue([
      { id: 92, identificationNumber: null, accounts: [{ accountNumber: "001234" }] },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        source: "settlement",
        transactionType: "PAYMENT",
        sourceId: "set-1",
        transactionAmount: 700,
        bankAccountNumber: "1234", // normalizes (leading zeros stripped) to "1234"
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["set-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.counterpartId).toBe(92);
  });
});

// ─── syncFinancialTransactions (full path applies global rules) ────────────────

describe("syncFinancialTransactions", () => {
  it("fetches NON-test merged transactions and applies the global rule passes", async () => {
    primeSyncScaffold();
    mockFetchMerged.mockResolvedValue([]);

    const r = await syncFinancialTransactions(7);
    expect(mockFetchMerged).toHaveBeenCalledWith({ includeTest: false });
    expect(r.total).toBe(0);
    // applyGlobalRules defaults true → the two pattern $executeRaw passes run.
    expect(m.executeRaw).toHaveBeenCalled();
  });

  it("runs the global rule pass over existing transactions via updateMany (net rule)", async () => {
    primeSyncScaffold();
    // A simple net rule with min/max → applyAutoCategoryRuleRow takes the
    // updateMany branch (no release-join). buildAutoCategoryRuleLookup reads
    // ruleFindMany; we hand it one active rule.
    m.ruleFindMany.mockResolvedValue([
      {
        amountsExact: [],
        categoryId: 777,
        commentContains: null,
        counterpartId: null,
        descriptionContains: null,
        matchAmountOn: "net",
        maxAmount: 5000,
        minAmount: 100,
        paymentMethods: [],
        priority: 1,
        type: "EXPENSE",
      },
    ]);
    m.txnUpdateMany.mockResolvedValue({ count: 4 });
    mockFetchMerged.mockResolvedValue([]);

    await syncFinancialTransactions(7);
    // updateMany invoked for the global rule pass with the rule's where/data.
    const call = m.txnUpdateMany.mock.calls.find(
      (c) => (c[0] as { data?: { categoryId?: number } })?.data?.categoryId === 777
    );
    expect(call).toBeDefined();
    const args = call?.[0] as { where: Record<string, unknown>; data: { categoryId: number } };
    expect(args.data.categoryId).toBe(777);
    expect(args.where.type).toBe("EXPENSE");
  });
});

// ─── syncUncategorizedTransactionsByPatterns ───────────────────────────────────

describe("syncUncategorizedTransactionsByPatterns", () => {
  it("sums updated counts across the rule + personal + patients passes", async () => {
    primeSyncScaffold();
    // applyAutoCategoryRulesToExistingTransactions with no rules → 0.
    m.ruleFindMany.mockResolvedValue([]);
    // applyPersonalDr + applyPatients each return their $executeRaw count.
    // personal=3, patients=4 → distinct so a mutant that drops one term dies.
    m.executeRaw.mockResolvedValueOnce(3).mockResolvedValueOnce(4);

    const r = await syncUncategorizedTransactionsByPatterns();
    // updatedByRules(0) + personal(3) + patients(4) = 7
    expect(r.updated).toBe(7);
  });
});

// ─── listAvailableFinancialTransactionMonths ───────────────────────────────────

describe("listAvailableFinancialTransactionMonths", () => {
  it("maps the month column and filters out empty values", async () => {
    m.queryRaw.mockResolvedValue([{ month: "2026-05" }, { month: "2026-04" }, { month: "" }]);
    const r = await listAvailableFinancialTransactionMonths();
    expect(r).toEqual(["2026-05", "2026-04"]);
  });
});

// ─── listTransactionCategories ─────────────────────────────────────────────────

describe("listTransactionCategories", () => {
  it("merges duplicates then returns categories ordered by name", async () => {
    // mergeDuplicate findMany → no duplicates (single group), then the listing.
    m.categoryFindMany
      .mockResolvedValueOnce([{ id: 1, name: "Servicios" }]) // merge pass
      .mockResolvedValueOnce([{ id: 1, name: "Servicios", color: "#fff" }]); // listing
    const r = await listTransactionCategories();
    expect(r).toEqual([{ id: 1, name: "Servicios", color: "#fff" }]);
    // listing call uses orderBy name asc
    const lastCall = m.categoryFindMany.mock.calls.at(-1)?.[0] as { orderBy: unknown };
    expect(lastCall.orderBy).toEqual({ name: "asc" });
  });

  it("collapses two categories with the same normalized name into the primary", async () => {
    m.categoryFindMany
      .mockResolvedValueOnce([
        { id: 1, name: "Servicios" },
        { id: 2, name: "  SERVICIOS " }, // normalizes to same key
      ])
      .mockResolvedValueOnce([{ id: 1, name: "Servicios" }]);
    m.transaction.mockImplementation(async (cb: (tx: typeof txStub) => unknown) => cb(txStub));
    const txStub = {
      financialTransaction: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      financialAutoCategoryRule: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      transactionCategory: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    await listTransactionCategories();
    // duplicate id 2 → reassigned to primary id 1, then deleted
    expect(txStub.financialTransaction.updateMany).toHaveBeenCalledWith({
      where: { categoryId: { in: [2] } },
      data: { categoryId: 1 },
    });
    expect(txStub.transactionCategory.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [2] } },
    });
  });
});

// ─── createFinancialTransaction ────────────────────────────────────────────────

describe("createFinancialTransaction", () => {
  it("wraps amount in Decimal and forwards all fields to db.create", async () => {
    m.txnCreate.mockResolvedValue({ id: 1 });
    await createFinancialTransaction({
      date: new Date("2026-05-01T00:00:00Z"),
      description: "Test",
      amount: 4200,
      type: "INCOME",
      categoryId: 3,
      counterpartId: 9,
      comment: "c",
      sourceId: "s",
    });
    const args = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Number(args.data.amount as Decimal)).toBe(4200);
    expect(args.data.description).toBe("Test");
    expect(args.data.type).toBe("INCOME");
    expect(args.data.categoryId).toBe(3);
    expect(args.data.counterpartId).toBe(9);
    expect(args.data.comment).toBe("c");
    expect(args.data.sourceId).toBe("s");
  });
});

// ─── updateFinancialTransaction (audit diff) ───────────────────────────────────

describe("updateFinancialTransaction", () => {
  it("snapshots before, applies only provided fields and writes an audit row", async () => {
    m.txnFindUnique.mockResolvedValue({
      amount: new Decimal(100),
      categoryId: 1,
      comment: null,
      counterpartId: null,
      date: new Date("2026-01-01T00:00:00Z"),
      description: "old",
      type: "INCOME",
    });
    m.txnUpdate.mockResolvedValue({ id: 5, amount: new Decimal(250), description: "new" });

    const r = await updateFinancialTransaction(5, { amount: 250, description: "new" });
    expect(r).toEqual({ id: 5, amount: new Decimal(250), description: "new" });

    const args = m.txnUpdate.mock.calls[0]?.[0] as {
      where: { id: number };
      data: Record<string, unknown>;
    };
    expect(args.where.id).toBe(5);
    expect(Number(args.data.amount as Decimal)).toBe(250);
    expect(args.data.description).toBe("new");
    // type/categoryId NOT provided → absent from update data
    expect("type" in args.data).toBe(false);
    expect("categoryId" in args.data).toBe(false);

    expect(mockAuditRowChange).toHaveBeenCalledTimes(1);
    const audit = mockAuditRowChange.mock.calls[0]?.[0] as {
      resourceId: number;
      kind: string;
      resource: string;
    };
    expect(audit.resourceId).toBe(5);
    expect(audit.kind).toBe("FINANCIAL_CHANGE");
    expect(audit.resource).toBe("financial_transaction");
  });
});

// ─── deleteFinancialTransaction ────────────────────────────────────────────────

describe("deleteFinancialTransaction", () => {
  it("deletes by id", async () => {
    m.txnDelete.mockResolvedValue({ id: 9 });
    await deleteFinancialTransaction(9);
    expect(m.txnDelete).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});

// ─── createTransactionCategory happy path ──────────────────────────────────────

describe("createTransactionCategory happy path", () => {
  it("cleans whitespace, marks NON_ACCOUNTABLE icon and creates", async () => {
    // mergeDuplicate findMany → []; findCategoryByNormalizedName findMany → [].
    m.categoryFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.categoryCreate.mockResolvedValue({ id: 99 });

    await createTransactionCategory({ name: "  Nueva   Cat  ", isNonAccountable: true });
    const args = m.categoryCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.name).toBe("Nueva Cat");
    expect(args.data.icon).toBe("NON_ACCOUNTABLE");
  });

  it("sets icon null when not flagged non-accountable", async () => {
    m.categoryFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.categoryCreate.mockResolvedValue({ id: 99 });
    await createTransactionCategory({ name: "Normal" });
    const args = m.categoryCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.icon).toBeNull();
  });
});

// ─── createFinancialAutoCategoryRule happy path ────────────────────────────────

describe("createFinancialAutoCategoryRule happy path", () => {
  it("defaults optionals, converts amounts to Decimal and maps the result", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 5 }); // ensureCategoryExists ok
    m.ruleCreate.mockResolvedValue({
      id: 30,
      amountsExact: [new Decimal(100)],
      categoryId: 5,
      commentContains: null,
      counterpartId: null,
      descriptionContains: null,
      isActive: true,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
      category: { color: "#fff", icon: null, id: 5, name: "Cat" },
      counterpart: null,
    });
    // applySingleAutoCategoryRule → ruleFindUnique active rule → updateMany.
    m.ruleFindUnique.mockResolvedValue({
      id: 30,
      amountsExact: [],
      categoryId: 5,
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
    m.txnUpdateMany.mockResolvedValue({ count: 0 });

    const r = await createFinancialAutoCategoryRule({
      categoryId: 5,
      name: "R",
      type: "EXPENSE",
      amountsExact: [100],
    });
    expect(r.id).toBe(30);
    expect(r.amountsExact).toEqual([100]);

    const createArgs = m.ruleCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // amountsExact mapped to Decimal[]
    expect((createArgs.data.amountsExact as Decimal[])[0]).toBeInstanceOf(Decimal);
    expect(createArgs.data.isActive).toBe(true); // default
    expect(createArgs.data.priority).toBe(0); // default
    expect(createArgs.data.paymentMethods).toEqual([]); // default
  });
});

// ─── updateFinancialAutoCategoryRule happy path ────────────────────────────────

describe("updateFinancialAutoCategoryRule happy path", () => {
  it("only patches provided fields, re-validates the (possibly new) category and reapplies", async () => {
    m.ruleFindUnique
      // existing rule fetch
      .mockResolvedValueOnce({
        id: 30,
        amountsExact: [],
        categoryId: 5,
        commentContains: null,
        counterpartId: null,
        descriptionContains: null,
        isActive: true,
        matchAmountOn: "net",
        maxAmount: null,
        minAmount: null,
        name: "R",
        paymentMethods: [],
        priority: 0,
        type: "EXPENSE",
      })
      // applySingleAutoCategoryRule fetch (after update)
      .mockResolvedValueOnce({
        id: 30,
        amountsExact: [],
        categoryId: 5,
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
    m.categoryFindUnique.mockResolvedValue({ id: 5 }); // ensureCategoryExists ok
    m.ruleUpdate.mockResolvedValue({
      id: 30,
      amountsExact: [],
      categoryId: 5,
      commentContains: "kw",
      counterpartId: null,
      descriptionContains: null,
      isActive: false,
      matchAmountOn: "net",
      maxAmount: null,
      minAmount: null,
      name: "R",
      paymentMethods: [],
      priority: 0,
      type: "EXPENSE",
      category: { color: "#fff", icon: null, id: 5, name: "Cat" },
      counterpart: null,
    });
    m.txnUpdateMany.mockResolvedValue({ count: 0 });

    const r = await updateFinancialAutoCategoryRule(30, {
      commentContains: "kw",
      isActive: false,
    });
    expect(r.commentContains).toBe("kw");
    expect(r.isActive).toBe(false);

    const updArgs = m.ruleUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(updArgs.data.commentContains).toBe("kw");
    expect(updArgs.data.isActive).toBe(false);
    // name/type/priority not provided → absent
    expect("name" in updArgs.data).toBe(false);
    expect("priority" in updArgs.data).toBe(false);
  });
});

// ─── deleteFinancialAutoCategoryRule ───────────────────────────────────────────

describe("deleteFinancialAutoCategoryRule", () => {
  it("deletes by id", async () => {
    m.ruleDelete.mockResolvedValue({ id: 30 });
    await deleteFinancialAutoCategoryRule(30);
    expect(m.ruleDelete).toHaveBeenCalledWith({ where: { id: 30 } });
  });
});

// ─── listCompensationProfiles ──────────────────────────────────────────────────

describe("listCompensationProfiles", () => {
  it("maps raw rows: counterpart null when no counterpartId, defaults string fields", async () => {
    m.queryRaw.mockResolvedValue([
      {
        id: 1,
        name: "P1",
        isActive: true,
        timezone: "America/Santiago",
        categoryId: 5,
        categoryName: "Cat",
        counterpartId: null,
        counterpartBankAccountHolder: null,
        counterpartIdentificationNumber: null,
      },
      {
        id: 2,
        name: "P2",
        isActive: false,
        timezone: "UTC",
        categoryId: 6,
        categoryName: "Cat2",
        counterpartId: 9,
        counterpartBankAccountHolder: null,
        counterpartIdentificationNumber: null,
      },
    ]);
    const r = await listCompensationProfiles();
    expect(r[0]?.counterpart).toBeNull();
    expect(r[0]?.category).toEqual({ id: 5, name: "Cat" });
    // present counterpart with null strings → coerced to ""
    expect(r[1]?.counterpart).toEqual({
      bankAccountHolder: "",
      id: 9,
      identificationNumber: "",
    });
  });
});

// ─── createCompensationProfile happy path ──────────────────────────────────────

describe("createCompensationProfile happy path", () => {
  it("inserts then re-reads the created profile by id", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 5 });
    // 1st $queryRaw = INSERT … RETURNING id; 2nd = getCompensationProfileById.
    m.queryRaw.mockResolvedValueOnce([{ id: 77 }]).mockResolvedValueOnce([
      {
        id: 77,
        name: "Perfil",
        isActive: true,
        timezone: "America/Santiago",
        categoryId: 5,
        categoryName: "Cat",
        counterpartId: null,
        counterpartBankAccountHolder: null,
        counterpartIdentificationNumber: null,
      },
    ]);

    const r = await createCompensationProfile({ categoryId: 5, name: "  Perfil  " });
    expect(r.id).toBe(77);
    expect(r.name).toBe("Perfil");
    // INSERT bound the trimmed name as a value
    const insertValues = m.queryRaw.mock.calls[0] as unknown[];
    expect(insertValues).toContain("Perfil");
  });

  it("throws when the INSERT returns no id", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 5 });
    m.queryRaw.mockResolvedValueOnce([]); // no RETURNING row
    await expect(createCompensationProfile({ categoryId: 5, name: "P" })).rejects.toThrow(
      "No se pudo crear el perfil de compensación"
    );
  });
});

// ─── updateCompensationProfile happy path ──────────────────────────────────────

describe("updateCompensationProfile happy path", () => {
  it("updates an existing profile and re-reads it", async () => {
    // no categoryId/counterpartId guards. existing $queryRaw → [{id}], then
    // $executeRaw (UPDATE), then getCompensationProfileById $queryRaw → row.
    m.queryRaw
      .mockResolvedValueOnce([{ id: 1 }]) // existing
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "New",
          isActive: true,
          timezone: "America/Santiago",
          categoryId: 5,
          categoryName: "Cat",
          counterpartId: null,
          counterpartBankAccountHolder: null,
          counterpartIdentificationNumber: null,
        },
      ]);
    m.executeRaw.mockResolvedValue(1);

    const r = await updateCompensationProfile(1, { name: "New" });
    expect(r.name).toBe("New");
    expect(m.executeRaw).toHaveBeenCalledTimes(1);
  });
});

// ─── upsertCompensationPeriodBudget happy path ─────────────────────────────────

describe("upsertCompensationPeriodBudget happy path", () => {
  it("upserts and returns the persisted budget row", async () => {
    m.queryRaw
      .mockResolvedValueOnce([{ id: 1 }]) // profile exists
      .mockResolvedValueOnce([
        { id: 50, profileId: 1, period: "2026-01", baseAmount: 1000, isLocked: false },
      ]); // RETURNING row
    const r = await upsertCompensationPeriodBudget(1, { baseAmount: 1000, period: "2026-01" });
    expect(r).toEqual({
      id: 50,
      profileId: 1,
      period: "2026-01",
      baseAmount: 1000,
      isLocked: false,
    });
    // the period bound into both the existence check and the insert
    const insertCall = m.queryRaw.mock.calls[1] as unknown[];
    expect(insertCall).toContain("2026-01");
  });

  it("rejects an invalid period before touching the DB", async () => {
    await expect(
      upsertCompensationPeriodBudget(1, { baseAmount: 1000, period: "2026-13" })
    ).rejects.toThrow();
    expect(m.queryRaw).not.toHaveBeenCalled();
  });
});
