import { Decimal } from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fourth mutation-driven suite for services/finance.ts. This file targets the
// ENRICHMENT survivors the prior three passes leave loose:
//
//   1. listFinancialTransactions enrichment — the release/settlement field
//      mapping, the counterpartAccountNumber `??` fallback chain (release →
//      counterpart.accounts[0] → null), the cashback-NOT filter wiring, the
//      category-id `if (params.categoryId)` / type / search where-builder, and
//      the effectivePeriod no-allocations id list.
//   2. getFinancialSummaryByCategory — non-accountable category exclusion, the
//      categoryName "Sin categoría" fallback, the categoryColor `?? null`, and
//      the cashback source-id NOT filter.
//
// Mock style mirrors finance.test.ts (vi.hoisted mockDb + @finanzas/db +
// /slices). $queryRaw is a FIFO recorder so the effectivePeriod path's two
// queries resolve in order.

const { mockDb, m } = vi.hoisted(() => {
  const mk = () => vi.fn();
  const m = {
    settlementFindMany: mk(),
    categoryFindMany: mk(),
    txnGroupBy: mk(),
    txnCount: mk(),
    txnFindMany: mk(),
    releaseFindMany: mk(),
    withdrawFindMany: mk(),
    allocationFindMany: mk(),
    queryRaw: mk(),
  };
  const mockDb = {
    settlementTransaction: { findMany: (...a: unknown[]) => m.settlementFindMany(...a) },
    transactionCategory: { findMany: (...a: unknown[]) => m.categoryFindMany(...a) },
    financialTransaction: {
      groupBy: (...a: unknown[]) => m.txnGroupBy(...a),
      count: (...a: unknown[]) => m.txnCount(...a),
      findMany: (...a: unknown[]) => m.txnFindMany(...a),
    },
    releaseTransaction: { findMany: (...a: unknown[]) => m.releaseFindMany(...a) },
    withdrawTransaction: { findMany: (...a: unknown[]) => m.withdrawFindMany(...a) },
    financialTransactionAllocation: { findMany: (...a: unknown[]) => m.allocationFindMany(...a) },
    $queryRaw: (...a: unknown[]) => m.queryRaw(...a),
    $setOptions: () => mockDb,
  };
  return { mockDb, m };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listFinancialTransactions, getFinancialSummaryByCategory } = await import("../finance.ts");

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── listFinancialTransactions enrichment ──────────────────────────────────────

describe("listFinancialTransactions enrichment", () => {
  it("maps release, settlement, withdraw, and linked counterpart detail fields onto the row", async () => {
    m.settlementFindMany
      // 1st call: cashback source ids → [] (no NOT filter)
      .mockResolvedValueOnce([])
      // 2nd call: settlement enrichment rows
      .mockResolvedValueOnce([
        {
          sourceId: "s1",
          paymentMethod: "card",
          paymentMethodType: "credit_card",
          saleDetail: "set-detail",
        },
      ]);
    m.txnCount.mockResolvedValue(1);
    m.txnFindMany.mockResolvedValue([
      {
        id: 1,
        amount: new Decimal(1000),
        sourceId: "s1",
        counterpart: { accounts: [{ accountNumber: "CP-ACC" }] },
      },
    ]);
    m.releaseFindMany.mockResolvedValue([
      {
        sourceId: "s1",
        balanceAmount: new Decimal(42),
        paymentMethod: "rel-pm",
        payoutBankAccountNumber: "REL-ACC",
        saleDetail: "rel-detail",
      },
    ]);
    m.withdrawFindMany.mockResolvedValue([
      {
        withdrawId: "s1",
        bankAccountHolder: "Official Holder",
        bankAccountNumber: "WT-ACC",
        bankAccountType: "checking_account",
        bankName: "Official Bank",
        identificationNumber: "111111111",
      },
    ]);
    m.allocationFindMany.mockResolvedValue([]);

    const res = await listFinancialTransactions({});
    const row = res.data[0];
    // release payout account WINS over counterpart.accounts[0] (?? chain order).
    expect(row?.counterpartAccountNumber).toBe("REL-ACC");
    expect(row?.counterpartLinkedAccountNumber).toBe("CP-ACC");
    expect(row?.releaseBalanceAmount).toEqual(new Decimal(42));
    expect(row?.releasePaymentMethod).toBe("rel-pm");
    expect(row?.releaseSaleDetail).toBe("rel-detail");
    expect(row?.settlementPaymentMethod).toBe("card");
    expect(row?.settlementPaymentMethodType).toBe("credit_card");
    expect(row?.settlementSaleDetail).toBe("set-detail");
    expect(row?.withdrawBankAccountHolder).toBe("Official Holder");
    expect(row?.withdrawBankAccountNumber).toBe("WT-ACC");
    expect(row?.withdrawBankAccountType).toBe("checking_account");
    expect(row?.withdrawBankName).toBe("Official Bank");
    expect(row?.withdrawIdentificationNumber).toBe("111111111");
  });

  it("falls back to the counterpart account when there is no release payout account", async () => {
    m.settlementFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.txnCount.mockResolvedValue(1);
    m.txnFindMany.mockResolvedValue([
      {
        id: 2,
        amount: new Decimal(500),
        sourceId: "s2",
        counterpart: { accounts: [{ accountNumber: "CP-ONLY" }] },
      },
    ]);
    // release row exists but its payout account is null → fall through.
    m.releaseFindMany.mockResolvedValue([
      {
        sourceId: "s2",
        balanceAmount: null,
        paymentMethod: null,
        payoutBankAccountNumber: null,
        saleDetail: null,
      },
    ]);
    m.withdrawFindMany.mockResolvedValue([]);
    m.allocationFindMany.mockResolvedValue([]);

    const res = await listFinancialTransactions({});
    expect(res.data[0]?.counterpartAccountNumber).toBe("CP-ONLY");
  });

  it("yields a null counterpart account when neither release nor counterpart provides one", async () => {
    m.settlementFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.txnCount.mockResolvedValue(1);
    m.txnFindMany.mockResolvedValue([
      { id: 3, amount: new Decimal(500), sourceId: null, counterpart: null },
    ]);
    m.releaseFindMany.mockResolvedValue([]);
    m.withdrawFindMany.mockResolvedValue([]);
    m.allocationFindMany.mockResolvedValue([]);

    const res = await listFinancialTransactions({});
    expect(res.data[0]?.counterpartAccountNumber).toBeNull();
  });

  it("adds a NOT-filter excluding cashback settlement source ids", async () => {
    // first settlement call returns cashback source ids → NOT filter is built.
    m.settlementFindMany
      .mockResolvedValueOnce([{ sourceId: "cb-x" }, { sourceId: "cb-y" }])
      .mockResolvedValueOnce([]);
    m.txnCount.mockResolvedValue(0);
    m.txnFindMany.mockResolvedValue([]);
    m.releaseFindMany.mockResolvedValue([]);
    m.withdrawFindMany.mockResolvedValue([]);
    m.allocationFindMany.mockResolvedValue([]);

    await listFinancialTransactions({});
    // the count + findMany where carries NOT: [{ sourceId: { in: [...] } }].
    const countArgs = m.txnCount.mock.calls[0]?.[0] as { where: { NOT?: unknown } };
    expect(countArgs.where.NOT).toEqual([{ sourceId: { in: ["cb-x", "cb-y"] } }]);
  });

  it("builds the categoryId / type / search where clause exactly", async () => {
    m.settlementFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.txnCount.mockResolvedValue(0);
    m.txnFindMany.mockResolvedValue([]);
    m.releaseFindMany.mockResolvedValue([]);
    m.withdrawFindMany.mockResolvedValue([]);
    m.allocationFindMany.mockResolvedValue([]);

    await listFinancialTransactions({
      categoryId: 9,
      type: "EXPENSE",
      search: "abc",
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-31T00:00:00Z"),
    });
    const where = (m.txnCount.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where.categoryId).toBe(9);
    expect(where.type).toBe("EXPENSE");
    expect(where.date).toEqual({
      gte: new Date("2026-01-01T00:00:00Z"),
      lte: new Date("2026-01-31T00:00:00Z"),
    });
    // search → OR over description + comment, both case-insensitive contains.
    expect(where.OR).toEqual([
      { description: { contains: "abc", mode: "insensitive" } },
      { comment: { contains: "abc", mode: "insensitive" } },
    ]);
  });

  it("paginates with the exact skip/take and orderBy date desc", async () => {
    m.settlementFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.txnCount.mockResolvedValue(0);
    m.txnFindMany.mockResolvedValue([]);
    m.releaseFindMany.mockResolvedValue([]);
    m.withdrawFindMany.mockResolvedValue([]);
    m.allocationFindMany.mockResolvedValue([]);

    await listFinancialTransactions({ page: 3, pageSize: 20 });
    const args = m.txnFindMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
      orderBy: unknown;
    };
    // skip = (page-1)*pageSize = 40; take = pageSize = 20.
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(args.orderBy).toEqual({ date: "desc" });
  });

  it("falls back to id list [-1] when an effectivePeriod has no matching transactions", async () => {
    m.settlementFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.txnCount.mockResolvedValue(0);
    m.txnFindMany.mockResolvedValue([]);
    m.releaseFindMany.mockResolvedValue([]);
    m.withdrawFindMany.mockResolvedValue([]);
    m.allocationFindMany.mockResolvedValue([]);
    // effectivePeriod path: periodAllocations → [], no-allocation txns → [].
    m.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await listFinancialTransactions({ effectivePeriod: "2026-02" });
    const where = (m.txnCount.mock.calls[0]?.[0] as { where: { AND?: Array<{ id: unknown }> } })
      .where;
    // empty id set → the [-1] sentinel so the query matches nothing.
    expect(where.AND?.[0]?.id).toEqual({ in: [-1] });
  });
});

