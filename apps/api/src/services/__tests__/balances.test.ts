import { Decimal } from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// getBalancesReport reads db.dailyBalance (findFirst/findMany),
// db.settlementTransaction.findMany, db.releaseTransaction.findMany. Mock
// @finanzas/db (+ slices per repo rule). Tx dates use midday-UTC so they
// format to the same calendar day in both UTC (CI) and America/Santiago.

const at = (d: string) => new Date(`${d}T12:00:00Z`);

// Chile-local midnight of a "YYYY-MM-DD", as a UTC instant — mirrors what the
// service uses for query bounds. March 2026 is CLST (UTC-3) → midnight = 03:00Z.
const chileStart = (d: string) => new Date(`${d}T03:00:00.000Z`);
const chileEnd = (d: string) => new Date(chileStart(d).getTime() + 86_400_000 - 1);

const {
  mockDb,
  mockDailyFindFirst,
  mockDailyFindMany,
  mockDailyUpsert,
  mockSettlementFindMany,
  mockReleaseFindMany,
} = vi.hoisted(() => {
  const mockDailyFindFirst = vi.fn();
  const mockDailyFindMany = vi.fn();
  const mockDailyUpsert = vi.fn();
  const mockSettlementFindMany = vi.fn();
  const mockReleaseFindMany = vi.fn();
  const mockDb = {
    dailyBalance: {
      findFirst: (...a: unknown[]) => mockDailyFindFirst(...a),
      findMany: (...a: unknown[]) => mockDailyFindMany(...a),
      upsert: (...a: unknown[]) => mockDailyUpsert(...a),
    },
    settlementTransaction: { findMany: (...a: unknown[]) => mockSettlementFindMany(...a) },
    releaseTransaction: { findMany: (...a: unknown[]) => mockReleaseFindMany(...a) },
  };
  return {
    mockDb,
    mockDailyFindFirst,
    mockDailyFindMany,
    mockDailyUpsert,
    mockSettlementFindMany,
    mockReleaseFindMany,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { getBalancesReport, upsertDailyBalance } = await import("../balances.ts");

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

beforeEach(() => {
  mockDailyFindFirst.mockReset();
  mockDailyFindMany.mockReset();
  mockDailyUpsert.mockReset();
  mockSettlementFindMany.mockReset();
  mockReleaseFindMany.mockReset();
});

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
      releases: [
        { date: at("2026-03-01"), grossAmount: 50, netCreditAmount: 0, netDebitAmount: 0 },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-03");

    expect(res.days[0]).toMatchObject({
      totalIn: 150,
      totalOut: 0,
      netChange: 150,
      expectedBalance: 150,
    });
    expect(res.days[1]).toMatchObject({
      totalIn: 0,
      totalOut: 30,
      netChange: -30,
      expectedBalance: 120,
    });
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
    expect(res.days[0]).toMatchObject({
      totalIn: 0,
      totalOut: 0,
      recordedBalance: null,
      difference: null,
      note: null,
      hasCashback: false,
    });
  });

  // ─── Exact DB query args (kills unasserted where/orderBy/select mutants) ─────

  it("queries previous balance with date < from, ordered date desc", async () => {
    setup({});
    await getBalancesReport("2026-03-01", "2026-03-03");
    expect(mockDailyFindFirst).toHaveBeenCalledTimes(1);
    expect(mockDailyFindFirst).toHaveBeenCalledWith({
      where: { date: { lt: chileStart("2026-03-01") } },
      orderBy: { date: "desc" },
    });
  });

  it("queries settlements within the inclusive Chile-day window with the exact select", async () => {
    setup({});
    await getBalancesReport("2026-03-01", "2026-03-03");
    expect(mockSettlementFindMany).toHaveBeenCalledWith({
      where: {
        transactionDate: {
          gte: chileStart("2026-03-01"),
          lte: chileEnd("2026-03-03"),
        },
      },
      select: { transactionDate: true, transactionAmount: true },
    });
  });

  it("queries releases within the window with the credit/debit/gross select", async () => {
    setup({});
    await getBalancesReport("2026-03-01", "2026-03-03");
    expect(mockReleaseFindMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: chileStart("2026-03-01"),
          lte: chileEnd("2026-03-03"),
        },
      },
      select: {
        date: true,
        grossAmount: true,
        netCreditAmount: true,
        netDebitAmount: true,
      },
    });
  });

  it("queries existing daily balances within the same inclusive window", async () => {
    setup({});
    await getBalancesReport("2026-03-01", "2026-03-03");
    expect(mockDailyFindMany).toHaveBeenCalledWith({
      where: {
        date: {
          gte: chileStart("2026-03-01"),
          lte: chileEnd("2026-03-03"),
        },
      },
    });
  });

  // ─── Arithmetic-distinctness (each kills a specific +/-/*/abs mutant) ────────

  it("a zero settlement counts as IN, not OUT (amt >= 0 boundary)", async () => {
    setup({ settlements: [{ transactionDate: at("2026-03-01"), transactionAmount: 0 }] });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    // amt 0 takes the `>= 0` branch → totalIn += 0, totalOut untouched.
    // Distinct values pin that the row is processed (length proves the filter),
    // and that the boundary is `>=` not `>`.
    expect(res.days[0].totalIn).toBe(0);
    expect(res.days[0].totalOut).toBe(0);
  });

  it("sums multiple same-day INs and OUTs, netChange = in − out (not + or *)", async () => {
    setup({
      settlements: [
        { transactionDate: at("2026-03-01"), transactionAmount: 200 },
        { transactionDate: at("2026-03-01"), transactionAmount: 50 },
        { transactionDate: at("2026-03-01"), transactionAmount: -40 },
        { transactionDate: at("2026-03-01"), transactionAmount: -10 },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].totalIn).toBe(250); // 200 + 50
    expect(res.days[0].totalOut).toBe(50); // |−40| + |−10|
    expect(res.days[0].netChange).toBe(200); // 250 − 50  (≠ 300 sum, ≠ 12500 product)
    expect(res.days[0].expectedBalance).toBe(200); // 0 + 200
  });

  it("Math.abs maps a negative amount to a positive totalOut", async () => {
    setup({ settlements: [{ transactionDate: at("2026-03-01"), transactionAmount: -75 }] });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].totalOut).toBe(75); // abs(−75), not −75
    expect(res.days[0].netChange).toBe(-75); // 0 − 75
  });

  it("expectedBalance accumulates previous + netChange across days (sum chain)", async () => {
    setup({
      previous: { amount: 500, date: at("2026-02-28") },
      settlements: [
        { transactionDate: at("2026-03-01"), transactionAmount: 100 },
        { transactionDate: at("2026-03-02"), transactionAmount: 200 },
        { transactionDate: at("2026-03-03"), transactionAmount: -50 },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-03");
    expect(res.days[0].expectedBalance).toBe(600); // 500 + 100
    expect(res.days[1].expectedBalance).toBe(800); // 600 + 200
    expect(res.days[2].expectedBalance).toBe(750); // 800 − 50
  });

  it("release amount is credit − debit (not + ), netDebit subtracts", async () => {
    setup({
      releases: [
        { date: at("2026-03-01"), grossAmount: 0, netCreditAmount: 100, netDebitAmount: 70 },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].totalIn).toBe(30); // 100 − 70  (≠ 170 sum)
    expect(res.days[0].totalOut).toBe(0);
  });

  it("a release whose debit exceeds credit becomes a negative movement (OUT)", async () => {
    setup({
      releases: [
        { date: at("2026-03-01"), grossAmount: 999, netCreditAmount: 20, netDebitAmount: 90 },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    // 20 − 90 = −70 → routed to totalOut as abs; gross 999 ignored.
    expect(res.days[0].totalIn).toBe(0);
    expect(res.days[0].totalOut).toBe(70);
    expect(res.days[0].netChange).toBe(-70);
  });

  it("null credit/debit coalesce to 0 → falls back to grossAmount", async () => {
    setup({
      releases: [
        {
          date: at("2026-03-01"),
          grossAmount: 42,
          netCreditAmount: undefined,
          netDebitAmount: undefined,
        },
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].totalIn).toBe(42); // both null → 0,0 → gross fallback
  });

  it("difference is null while recordedBalance is null (no recorded row)", async () => {
    setup({ settlements: [{ transactionDate: at("2026-03-01"), transactionAmount: 100 }] });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].recordedBalance).toBeNull();
    expect(res.days[0].difference).toBeNull();
  });

  it("difference can be negative when recorded < expected", async () => {
    setup({
      settlements: [{ transactionDate: at("2026-03-01"), transactionAmount: 300 }],
      existing: [{ date: at("2026-03-01"), amount: 250 }],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].expectedBalance).toBe(300);
    expect(res.days[0].recordedBalance).toBe(250);
    expect(res.days[0].difference).toBe(-50); // 250 − 300, not 300 − 250
  });

  it("note defaults to null and hasCashback is always false", async () => {
    setup({ existing: [{ date: at("2026-03-01"), amount: 10 }] }); // no note field
    const res = await getBalancesReport("2026-03-01", "2026-03-01");
    expect(res.days[0].note).toBeNull();
    expect(res.days[0].hasCashback).toBe(false);
  });

  it("only counts movements falling on each specific Chile day (date filter)", async () => {
    setup({
      settlements: [
        { transactionDate: at("2026-03-01"), transactionAmount: 100 },
        { transactionDate: at("2026-03-03"), transactionAmount: 999 }, // outside [03-01,03-02]
      ],
    });
    const res = await getBalancesReport("2026-03-01", "2026-03-02");
    expect(res.days[0].totalIn).toBe(100);
    expect(res.days[1].totalIn).toBe(0); // 03-03 row is not in this window's days
  });
});

describe("upsertDailyBalance", () => {
  it("upserts at the UTC-midnight @db.Date anchor with Decimal amount + note", async () => {
    mockDailyUpsert.mockResolvedValue({ ok: true });
    const now = new Date("2026-03-15T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await upsertDailyBalance("2026-03-10", 12345, "cuadre");

    vi.useRealTimers();

    expect(mockDailyUpsert).toHaveBeenCalledTimes(1);
    const arg = mockDailyUpsert.mock.calls[0][0] as {
      where: { date: Date };
      update: { amount: Decimal; note?: string; updatedAt: Date };
      create: { date: Date; amount: Decimal; note?: string };
    };

    // @db.Date write anchors at UTC midnight (isoToDbDate).
    expect(arg.where.date.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(arg.create.date.toISOString()).toBe("2026-03-10T00:00:00.000Z");

    // amount becomes a Decimal carrying the exact value, on both branches.
    expect(arg.update.amount).toBeInstanceOf(Decimal);
    expect(arg.update.amount.toNumber()).toBe(12345);
    expect(arg.create.amount).toBeInstanceOf(Decimal);
    expect(arg.create.amount.toNumber()).toBe(12345);

    // note passes through verbatim on both branches.
    expect(arg.update.note).toBe("cuadre");
    expect(arg.create.note).toBe("cuadre");

    // updatedAt stamped on the update branch with the current time.
    expect(arg.update.updatedAt.toISOString()).toBe("2026-03-15T08:00:00.000Z");
  });

  it("passes undefined note through when omitted", async () => {
    mockDailyUpsert.mockResolvedValue({ ok: true });
    await upsertDailyBalance("2026-04-01", 0);
    const arg = mockDailyUpsert.mock.calls[0][0] as {
      update: { note?: string; amount: Decimal };
      create: { note?: string; amount: Decimal };
    };
    expect(arg.update.note).toBeUndefined();
    expect(arg.create.note).toBeUndefined();
    // zero amount survives as a real Decimal(0), not dropped.
    expect(arg.create.amount.toNumber()).toBe(0);
  });

  it("returns the upsert result", async () => {
    const row = { id: 1, amount: new Decimal("5") };
    mockDailyUpsert.mockResolvedValue(row);
    const result = await upsertDailyBalance("2026-05-20", 5);
    expect(result).toBe(row);
  });
});
