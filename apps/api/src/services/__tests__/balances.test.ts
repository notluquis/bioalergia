import { describe, expect, it, vi } from "vitest";

// getBalancesReport reads db.dailyBalance (findFirst/findMany),
// db.settlementTransaction.findMany, db.releaseTransaction.findMany. Mock
// @finanzas/db (+ slices per repo rule). Tx dates use midday-UTC so they
// format to the same calendar day in both UTC (CI) and America/Santiago.

const at = (d: string) => new Date(`${d}T12:00:00Z`);

const {
  mockDb,
  mockDailyFindFirst,
  mockDailyFindMany,
  mockSettlementFindMany,
  mockReleaseFindMany,
} = vi.hoisted(() => {
  const mockDailyFindFirst = vi.fn();
  const mockDailyFindMany = vi.fn();
  const mockSettlementFindMany = vi.fn();
  const mockReleaseFindMany = vi.fn();
  const mockDb = {
    dailyBalance: {
      findFirst: (...a: unknown[]) => mockDailyFindFirst(...a),
      findMany: (...a: unknown[]) => mockDailyFindMany(...a),
    },
    settlementTransaction: { findMany: (...a: unknown[]) => mockSettlementFindMany(...a) },
    releaseTransaction: { findMany: (...a: unknown[]) => mockReleaseFindMany(...a) },
  };
  return {
    mockDb,
    mockDailyFindFirst,
    mockDailyFindMany,
    mockSettlementFindMany,
    mockReleaseFindMany,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { getBalancesReport } = await import("../balances.ts");

function setup(opts: {
  previous?: { amount: number; date: Date } | null;
  settlements?: { transactionDate: Date; transactionAmount: number }[];
  releases?: {
    date: Date;
    grossAmount?: number;
    netCreditAmount?: number;
    netDebitAmount?: number;
  }[];
  existing?: { date: Date; amount: number; note?: string }[];
}) {
  mockDailyFindFirst.mockResolvedValue(opts.previous ?? null);
  mockSettlementFindMany.mockResolvedValue(opts.settlements ?? []);
  mockReleaseFindMany.mockResolvedValue(opts.releases ?? []);
  mockDailyFindMany.mockResolvedValue(opts.existing ?? []);
}

describe("getBalancesReport", () => {
  it("produces one record per day in [from,to] inclusive", async () => {
    setup({});
    const res = await getBalancesReport("2026-03-01", "2026-03-03");
    expect(res.days.map((d) => d.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("splits in/out by sign, sums netChange and carries the running balance", async () => {
    setup({
      settlements: [
        { transactionDate: at("2026-03-01"), transactionAmount: 100 },
        { transactionDate: at("2026-03-02"), transactionAmount: -30 },
      ],
      releases: [{ date: at("2026-03-01"), grossAmount: 50, netCreditAmount: 0, netDebitAmount: 0 }],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-03");

    expect(res.days[0]).toMatchObject({ totalIn: 150, totalOut: 0, netChange: 150, expectedBalance: 150 });
    expect(res.days[1]).toMatchObject({ totalIn: 0, totalOut: 30, netChange: -30, expectedBalance: 120 });
    // No movement day 3 → carries 120 forward.
    expect(res.days[2]).toMatchObject({ netChange: 0, expectedBalance: 120 });
  });

  it("seeds the running balance from the previous day", async () => {
    setup({ previous: { amount: 1000, date: at("2026-02-28") } });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].expectedBalance).toBe(1000);
    expect(res.previous).toEqual({ date: "2026-02-28", balance: 1000 });
  });

  it("computes difference vs recorded and reconciles the running balance to it", async () => {
    setup({
      settlements: [{ transactionDate: at("2026-03-01"), transactionAmount: 100 }],
      existing: [{ date: at("2026-03-01"), amount: 200, note: "ajuste caja" }],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-02");
    // expected = 0 + 100 = 100; recorded 200 → difference +100; note carried.
    expect(res.days[0]).toMatchObject({
      expectedBalance: 100,
      recordedBalance: 200,
      difference: 100,
      note: "ajuste caja",
    });
    // Day 2 running seeded from RECORDED 200 (not expected 100).
    expect(res.days[1].expectedBalance).toBe(200);
  });

  it("uses release net credit−debit when present, else grossAmount", async () => {
    setup({
      releases: [
        { date: at("2026-03-01"), grossAmount: 999, netCreditAmount: 80, netDebitAmount: 20 },
        { date: at("2026-03-02"), grossAmount: 50, netCreditAmount: 0, netDebitAmount: 0 },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-02");
    expect(res.days[0].totalIn).toBe(60); // 80 - 20 (gross 999 ignored)
    expect(res.days[1].totalIn).toBe(50); // credit/debit 0 → gross fallback
  });

  it("returns null previous and zeroed days when there is no data", async () => {
    setup({});
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.previous).toBeNull();
    expect(res.days[0]).toMatchObject({ totalIn: 0, totalOut: 0, recordedBalance: null, difference: null });
  });
});
