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
      profileFindUnique: mk(),
      profileCreate: mk(),
      profileUpdate: mk(),
      qbRows: mk(),
      queryRaw: mk(),
      executeRaw: mk(),
      transaction: mk(),
    };
    // Minimal Kysely-shaped builder: every chained method returns the same
    // builder; execute()/executeTakeFirst() resolve from m.qbRows() so tests
    // control the returned rows. Used by listCompensationProfiles +
    // getCompensationProfileById ($qb join migration).
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
        const rows = m.qbRows();
        return Array.isArray(rows) ? rows : [];
      };
      builder.executeTakeFirst = async () => {
        const rows = m.qbRows();
        return Array.isArray(rows) ? rows[0] : rows;
      };
      return builder;
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
      compensationProfile: {
        findUnique: (...a: unknown[]) => m.profileFindUnique(...a),
        create: (...a: unknown[]) => m.profileCreate(...a),
        update: (...a: unknown[]) => m.profileUpdate(...a),
      },
      get $qb() {
        return makeQb();
      },
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
    // EXACT create payload — pins every field the builder assembles. amount is a
    // Decimal so we assert it separately, then assert the rest of the shape.
    expect(Number(created.data.amount as Decimal)).toBe(1500);
    expect(created.data).toMatchObject({
      date: new Date("2026-05-10T12:00:00Z"),
      description: "Venta",
      type: "INCOME",
      sourceId: "new-1",
      categoryId: null,
      counterpartId: null,
      comment: undefined,
    });
    // applyGlobalRules:false on the bySourceIds path → no global re-apply.
    expect(m.executeRaw).not.toHaveBeenCalled();
    // bySourceIds path delegates to fetchMergedTransactionsBySourceIds with the
    // exact id list (NOT the full-merge fetcher).
    expect(mockFetchMergedBySourceIds).toHaveBeenCalledWith(["new-1"]);
    expect(mockFetchMerged).not.toHaveBeenCalled();
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
    // sign preserved into the stored Decimal (kills an abs/negation mutant)
    expect(Number(created.data.amount as Decimal)).toBe(-200);
  });

  it("types a ZERO amount as INCOME (boundary: amount >= 0)", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "zero-1", transactionAmount: 0, description: "Cero" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["zero-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `tour.transactionAmount >= 0 ? "INCOME" : "EXPENSE"` — 0 is INCOME. Kills
    // a `>=` → `>` mutant.
    expect(created.data.type).toBe("INCOME");
    expect(Number(created.data.amount as Decimal)).toBe(0);
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

  it("leaves comment undefined when there is no externalReference", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "noref-1", externalReference: null }),
    ]);
    await syncFinancialTransactionsBySourceIds(["noref-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `tour.externalReference ? \`Ref: …\` : undefined` — falsy → undefined.
    expect(created.data.comment).toBeUndefined();
  });

  it("filters out settlement CASHBACK rows (excluded from total) but keeps siblings", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      // CASHBACK settlement → filtered out. Note lowercase to exercise the
      // .toUpperCase() === "CASHBACK" comparison.
      unified({ source: "settlement", transactionType: "cashback", sourceId: "cb-1" }),
      // a NON-cashback settlement sibling survives the filter and IS created
      unified({
        source: "settlement",
        transactionType: "PAYMENT",
        sourceId: "keep-1",
        transactionAmount: 300,
      }),
    ]);
    const r = await syncFinancialTransactionsBySourceIds(["cb-1", "keep-1"], 7);
    // only the PAYMENT row counts toward total + created
    expect(r.total).toBe(1);
    expect(r.created).toBe(1);
    expect(m.txnCreate).toHaveBeenCalledTimes(1);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.sourceId).toBe("keep-1");
  });

  it("does NOT filter a CASHBACK row that is NOT a settlement (source must match too)", async () => {
    primeSyncScaffold();
    // release source with transactionType CASHBACK → the `&&` requires
    // source==='settlement', so this row is NOT filtered and IS created.
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ source: "release", transactionType: "CASHBACK", sourceId: "rcb-1" }),
    ]);
    const r = await syncFinancialTransactionsBySourceIds(["rcb-1"], 7);
    expect(r.total).toBe(1);
    expect(r.created).toBe(1);
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
    expect(r).toEqual({ created: 0, duplicates: 1, failed: 0, errors: [], total: 1 });
    expect(m.txnCreate).not.toHaveBeenCalled();
    expect(m.txnUpdate).toHaveBeenCalledTimes(1);
    const upd = m.txnUpdate.mock.calls[0]?.[0] as {
      where: { id: number };
      data: Record<string, unknown>;
    };
    // EXACT patch: only counterpartId is set (category unchanged → absent). Kills
    // the mutant that would also emit categoryId, and the where/id mutant.
    expect(upd.where).toEqual({ id: 42 });
    expect(upd.data).toEqual({ counterpartId: 88 });
    // the existing-by-sourceId pre-fetch keys on the trimmed sourceId list
    const findManyCall = m.txnFindMany.mock.calls.find(
      (c) => (c[0] as { where?: { sourceId?: unknown } })?.where?.sourceId !== undefined
    );
    expect(findManyCall?.[0]).toMatchObject({ where: { sourceId: { in: ["dup-1"] } } });
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
    // all 15 fail (counted) but the recorded error list is capped at EXACTLY 10.
    // Kills `errors.length < 10` boundary mutants (< 11, <= 10, etc).
    expect(r.failed).toBe(15);
    expect(r.created).toBe(0);
    expect(r.duplicates).toBe(0);
    expect(r.total).toBe(15);
    expect(r.errors).toHaveLength(10);
    expect(r.errors.every((e) => e === "nope")).toBe(true);
  });

  it("records a non-Error throw as the generic 'Error desconocido' message", async () => {
    primeSyncScaffold();
    // throw a non-Error value → `error instanceof Error ? … : "Error desconocido"`.
    m.txnCreate.mockRejectedValue("string boom");
    mockFetchMergedBySourceIds.mockResolvedValue([unified({ sourceId: "ne-1" })]);
    const r = await syncFinancialTransactionsBySourceIds(["ne-1"], 7);
    expect(r.failed).toBe(1);
    expect(r.errors).toEqual(["Error desconocido"]);
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
    expect(r.created).toBe(0);
    expect(m.txnFindFirst).toHaveBeenCalledTimes(1);
    // the fallback dedupe keys on (date, amount, description) EXACTLY.
    const ff = m.txnFindFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(ff.where).toMatchObject({
      amount: 500,
      date: new Date("2026-05-10T12:00:00Z"),
      description: "Manual",
    });
    expect(m.txnCreate).not.toHaveBeenCalled();
  });

  it("fallback dedupe uses 'Sin descripcion' when the row description is blank", async () => {
    primeSyncScaffold();
    m.txnFindFirst.mockResolvedValue(null); // not found → create path
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: null, transactionAmount: 500, description: "" }),
    ]);
    await syncFinancialTransactionsBySourceIds([], 7);
    const ff = m.txnFindFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    // `tour.description || "Sin descripcion"` — blank falls back.
    expect(ff.where.description).toBe("Sin descripcion");
  });

  it("a NEW row with no sourceId is created after a miss on the fallback dedupe", async () => {
    primeSyncScaffold();
    m.txnFindFirst.mockResolvedValue(null);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: null, transactionAmount: 700, description: "Nuevo manual" }),
    ]);
    const r = await syncFinancialTransactionsBySourceIds([], 7);
    expect(r).toEqual({ created: 1, duplicates: 0, failed: 0, errors: [], total: 1 });
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // no sourceId → create data omits it (undefined)
    expect(created.data.sourceId).toBeUndefined();
    expect(created.data.description).toBe("Nuevo manual");
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

  it("assigns exactly AT the minAmount boundary (ruleAmount < min is strict)", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([ruleRow({ minAmount: 1000, maxAmount: 2000 })]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-2b", transactionAmount: 1000 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["r-2b"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `ruleAmount < minAmount` is strict → 1000 matches. Kills `<` → `<=`.
    expect(created.data.categoryId).toBe(555);
  });

  it("does NOT assign when amount is ABOVE the rule maxAmount (boundary)", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([ruleRow({ minAmount: 1000, maxAmount: 2000 })]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-2c", transactionAmount: 2001 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["r-2c"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBeNull();
  });

  it("assigns exactly AT the maxAmount boundary (ruleAmount > max is strict)", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([ruleRow({ minAmount: 1000, maxAmount: 2000 })]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-2d", transactionAmount: 2000 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["r-2d"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `ruleAmount > maxAmount` is strict → 2000 matches. Kills `>` → `>=`.
    expect(created.data.categoryId).toBe(555);
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

  it("matches amountsExact exactly AT the 0.5 epsilon boundary (<= is inclusive)", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ amountsExact: [1500], minAmount: null, maxAmount: null }),
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-5b", transactionAmount: 1500.5 }), // exactly 0.5 away
    ]);
    await syncFinancialTransactionsBySourceIds(["r-5b"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `diff <= 0.5` inclusive → matches. Kills `<=` → `<`.
    expect(created.data.categoryId).toBe(555);
  });

  it("matches amountsExact on ABSOLUTE value for a negative EXPENSE amount", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ type: "EXPENSE", amountsExact: [1500], minAmount: null, maxAmount: null }),
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "r-5c", transactionAmount: -1500 }), // EXPENSE, |amt|=1500
    ]);
    await syncFinancialTransactionsBySourceIds(["r-5c"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // Math.abs(Math.abs(value) - absoluteAmount) → both abs'd → 0 diff → match.
    expect(created.data.categoryId).toBe(555);
  });

  it("uses the GROSS amount source when the rule matchAmountOn is 'gross'", async () => {
    primeSyncScaffold();
    // Rule matches 1900..2100 on GROSS. The transaction NET is 1000 (outside),
    // but the release ref carries grossAmount 2000 (inside) → match on gross.
    m.ruleFindMany.mockResolvedValue([
      ruleRow({ matchAmountOn: "gross", minAmount: 1900, maxAmount: 2100 }),
    ]);
    // In the create path the gross source comes from the tour's own grossAmount.
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "g-1", transactionAmount: 1000, grossAmount: 2000 }),
    ]);
    await syncFinancialTransactionsBySourceIds(["g-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(555);
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
    expect(created.data.type).toBe("EXPENSE");
    expect(created.data.comment).toBe("Ref: db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17");
  });

  it("personal-dr classification ONLY applies to EXPENSE (an INCOME with the ref is NOT personal-dr)", async () => {
    primeSyncScaffold();
    // Same ref pattern but a POSITIVE amount → type INCOME → the
    // `type === "EXPENSE" && matchesPersonalDrPattern` guard is false.
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        sourceId: "pd-inc-1",
        transactionAmount: 500,
        externalReference: "db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17",
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pd-inc-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // not personal-dr (10), not patients (no keyword), no rule → null.
    expect(created.data.categoryId).toBeNull();
    expect(created.data.type).toBe("INCOME");
  });

  it("personal-dr system category WINS over a generic auto-rule for the same EXPENSE", async () => {
    primeSyncScaffold();
    // An active auto-rule that WOULD assign 555 to this EXPENSE…
    m.ruleFindMany.mockResolvedValue([
      {
        amountsExact: [],
        categoryId: 555,
        commentContains: null,
        counterpartId: null,
        descriptionContains: null,
        matchAmountOn: "net",
        maxAmount: null,
        minAmount: -1000,
        paymentMethods: [],
        priority: 1,
        type: "EXPENSE",
      },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        sourceId: "pd-prec-1",
        transactionAmount: -500,
        externalReference: "db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17",
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pd-prec-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // personalDrCategoryId (10) takes precedence over the rule category (555).
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
    expect(created.data.type).toBe("INCOME");
  });

  it("matches the patients keyword via a release saleDetail (not just description)", async () => {
    primeSyncScaffold();
    // description has NO keyword; the keyword lives in the release saleDetail
    // which is merged into the matched values for the patients check.
    m.releaseFindMany.mockResolvedValue([
      {
        sourceId: "pt-2",
        grossAmount: null,
        paymentMethodType: null,
        saleDetail: "Consulta paciente",
      },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "pt-2", transactionAmount: 800, description: "Transferencia" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pt-2"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(10);
  });

  it("matches the patients keyword ignoring accents (diacritics-insensitive)", async () => {
    primeSyncScaffold();
    // "PACIÉNTE" with an accent normalizes to "paciente" and matches.
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "pt-3", transactionAmount: 800, description: "Pago PACIÉNTE" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pt-3"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.categoryId).toBe(10);
  });

  it("an EXPENSE mentioning 'paciente' is NOT patients (patients is INCOME-only)", async () => {
    primeSyncScaffold();
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "pt-exp", transactionAmount: -800, description: "Reembolso paciente" }),
    ]);
    await syncFinancialTransactionsBySourceIds(["pt-exp"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `type === "INCOME" && matchesPatientsPattern` → false for EXPENSE.
    expect(created.data.categoryId).toBeNull();
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
    // the withdraw lookup is keyed by withdrawId == the release sourceId, and the
    // recovered RUT normalizes to the same key as the counterpart's RUT.
    expect(m.withdrawFindMany).toHaveBeenCalledTimes(1);
  });

  it("prefers the withdraw-recovered RUT over the release row's own identificationNumber", async () => {
    primeSyncScaffold();
    // counterpart 95 matches the WITHDRAW rut; counterpart 96 matches the RELEASE
    // rut. The withdraw rut takes precedence → 95.
    m.counterpartFindMany.mockResolvedValue([
      { id: 95, identificationNumber: "5-5", accounts: [] },
      { id: 96, identificationNumber: "6-6", accounts: [] },
    ]);
    m.withdrawFindMany.mockResolvedValue([
      { withdrawId: "rel-pref", identificationNumber: "5-5", bankAccountNumber: null },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        source: "release",
        sourceId: "rel-pref",
        transactionAmount: 700,
        identificationNumber: "6-6",
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["rel-pref"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.counterpartId).toBe(95);
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

  it("resolves a release-source counterpart by ACCOUNT when RUT lookup misses", async () => {
    primeSyncScaffold();
    // counterpart known only by account number; no RUT match.
    m.counterpartFindMany.mockResolvedValue([
      { id: 93, identificationNumber: null, accounts: [{ accountNumber: "0009988" }] },
    ]);
    // withdraw carries the bank account number for the release sourceId.
    m.withdrawFindMany.mockResolvedValue([
      { withdrawId: "rel-acc-1", identificationNumber: null, bankAccountNumber: "9988" },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        source: "release",
        sourceId: "rel-acc-1",
        transactionAmount: 700,
        bankAccountNumber: null,
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["rel-acc-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.counterpartId).toBe(93);
  });

  it("returns null counterpart when neither RUT nor account matches", async () => {
    primeSyncScaffold();
    m.counterpartFindMany.mockResolvedValue([
      { id: 94, identificationNumber: "1-9", accounts: [{ accountNumber: "111" }] },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({
        source: "settlement",
        transactionType: "PAYMENT",
        sourceId: "nomatch-1",
        transactionAmount: 700,
        identificationNumber: "99-9",
        bankAccountNumber: "222",
      }),
    ]);
    await syncFinancialTransactionsBySourceIds(["nomatch-1"], 7);
    const created = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(created.data.counterpartId).toBeNull();
  });
});

// ─── duplicate patch: system category on an existing EXPENSE ───────────────────

describe("syncFinancialTransactionsBySourceIds — existing-row category patch", () => {
  it("patches an existing EXPENSE duplicate to the personal-dr category", async () => {
    primeSyncScaffold();
    // existing row is an EXPENSE whose comment matches the personal-dr regex and
    // is currently uncategorized → the duplicate branch sets categoryId = 10.
    m.txnFindMany.mockResolvedValue([
      {
        id: 60,
        amount: new Decimal(-500),
        categoryId: null,
        comment: "ref: db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17",
        counterpartId: null,
        description: "Pago",
        sourceId: "dup-pd",
        type: "EXPENSE",
      },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "dup-pd", transactionAmount: -500 }),
    ]);
    const r = await syncFinancialTransactionsBySourceIds(["dup-pd"], 7);
    expect(r.duplicates).toBe(1);
    expect(m.txnUpdate).toHaveBeenCalledTimes(1);
    const upd = m.txnUpdate.mock.calls[0]?.[0] as {
      where: { id: number };
      data: Record<string, unknown>;
    };
    expect(upd.where).toEqual({ id: 60 });
    expect(upd.data).toEqual({ categoryId: 10 });
  });

  it("does NOT re-patch when the existing category already equals the target", async () => {
    primeSyncScaffold();
    m.txnFindMany.mockResolvedValue([
      {
        id: 61,
        amount: new Decimal(-500),
        categoryId: 10, // already the personal-dr category
        comment: "ref: db4b64d0-a31f-4622-9f7b-ec28f54ab6e8-17",
        counterpartId: null,
        description: "Pago",
        sourceId: "dup-pd2",
        type: "EXPENSE",
      },
    ]);
    mockFetchMergedBySourceIds.mockResolvedValue([
      unified({ sourceId: "dup-pd2", transactionAmount: -500 }),
    ]);
    const r = await syncFinancialTransactionsBySourceIds(["dup-pd2"], 7);
    expect(r.duplicates).toBe(1);
    // existing.categoryId === nextSystemCategoryId → no-op, no update.
    expect(m.txnUpdate).not.toHaveBeenCalled();
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
    expect(args.data).toEqual({ categoryId: 777 });
    expect(args.where.type).toBe("EXPENSE");
    // onlyUncategorized NOT set on the global pass → categoryId { not: 777 } guard.
    expect(args.where.categoryId).toEqual({ not: 777 });
    // net min/max → amount gte 100 / lte 5000 (kills the bound-direction mutants).
    expect(args.where.amount).toEqual({ gte: 100, lte: 5000 });
    // the global pass also runs the two pattern $executeRaw passes.
    expect(m.executeRaw).toHaveBeenCalled();
  });

  it("uses categoryId:null guard on the rule pass when onlyUncategorized is set", async () => {
    primeSyncScaffold();
    m.ruleFindMany.mockResolvedValue([
      {
        amountsExact: [],
        categoryId: 888,
        commentContains: null,
        counterpartId: 3,
        descriptionContains: null,
        matchAmountOn: "net",
        maxAmount: null,
        minAmount: null,
        paymentMethods: [],
        priority: 1,
        type: "INCOME",
      },
    ]);
    m.txnUpdateMany.mockResolvedValue({ count: 2 });
    m.executeRaw.mockResolvedValue(0);

    await syncUncategorizedTransactionsByPatterns();

    const call = m.txnUpdateMany.mock.calls.find(
      (c) => (c[0] as { data?: { categoryId?: number } })?.data?.categoryId === 888
    );
    const args = call?.[0] as { where: Record<string, unknown> };
    // onlyUncategorized → categoryId: null (NOT the { not } guard).
    expect(args.where.categoryId).toBeNull();
    // counterpartId is forwarded into the where when the rule pins it.
    expect(args.where.counterpartId).toBe(3);
    expect(args.where.type).toBe("INCOME");
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

  it("includes the rule-pass count in the sum (distinct addends prove all three terms add)", async () => {
    primeSyncScaffold();
    // one active net rule → updateMany returns 5; personal=3, patients=4.
    m.ruleFindMany.mockResolvedValue([
      {
        amountsExact: [],
        categoryId: 200,
        commentContains: null,
        counterpartId: null,
        descriptionContains: null,
        matchAmountOn: "net",
        maxAmount: null,
        minAmount: null,
        paymentMethods: [],
        priority: 1,
        type: "INCOME",
      },
    ]);
    // the ensure* scaffold also calls updateMany; pin the rule-pass result via
    // mockResolvedValue so every updateMany returns count 5 → rule pass = 5.
    m.txnUpdateMany.mockResolvedValue({ count: 5 });
    m.executeRaw.mockReset();
    m.executeRaw.mockResolvedValueOnce(3).mockResolvedValueOnce(4);

    const r = await syncUncategorizedTransactionsByPatterns();
    // rules(5) + personal(3) + patients(4) = 12. A mutant dropping the rule
    // term → 7, dropping personal → 9, dropping patients → 8 — all distinct.
    expect(r.updated).toBe(12);
  });
});

// ─── listAvailableFinancialTransactionMonths ───────────────────────────────────

describe("listAvailableFinancialTransactionMonths", () => {
  it("maps the month column and filters out empty values", async () => {
    m.queryRaw.mockResolvedValue([{ month: "2026-05" }, { month: "2026-04" }, { month: "" }]);
    const r = await listAvailableFinancialTransactionMonths();
    // empty string is falsy → dropped by .filter(Boolean); order preserved.
    expect(r).toEqual(["2026-05", "2026-04"]);
  });

  it("returns an empty array when no rows", async () => {
    m.queryRaw.mockResolvedValue([]);
    const r = await listAvailableFinancialTransactionMonths();
    expect(r).toEqual([]);
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
    expect(args.data.date).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("forwards null category/counterpart and omitted comment as-is (no default coercion)", async () => {
    m.txnCreate.mockResolvedValue({ id: 2 });
    await createFinancialTransaction({
      date: new Date("2026-06-01T00:00:00Z"),
      description: "Bare",
      amount: -50,
      type: "EXPENSE",
      categoryId: null,
      counterpartId: null,
    });
    const args = m.txnCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.categoryId).toBeNull();
    expect(args.data.counterpartId).toBeNull();
    expect(args.data.comment).toBeUndefined();
    expect(args.data.sourceId).toBeUndefined();
    expect(Number(args.data.amount as Decimal)).toBe(-50);
    expect(args.data.type).toBe("EXPENSE");
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
      oldRow: Record<string, unknown>;
      newRow: Record<string, unknown>;
      fields: string[];
    };
    expect(audit.resourceId).toBe(5);
    expect(audit.kind).toBe("FINANCIAL_CHANGE");
    expect(audit.resource).toBe("financial_transaction");
    // the exact audited field list — kills array-literal mutants on `fields`.
    expect(audit.fields).toEqual([
      "amount",
      "type",
      "categoryId",
      "counterpartId",
      "description",
      "date",
    ]);
    // oldRow = the before snapshot, newRow = the updated row.
    expect(audit.oldRow?.description).toBe("old");
    expect(audit.newRow).toMatchObject({ id: 5, description: "new" });
  });

  it("passes a null oldRow through to the audit when the row did not pre-exist", async () => {
    m.txnFindUnique.mockResolvedValue(null); // no before snapshot
    m.txnUpdate.mockResolvedValue({ id: 6 });
    await updateFinancialTransaction(6, { categoryId: 4 });
    const args = m.txnUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.categoryId).toBe(4);
    const audit = mockAuditRowChange.mock.calls[0]?.[0] as { oldRow: unknown };
    expect(audit.oldRow).toBeNull();
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

    await createTransactionCategory({
      name: "  Nueva   Cat  ",
      isNonAccountable: true,
      color: "#ABCDEF",
    });
    const args = m.categoryCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // collapses internal whitespace runs to a single space + trims.
    expect(args.data.name).toBe("Nueva Cat");
    expect(args.data.icon).toBe("NON_ACCOUNTABLE");
    expect(args.data.color).toBe("#ABCDEF");
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
    expect(Number((createArgs.data.amountsExact as Decimal[])[0])).toBe(100);
    expect(createArgs.data.isActive).toBe(true); // default
    expect(createArgs.data.priority).toBe(0); // default
    expect(createArgs.data.paymentMethods).toEqual([]); // default
    expect(createArgs.data.matchAmountOn).toBe("net"); // normalizeMatchAmountOn(undefined)
    expect(createArgs.data.minAmount).toBeNull(); // not provided → null
    expect(createArgs.data.maxAmount).toBeNull();
    expect(createArgs.data.commentContains).toBeNull();
    expect(createArgs.data.counterpartId).toBeNull();
  });

  it("forwards EXPLICIT optionals and wraps min/max in Decimal", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 5 });
    m.ruleCreate.mockResolvedValue({
      id: 31,
      amountsExact: [],
      categoryId: 5,
      commentContains: "kw",
      counterpartId: 8,
      descriptionContains: "desc",
      isActive: false,
      matchAmountOn: "gross",
      maxAmount: new Decimal(900),
      minAmount: new Decimal(100),
      name: "R2",
      paymentMethods: ["visa"],
      priority: 50,
      type: "INCOME",
      category: { color: "#fff", icon: null, id: 5, name: "Cat" },
      counterpart: null,
    });
    m.ruleFindUnique.mockResolvedValue({
      id: 31,
      amountsExact: [],
      categoryId: 5,
      commentContains: "kw",
      counterpartId: 8,
      descriptionContains: "desc",
      isActive: false, // inactive → applySingleAutoCategoryRule no-ops
      matchAmountOn: "gross",
      maxAmount: new Decimal(900),
      minAmount: new Decimal(100),
      paymentMethods: ["visa"],
      priority: 50,
      type: "INCOME",
    });

    await createFinancialAutoCategoryRule({
      categoryId: 5,
      name: "R2",
      type: "INCOME",
      commentContains: "kw",
      counterpartId: 8,
      descriptionContains: "desc",
      isActive: false,
      matchAmountOn: "gross",
      minAmount: 100,
      maxAmount: 900,
      paymentMethods: ["visa"],
      priority: 50,
    });

    const data = (m.ruleCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.commentContains).toBe("kw");
    expect(data.counterpartId).toBe(8);
    expect(data.descriptionContains).toBe("desc");
    expect(data.isActive).toBe(false);
    expect(data.matchAmountOn).toBe("gross");
    expect(data.priority).toBe(50);
    expect(data.paymentMethods).toEqual(["visa"]);
    expect(Number(data.minAmount as Decimal)).toBe(100);
    expect(Number(data.maxAmount as Decimal)).toBe(900);
    expect(data.name).toBe("R2");
    expect(data.type).toBe("INCOME");
    // inactive rule → no historical apply (applySingleAutoCategoryRule returns early)
    expect(m.txnUpdateMany).not.toHaveBeenCalled();
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
  it("maps $qb join rows: counterpart null when no counterpartId, defaults string fields", async () => {
    m.qbRows.mockReturnValue([
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
    // ORM create → { id }; then getCompensationProfileById ($qb) → row.
    m.profileCreate.mockResolvedValue({ id: 77 });
    m.qbRows.mockReturnValue([
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
    // create() received the trimmed name + defaults in its data payload.
    const createData = (m.profileCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(createData.name).toBe("Perfil"); // trimmed
    expect(createData.categoryId).toBe(5);
    expect(createData.counterpartId).toBeNull(); // default
    expect(createData.isActive).toBe(true); // default
    expect(createData.timezone).toBe("America/Santiago"); // default
  });

  it("uses a provided non-blank timezone instead of the default", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 5 });
    m.profileCreate.mockResolvedValue({ id: 78 });
    m.qbRows.mockReturnValue([
      {
        id: 78,
        name: "P",
        isActive: false,
        timezone: "UTC",
        categoryId: 5,
        categoryName: "Cat",
        counterpartId: null,
        counterpartBankAccountHolder: null,
        counterpartIdentificationNumber: null,
      },
    ]);
    await createCompensationProfile({
      categoryId: 5,
      name: "P",
      timezone: "  UTC  ",
      isActive: false,
    });
    const createData = (m.profileCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    // trimmed timezone; isActive false (not the default true).
    expect(createData.timezone).toBe("UTC");
    expect(createData.isActive).toBe(false);
  });

  it("throws when the INSERT returns no id", async () => {
    m.categoryFindUnique.mockResolvedValue({ id: 5 });
    m.profileCreate.mockResolvedValue(undefined); // no created row
    await expect(createCompensationProfile({ categoryId: 5, name: "P" })).rejects.toThrow(
      "No se pudo crear el perfil de compensación"
    );
  });
});

// ─── updateCompensationProfile happy path ──────────────────────────────────────

describe("updateCompensationProfile happy path", () => {
  it("updates an existing profile and re-reads it", async () => {
    // no categoryId/counterpartId guards. findUnique → existing, then ORM
    // update(), then getCompensationProfileById ($qb) → row.
    m.profileFindUnique.mockResolvedValue({ id: 1 });
    m.profileUpdate.mockResolvedValue({ id: 1 });
    m.qbRows.mockReturnValue([
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

    const r = await updateCompensationProfile(1, { name: "New" });
    expect(r.name).toBe("New");
    expect(r.id).toBe(1);
    expect(r.category).toEqual({ id: 5, name: "Cat" });
    expect(r.counterpart).toBeNull();
    expect(m.profileUpdate).toHaveBeenCalledTimes(1);
    // only name was provided → update data carries name and nothing else.
    const updateData = (m.profileUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(updateData.name).toBe("New");
    expect("counterpartId" in updateData).toBe(false);
    expect("categoryId" in updateData).toBe(false);
  });
});

// ─── upsertCompensationPeriodBudget happy path ─────────────────────────────────

describe("upsertCompensationPeriodBudget happy path", () => {
  it("upserts and returns the persisted budget row", async () => {
    m.profileFindUnique.mockResolvedValue({ id: 1 }); // profile exists (ORM)
    // INSERT … ON CONFLICT … RETURNING stays raw (bucket-D upsert).
    m.queryRaw.mockResolvedValueOnce([
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
    // the period bound into the upsert insert
    const insertCall = m.queryRaw.mock.calls[0] as unknown[];
    expect(insertCall).toContain("2026-01");
    // isLocked defaults to false (the `?? false` fallback) and the baseAmount is
    // wrapped in a Decimal bound value.
    expect(insertCall).toContain(false);
    const baseAmountBind = insertCall.find((v) => v instanceof Decimal) as Decimal | undefined;
    expect(baseAmountBind).toBeInstanceOf(Decimal);
    expect(Number(baseAmountBind)).toBe(1000);
  });

  it("binds isLocked true when provided", async () => {
    m.profileFindUnique.mockResolvedValue({ id: 1 });
    m.queryRaw.mockResolvedValueOnce([
      { id: 51, profileId: 1, period: "2026-02", baseAmount: 2000, isLocked: true },
    ]);
    const r = await upsertCompensationPeriodBudget(1, {
      baseAmount: 2000,
      period: "2026-02",
      isLocked: true,
    });
    expect(r.isLocked).toBe(true);
    const insertCall = m.queryRaw.mock.calls[0] as unknown[];
    expect(insertCall).toContain(true);
  });

  it("rejects an invalid period before touching the DB", async () => {
    await expect(
      upsertCompensationPeriodBudget(1, { baseAmount: 1000, period: "2026-13" })
    ).rejects.toThrow();
    expect(m.queryRaw).not.toHaveBeenCalled();
    expect(m.profileFindUnique).not.toHaveBeenCalled();
  });
});