// ─── getFinancialSummaryByCategory exclusions + fallbacks ──────────────────────

describe("getFinancialSummaryByCategory exclusions", () => {
  it("excludes non-accountable categories via the NOT filter", async () => {
    // 1st settlement call: cashback ids → [] (no cashback NOT).
    m.settlementFindMany.mockResolvedValue([]);
    // getNonAccountableCategoryIds → category findMany (icon) returns ids.
    m.categoryFindMany
      .mockResolvedValueOnce([{ id: 100 }, { id: 101 }]) // non-accountable ids
      .mockResolvedValueOnce([]); // category metadata lookup
    m.txnGroupBy.mockResolvedValue([]);

    await getFinancialSummaryByCategory({});
    const where = (m.txnGroupBy.mock.calls[0]?.[0] as { where: { NOT?: unknown } }).where;
    expect(where.NOT).toEqual([{ categoryId: { in: [100, 101] } }]);
  });

  it("labels an uncategorized group 'Sin categoría' and null color", async () => {
    m.settlementFindMany.mockResolvedValue([]);
    m.categoryFindMany
      .mockResolvedValueOnce([]) // non-accountable ids
      .mockResolvedValueOnce([]); // category metadata
    m.txnGroupBy.mockResolvedValue([
      { categoryId: null, type: "INCOME", _count: { _all: 2 }, _sum: { amount: 500 } },
    ]);

    const res = await getFinancialSummaryByCategory({});
    expect(res.byCategory[0]?.categoryName).toBe("Sin categoría");
    expect(res.byCategory[0]?.categoryColor).toBeNull();
    expect(res.byCategory[0]?.count).toBe(2);
    expect(res.byCategory[0]?.total).toBe(500);
  });

  it("uses category metadata color/name when the group has a known category", async () => {
    m.settlementFindMany.mockResolvedValue([]);
    m.categoryFindMany
      .mockResolvedValueOnce([]) // non-accountable ids
      .mockResolvedValueOnce([{ id: 7, color: "#123456", name: "Arriendo" }]); // metadata
    m.txnGroupBy.mockResolvedValue([
      { categoryId: 7, type: "EXPENSE", _count: { _all: 1 }, _sum: { amount: -300 } },
    ]);

    const res = await getFinancialSummaryByCategory({});
    expect(res.byCategory[0]?.categoryName).toBe("Arriendo");
    expect(res.byCategory[0]?.categoryColor).toBe("#123456");
    // EXPENSE total is abs'd.
    expect(res.byCategory[0]?.total).toBe(300);
    expect(res.totals.expense).toBe(300);
  });
});
