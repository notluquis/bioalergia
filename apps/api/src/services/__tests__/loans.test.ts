import { Decimal } from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * loans.ts keeps its pure financial logic (generateSchedules amortization,
 * computeSummary, mapScheduleStatus date-derivation, getDueDateForInstallment,
 * mapSchedule serialization, payment status derivation) in NON-exported
 * helpers. They are reachable only through the exported async service
 * functions, so we drive them via a fully captured db mock:
 *
 *   - db.loan.create / findUnique / findUniqueOrThrow / update / delete
 *   - db.loanSchedule.createMany (captures generateSchedules output)
 *   - db.loanSchedule.findMany / findUnique / update
 *   - db.financialTransaction.findUnique
 *
 * The mock echoes Decimal fields back so the amortization math runs for real.
 */

type AnyRow = Record<string, unknown>;

const { mockDb, state } = vi.hoisted(() => {
  const state: {
    createdSchedules: AnyRow[];
    detailLoan: AnyRow | null;
    detailSchedules: AnyRow[];
    refreshedLoan: AnyRow | null;
    scheduleRow: AnyRow | null;
    transactionRow: AnyRow | null;
    findManySchedules: AnyRow[];
    updatedSchedule: AnyRow | null;
    loanUpdates: AnyRow[];
    statusUpdates: AnyRow[];
  } = {
    createdSchedules: [],
    detailLoan: null,
    detailSchedules: [],
    refreshedLoan: null,
    scheduleRow: null,
    transactionRow: null,
    findManySchedules: [],
    updatedSchedule: null,
    loanUpdates: [],
    statusUpdates: [],
  };

  const mockDb = {
    loan: {
      create: vi.fn((args: { data: AnyRow }) => {
        // Echo the persisted row back, including the publicId the service
        // generated, so generateSchedules sees real Decimals.
        return Promise.resolve({ id: 1, ...args.data });
      }),
      findUnique: vi.fn(() => {
        if (!state.detailLoan) return Promise.resolve(null);
        return Promise.resolve({ ...state.detailLoan, schedules: state.detailSchedules });
      }),
      findUniqueOrThrow: vi.fn(() => {
        if (!state.refreshedLoan) throw new Error("no refreshed loan configured");
        return Promise.resolve(state.refreshedLoan);
      }),
      update: vi.fn((args: { data: AnyRow }) => {
        state.loanUpdates.push(args.data);
        return Promise.resolve({ id: 1, ...args.data });
      }),
      delete: vi.fn(() => Promise.resolve({ id: 1 })),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    loanSchedule: {
      createMany: vi.fn((args: { data: AnyRow[] }) => {
        state.createdSchedules = args.data;
        return Promise.resolve({ count: args.data.length });
      }),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      findMany: vi.fn(() => Promise.resolve(state.findManySchedules)),
      findUnique: vi.fn(() => Promise.resolve(state.scheduleRow)),
      update: vi.fn((args: { data: AnyRow }) => {
        state.statusUpdates.push(args.data);
        return Promise.resolve({ ...state.updatedSchedule, ...args.data });
      }),
    },
    financialTransaction: {
      findUnique: vi.fn(() => Promise.resolve(state.transactionRow)),
    },
  };

  return { mockDb, state };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});

const {
  createLoan,
  getLoanDetail,
  listLoans,
  registerLoanPayment,
  unlinkLoanPayment,
  regenerateLoanSchedules,
  deleteLoan,
} = await import("../loans.ts");

// ---------------------------------------------------------------------------
// Helpers to read back generateSchedules output captured from createMany.
// ---------------------------------------------------------------------------
const num = (v: unknown) => Number(v as Decimal);

async function generatedSchedulesFor(loan: {
  frequency?: string;
  interestRate: number;
  interestType: string;
  principalAmount: number;
  startDate?: string;
  totalInstallments: number;
}) {
  state.createdSchedules = [];
  // detailLoan only needs to satisfy getLoanDetail (called after create);
  // we don't assert on its return value here.
  state.detailLoan = {
    borrowerName: "X",
    borrowerType: "PERSON",
    createdAt: new Date(),
    frequency: loan.frequency ?? "MONTHLY",
    id: 1,
    interestRate: new Decimal(loan.interestRate),
    interestType: loan.interestType,
    notes: null,
    principalAmount: new Decimal(loan.principalAmount),
    publicId: "loan_x",
    startDate: new Date("2026-01-01T00:00:00Z"),
    status: "ACTIVE",
    title: "X",
    totalInstallments: loan.totalInstallments,
    updatedAt: new Date(),
  };
  state.detailSchedules = [];
  await createLoan({
    borrowerName: "X",
    borrowerType: "PERSON",
    frequency: (loan.frequency ?? "MONTHLY") as never,
    interestRate: loan.interestRate,
    interestType: loan.interestType as never,
    principalAmount: loan.principalAmount,
    startDate: loan.startDate ?? "2026-01-01",
    title: "X",
    totalInstallments: loan.totalInstallments,
  });
  return state.createdSchedules.map((s) => ({
    installmentNumber: s.installmentNumber as number,
    expectedAmount: num(s.expectedAmount),
    expectedInterest: num(s.expectedInterest),
    expectedPrincipal: num(s.expectedPrincipal),
    dueDate: s.dueDate as Date,
    status: s.status as string,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.createdSchedules = [];
  state.detailLoan = null;
  state.detailSchedules = [];
  state.refreshedLoan = null;
  state.scheduleRow = null;
  state.transactionRow = null;
  state.findManySchedules = [];
  state.updatedSchedule = null;
  state.loanUpdates = [];
  state.statusUpdates = [];
});

// ===========================================================================
// generateSchedules — SIMPLE interest (zero & non-zero rate)
// ===========================================================================
describe("generateSchedules — simple interest", () => {
  it("zero-interest: principal split evenly, last installment absorbs remainder", async () => {
    // 1000 / 3 = 333.33 base; last = 1000 - 333.33 - 333.33 = 333.34
    const rows = await generatedSchedulesFor({
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 1000,
      totalInstallments: 3,
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.expectedPrincipal)).toEqual([333.33, 333.33, 333.34]);
    expect(rows.map((r) => r.expectedInterest)).toEqual([0, 0, 0]);
    expect(rows.map((r) => r.expectedAmount)).toEqual([333.33, 333.33, 333.34]);
    expect(rows.map((r) => r.status)).toEqual(["PENDING", "PENDING", "PENDING"]);
    expect(rows.map((r) => r.installmentNumber)).toEqual([1, 2, 3]);
    // Sum of principal == exact principal (no leakage).
    const sum = rows.reduce((a, r) => a + r.expectedPrincipal, 0);
    expect(Number(sum.toFixed(2))).toBe(1000);
  });

  it("zero-interest single installment: full principal, no interest", async () => {
    const rows = await generatedSchedulesFor({
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 500,
      totalInstallments: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.expectedPrincipal).toBe(500);
    expect(rows[0]?.expectedInterest).toBe(0);
    expect(rows[0]?.expectedAmount).toBe(500);
  });

  it("simple interest MONTHLY: per-period rate = annual/12, last absorbs remainders", async () => {
    // 12% annual, MONTHLY → 0.01/period. principal 1200, 12 installments.
    // totalInterest = 1200 * 0.01 * 12 = 144. baseInterest = 12. basePrincipal = 100.
    const rows = await generatedSchedulesFor({
      interestRate: 12,
      interestType: "SIMPLE",
      principalAmount: 1200,
      totalInstallments: 12,
    });
    expect(rows).toHaveLength(12);
    for (let i = 0; i < 11; i++) {
      expect(rows[i]?.expectedPrincipal).toBe(100);
      expect(rows[i]?.expectedInterest).toBe(12);
      expect(rows[i]?.expectedAmount).toBe(112);
    }
    // last absorbs remaining
    expect(rows[11]?.expectedPrincipal).toBe(100);
    expect(rows[11]?.expectedInterest).toBe(12);
    const principalSum = rows.reduce((a, r) => a + r.expectedPrincipal, 0);
    const interestSum = rows.reduce((a, r) => a + r.expectedInterest, 0);
    expect(Number(principalSum.toFixed(2))).toBe(1200);
    expect(Number(interestSum.toFixed(2))).toBe(144);
  });

  it("simple interest: remainder rounding pushed into final installment", async () => {
    // principal 100, 3 installments, rate 10% MONTHLY.
    // basePrincipal = 33.33 → last principal = 100 - 66.66 = 33.34
    // totalInterest = 100 * (0.1/12) * 3 = 2.5 → baseInterest = 0.83 (2.5/3=0.8333)
    // remainingInterest last = 2.5 - 0.83 - 0.83 = 0.84
    const rows = await generatedSchedulesFor({
      interestRate: 10,
      interestType: "SIMPLE",
      principalAmount: 100,
      totalInstallments: 3,
    });
    expect(rows.map((r) => r.expectedPrincipal)).toEqual([33.33, 33.33, 33.34]);
    expect(rows.map((r) => r.expectedInterest)).toEqual([0.83, 0.83, 0.84]);
    // amount = principal + interest, rounded
    expect(rows[0]?.expectedAmount).toBe(34.16);
    expect(rows[2]?.expectedAmount).toBe(34.18);
  });

  it("COMPOUND with zero rate falls through to simple branch (no NaN)", async () => {
    // perPeriodRate.isZero() → COMPOUND short-circuits to the simple loop.
    const rows = await generatedSchedulesFor({
      interestRate: 0,
      interestType: "COMPOUND",
      principalAmount: 900,
      totalInstallments: 3,
    });
    expect(rows.map((r) => r.expectedInterest)).toEqual([0, 0, 0]);
    expect(rows.map((r) => r.expectedPrincipal)).toEqual([300, 300, 300]);
  });

  it("returns no schedules when totalInstallments <= 0", async () => {
    const rows = await generatedSchedulesFor({
      interestRate: 5,
      interestType: "SIMPLE",
      principalAmount: 1000,
      totalInstallments: 0,
    });
    expect(rows).toHaveLength(0);
    expect(mockDb.loanSchedule.createMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// generateSchedules — COMPOUND amortization
// ===========================================================================
describe("generateSchedules — compound amortization", () => {
  it("amortizes a known loan: exact per-installment principal/interest/amount table", async () => {
    // principal 1000, 12% annual MONTHLY (rate 0.01/period), 12 installments.
    // Standard annuity payment = P*r / (1 - (1+r)^-n)
    // = 1000*0.01 / (1 - 1.01^-12) = 10 / 0.112825... ≈ 88.8488 → 88.85 rounded.
    // Exact amortization table (verified against decimal.js HALF_UP):
    const expected: Array<[number, number, number]> = [
      // [principal, interest, amount]
      [78.85, 10, 88.85],
      [79.64, 9.21, 88.85],
      [80.43, 8.42, 88.85],
      [81.24, 7.61, 88.85],
      [82.05, 6.8, 88.85],
      [82.87, 5.98, 88.85],
      [83.7, 5.15, 88.85],
      [84.54, 4.31, 88.85],
      [85.38, 3.47, 88.85],
      [86.24, 2.61, 88.85],
      [87.1, 1.75, 88.85],
      [87.96, 0.88, 88.84], // final: principal = residual balance, amount = p + i
    ];
    const rows = await generatedSchedulesFor({
      interestRate: 12,
      interestType: "COMPOUND",
      principalAmount: 1000,
      totalInstallments: 12,
    });
    expect(rows).toHaveLength(12);
    rows.forEach((r, i) => {
      // Per-installment exactness kills: final-branch (`=== scheduleCount`)
      // mutated to `true`/`false`, principal/interest swaps, rounding flips.
      expect([r.expectedPrincipal, r.expectedInterest, r.expectedAmount]).toEqual(expected[i]);
      expect(r.status).toBe("PENDING");
    });
    // Non-final amounts are the constant annuity; final differs (88.84).
    expect(rows[11]?.expectedAmount).not.toBe(rows[0]?.expectedAmount);
    // Sum of principal parts == principal exactly (no leakage).
    const principalSum = rows.reduce((a, r) => a + r.expectedPrincipal, 0);
    expect(Number(principalSum.toFixed(2))).toBe(1000);
  });

  it("final installment principal == residual balance (remainder handling)", async () => {
    const rows = await generatedSchedulesFor({
      interestRate: 24,
      interestType: "COMPOUND",
      principalAmount: 750,
      totalInstallments: 6,
    });
    const principalSum = rows.reduce((a, r) => a + r.expectedPrincipal, 0);
    expect(Number(principalSum.toFixed(2))).toBe(750);
    // Final amount = final principal + final interest (recomputed, not the
    // generic payment) — verify it equals that sum.
    const last = rows[rows.length - 1];
    expect(last?.expectedAmount).toBeCloseTo(
      (last?.expectedPrincipal ?? 0) + (last?.expectedInterest ?? 0),
      2
    );
  });

  it("single compound installment: principal = full, interest = principal*rate", async () => {
    // n=1: payment = P*r/(1-(1+r)^-1) = P*r/(r/(1+r)) = P*(1+r) = P + P*r
    // installment===scheduleCount so principalPart = balance = full principal.
    const rows = await generatedSchedulesFor({
      interestRate: 12,
      interestType: "COMPOUND",
      principalAmount: 1000,
      totalInstallments: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.expectedPrincipal).toBe(1000);
    expect(rows[0]?.expectedInterest).toBe(10); // 1000 * 0.01
    expect(rows[0]?.expectedAmount).toBe(1010);
  });

  it("frequency changes the per-period rate divisor (WEEKLY vs MONTHLY)", async () => {
    // WEEKLY → /52, MONTHLY → /12. Same annual rate ⇒ different first interest.
    const weekly = await generatedSchedulesFor({
      frequency: "WEEKLY",
      interestRate: 52,
      interestType: "COMPOUND",
      principalAmount: 1000,
      totalInstallments: 10,
    });
    const monthly = await generatedSchedulesFor({
      frequency: "MONTHLY",
      interestRate: 52,
      interestType: "COMPOUND",
      principalAmount: 1000,
      totalInstallments: 10,
    });
    // WEEKLY rate per period = 0.52/52 = 0.01 → first interest = 10.
    expect(weekly[0]?.expectedInterest).toBe(10);
    // MONTHLY rate per period = 0.52/12 ≈ 0.0433 → first interest ≈ 43.33.
    expect(monthly[0]?.expectedInterest).toBeCloseTo(43.33, 2);
  });

  it("BIWEEKLY uses 26 periods/year for rate", async () => {
    // BIWEEKLY → /26. annual 26% → 0.01/period → first interest = principal*0.01.
    const rows = await generatedSchedulesFor({
      frequency: "BIWEEKLY",
      interestRate: 26,
      interestType: "COMPOUND",
      principalAmount: 2000,
      totalInstallments: 8,
    });
    expect(rows[0]?.expectedInterest).toBe(20); // 2000 * 0.01
  });
});

// ===========================================================================
// getDueDateForInstallment — date math per frequency (via captured dueDate)
// ===========================================================================
describe("getDueDateForInstallment — due date math", () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  it("MONTHLY: each installment adds one calendar month", async () => {
    const rows = await generatedSchedulesFor({
      frequency: "MONTHLY",
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 300,
      startDate: "2026-01-15",
      totalInstallments: 3,
    });
    expect(rows.map((r) => iso(r.dueDate))).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("WEEKLY: each installment adds 7 days", async () => {
    const rows = await generatedSchedulesFor({
      frequency: "WEEKLY",
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 300,
      startDate: "2026-01-01",
      totalInstallments: 3,
    });
    expect(rows.map((r) => iso(r.dueDate))).toEqual(["2026-01-08", "2026-01-15", "2026-01-22"]);
  });

  it("BIWEEKLY: each installment adds 14 days (installment*2 weeks)", async () => {
    const rows = await generatedSchedulesFor({
      frequency: "BIWEEKLY",
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 300,
      startDate: "2026-01-01",
      totalInstallments: 3,
    });
    expect(rows.map((r) => iso(r.dueDate))).toEqual(["2026-01-15", "2026-01-29", "2026-02-12"]);
  });

  it("MONTHLY: end-of-month start date clamps correctly (Jan 31 → Feb 28)", async () => {
    const rows = await generatedSchedulesFor({
      frequency: "MONTHLY",
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 200,
      startDate: "2026-01-31",
      totalInstallments: 2,
    });
    // dayjs add-month clamps Jan 31 + 1mo → Feb 28 (2026 not leap).
    expect(iso(rows[0]?.dueDate as Date)).toBe("2026-02-28");
    expect(iso(rows[1]?.dueDate as Date)).toBe("2026-03-31");
  });
});

// ===========================================================================
// computeSummary + mapScheduleStatus — via getLoanDetail / listLoans
// ===========================================================================
function detailLoanWith(schedules: AnyRow[]): AnyRow {
  return {
    borrowerName: "B",
    borrowerType: "PERSON",
    counterpartId: null,
    createdAt: new Date(),
    frequency: "MONTHLY",
    id: 1,
    interestRate: new Decimal(10),
    interestType: "SIMPLE",
    notes: null,
    principalAmount: new Decimal(1000),
    publicId: "loan_abc",
    scope: "BIOALERGIA",
    startDate: new Date("2026-01-01T00:00:00Z"),
    status: "ACTIVE",
    title: "T",
    totalInstallments: schedules.length,
    updatedAt: new Date(),
    schedules,
  };
}

function schedule(overrides: Partial<AnyRow>): AnyRow {
  return {
    createdAt: new Date(),
    dueDate: new Date("2099-01-01T00:00:00Z"),
    expectedAmount: new Decimal(100),
    expectedInterest: new Decimal(0),
    expectedPrincipal: new Decimal(100),
    id: 1,
    installmentNumber: 1,
    loanId: 1,
    paidAmount: null,
    paidDate: null,
    status: "PENDING",
    transaction: null,
    transactionId: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("computeSummary — totals, remaining, counts", () => {
  it("sums expected/paid, computes remaining, counts paid & pending", async () => {
    const schedules = [
      schedule({ expectedAmount: new Decimal(100), paidAmount: new Decimal(100), status: "PAID" }),
      schedule({
        expectedAmount: new Decimal(100),
        paidAmount: new Decimal(40),
        status: "PARTIAL",
        id: 2,
      }),
      schedule({ expectedAmount: new Decimal(100), status: "PENDING", id: 3 }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { summary } = await getLoanDetail("loan_abc");
    expect(summary.total_expected).toBe(300);
    expect(summary.total_paid).toBe(140);
    expect(summary.remaining_amount).toBe(160);
    expect(summary.paid_installments).toBe(1);
    // pending = not PAID and not SKIPPED → PARTIAL + PENDING = 2.
    expect(summary.pending_installments).toBe(2);
  });

  it("remaining never goes negative on overpayment (Decimal.max with 0)", async () => {
    const schedules = [
      schedule({ expectedAmount: new Decimal(100), paidAmount: new Decimal(150), status: "PAID" }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { summary } = await getLoanDetail("loan_abc");
    expect(summary.total_paid).toBe(150);
    expect(summary.remaining_amount).toBe(0);
  });

  it("SKIPPED counts as neither paid nor pending", async () => {
    const schedules = [
      schedule({ status: "SKIPPED" }),
      schedule({ status: "PAID", paidAmount: new Decimal(100), id: 2 }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { summary } = await getLoanDetail("loan_abc");
    expect(summary.paid_installments).toBe(1);
    expect(summary.pending_installments).toBe(0);
  });
});

describe("mapScheduleStatus — derivation", () => {
  it("PENDING with past due date is rendered as OVERDUE", async () => {
    const schedules = [
      schedule({ status: "PENDING", dueDate: new Date("2000-01-01T00:00:00Z") }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { schedules: out } = await getLoanDetail("loan_abc");
    expect(out[0]?.status).toBe("OVERDUE");
  });

  it("PENDING with future due date stays PENDING", async () => {
    const schedules = [
      schedule({ status: "PENDING", dueDate: new Date("2099-01-01T00:00:00Z") }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { schedules: out } = await getLoanDetail("loan_abc");
    expect(out[0]?.status).toBe("PENDING");
  });

  it("PAID/PARTIAL/SKIPPED are preserved regardless of due date", async () => {
    const schedules = [
      schedule({ status: "PAID", dueDate: new Date("2000-01-01T00:00:00Z"), paidAmount: new Decimal(100) }),
      schedule({ status: "PARTIAL", dueDate: new Date("2000-01-01T00:00:00Z"), id: 2 }),
      schedule({ status: "SKIPPED", dueDate: new Date("2000-01-01T00:00:00Z"), id: 3 }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { schedules: out } = await getLoanDetail("loan_abc");
    expect(out.map((s) => s.status)).toEqual(["PAID", "PARTIAL", "SKIPPED"]);
  });
});

// ===========================================================================
// mapSchedule + mapTransaction — serialization shape
// ===========================================================================
describe("mapSchedule serialization", () => {
  it("serializes Decimals to numbers, dates to YYYY-MM-DD, nulls preserved", async () => {
    const schedules = [
      schedule({
        expectedAmount: new Decimal(112.5),
        expectedInterest: new Decimal(12.5),
        expectedPrincipal: new Decimal(100),
        dueDate: new Date("2026-03-15T00:00:00Z"),
        paidAmount: new Decimal(50),
        paidDate: new Date("2026-03-10T00:00:00Z"),
        status: "PARTIAL",
        transactionId: 7,
        transaction: {
          amount: new Decimal(50),
          date: new Date("2026-03-10T12:00:00Z"),
          description: "abono",
          id: 7,
        },
      }),
    ];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { schedules: out } = await getLoanDetail("loan_abc");
    const s = out[0];
    expect(s?.expected_amount).toBe(112.5);
    expect(s?.expected_interest).toBe(12.5);
    expect(s?.expected_principal).toBe(100);
    expect(s?.due_date).toBe("2026-03-15");
    expect(s?.paid_amount).toBe(50);
    expect(s?.paid_date).toBe("2026-03-10");
    expect(s?.transaction_id).toBe(7);
    expect(s?.transaction).toEqual({
      amount: 50,
      description: "abono",
      id: 7,
      timestamp: new Date("2026-03-10T12:00:00Z"),
    });
  });

  it("null paidAmount/paidDate/transaction stay null", async () => {
    const schedules = [schedule({ paidAmount: null, paidDate: null, transaction: null })];
    state.detailLoan = detailLoanWith(schedules);
    state.detailSchedules = schedules;
    const { schedules: out } = await getLoanDetail("loan_abc");
    expect(out[0]?.paid_amount).toBeNull();
    expect(out[0]?.paid_date).toBeNull();
    expect(out[0]?.transaction).toBeNull();
  });
});

// ===========================================================================
// listLoans — mapLoanSummary roll-up
// ===========================================================================
describe("listLoans — summary roll-up", () => {
  it("maps loan fields and embeds computed summary", async () => {
    const schedules = [
      schedule({ expectedAmount: new Decimal(100), paidAmount: new Decimal(100), status: "PAID" }),
      schedule({ expectedAmount: new Decimal(100), status: "PENDING", id: 2 }),
    ];
    mockDb.loan.findMany.mockResolvedValueOnce([detailLoanWith(schedules)] as never);
    const result = await listLoans();
    expect(result).toHaveLength(1);
    const loan = result[0];
    expect(loan?.principal_amount).toBe(1000);
    expect(loan?.interest_rate).toBe(10);
    expect(loan?.start_date).toBe("2026-01-01");
    expect(loan?.total_expected).toBe(200);
    expect(loan?.total_paid).toBe(100);
    expect(loan?.remaining_amount).toBe(100);
    expect(loan?.paid_installments).toBe(1);
    expect(loan?.pending_installments).toBe(1);
  });
});

// ===========================================================================
// registerLoanPayment — payment status derivation (PAID vs PARTIAL boundary)
// ===========================================================================
describe("registerLoanPayment — status derivation boundary", () => {
  beforeEach(() => {
    state.scheduleRow = {
      id: 5,
      loanId: 1,
      dueDate: new Date("2026-06-01T00:00:00Z"),
      expectedAmount: new Decimal(100),
      loan: { id: 1 },
    };
    state.transactionRow = { id: 9 };
    state.updatedSchedule = schedule({ id: 5, transactionId: 9 });
    state.findManySchedules = [schedule({ status: "PAID", paidAmount: new Decimal(100) })];
  });

  it("paidAmount == expected → PAID (boundary, >=)", async () => {
    await registerLoanPayment(5, { paidAmount: 100, paidDate: "2026-06-01", transactionId: 9 });
    const updateArg = mockDb.loanSchedule.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(updateArg.data.status).toBe("PAID");
  });

  it("paidAmount > expected → PAID (overpayment)", async () => {
    await registerLoanPayment(5, { paidAmount: 150, paidDate: "2026-06-01", transactionId: 9 });
    const updateArg = mockDb.loanSchedule.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(updateArg.data.status).toBe("PAID");
  });

  it("paidAmount < expected → PARTIAL", async () => {
    await registerLoanPayment(5, { paidAmount: 99.99, paidDate: "2026-06-01", transactionId: 9 });
    const updateArg = mockDb.loanSchedule.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(updateArg.data.status).toBe("PARTIAL");
  });

  it("paidAmount rounds to expected (99.995 → 100.00) → PAID", async () => {
    // toMoney rounds HALF_UP to 2dp: 99.995 → 100.00 == expected → PAID.
    await registerLoanPayment(5, { paidAmount: 99.995, paidDate: "2026-06-01", transactionId: 9 });
    const updateArg = mockDb.loanSchedule.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(updateArg.data.status).toBe("PAID");
  });

  it("syncLoanStatus marks loan COMPLETED when all schedules PAID", async () => {
    await registerLoanPayment(5, { paidAmount: 100, paidDate: "2026-06-01", transactionId: 9 });
    const loanUpdate = mockDb.loan.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(loanUpdate.data.status).toBe("COMPLETED");
  });

  it("syncLoanStatus keeps loan ACTIVE when a schedule is still PENDING", async () => {
    state.findManySchedules = [
      schedule({ status: "PAID", paidAmount: new Decimal(100) }),
      schedule({ status: "PENDING", id: 2, dueDate: new Date("2099-01-01T00:00:00Z") }),
    ];
    await registerLoanPayment(5, { paidAmount: 100, paidDate: "2026-06-01", transactionId: 9 });
    const loanUpdate = mockDb.loan.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(loanUpdate.data.status).toBe("ACTIVE");
  });

  it("syncLoanStatus stays ACTIVE when schedules list is empty", async () => {
    state.findManySchedules = [];
    await registerLoanPayment(5, { paidAmount: 100, paidDate: "2026-06-01", transactionId: 9 });
    const loanUpdate = mockDb.loan.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(loanUpdate.data.status).toBe("ACTIVE");
  });
});

// ===========================================================================
// unlinkLoanPayment — status reset based on due date
// ===========================================================================
describe("unlinkLoanPayment — status reset", () => {
  beforeEach(() => {
    state.transactionRow = { id: 9 };
    state.updatedSchedule = schedule({ id: 5 });
    state.findManySchedules = [schedule({ status: "PENDING" })];
  });

  it("past due date → OVERDUE on unlink", async () => {
    state.scheduleRow = {
      id: 5,
      loanId: 1,
      dueDate: new Date("2000-01-01T00:00:00Z"),
      expectedAmount: new Decimal(100),
      loan: { id: 1 },
    };
    await unlinkLoanPayment(5);
    const updateArg = mockDb.loanSchedule.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(updateArg.data.status).toBe("OVERDUE");
    expect(updateArg.data.paidAmount).toBeNull();
    expect(updateArg.data.transactionId).toBeNull();
  });

  it("future due date → PENDING on unlink", async () => {
    state.scheduleRow = {
      id: 5,
      loanId: 1,
      dueDate: new Date("2099-01-01T00:00:00Z"),
      expectedAmount: new Decimal(100),
      loan: { id: 1 },
    };
    await unlinkLoanPayment(5);
    const updateArg = mockDb.loanSchedule.update.mock.calls[0]?.[0] as { data: AnyRow };
    expect(updateArg.data.status).toBe("PENDING");
  });
});

// ===========================================================================
// createLoan — optionalNote / trim / default status (input normalization)
// ===========================================================================
describe("createLoan — input normalization", () => {
  beforeEach(() => {
    state.detailLoan = detailLoanWith([]);
    state.detailSchedules = [];
  });

  it("trims title & borrowerName, blank notes → null, defaults status ACTIVE", async () => {
    await createLoan({
      borrowerName: "  Juan  ",
      borrowerType: "PERSON",
      frequency: "MONTHLY",
      interestRate: 0,
      interestType: "SIMPLE",
      notes: "   ",
      principalAmount: 1000,
      startDate: "2026-01-01",
      title: "  Loan A  ",
      totalInstallments: 1,
    });
    const createArg = mockDb.loan.create.mock.calls[0]?.[0] as { data: AnyRow };
    expect(createArg.data.title).toBe("Loan A");
    expect(createArg.data.borrowerName).toBe("Juan");
    expect(createArg.data.notes).toBeNull();
    expect(createArg.data.status).toBe("ACTIVE");
  });

  it("keeps non-blank trimmed notes; honors explicit status", async () => {
    await createLoan({
      borrowerName: "Ana",
      borrowerType: "COMPANY",
      frequency: "MONTHLY",
      interestRate: 0,
      interestType: "SIMPLE",
      notes: "  hola  ",
      principalAmount: 1000,
      startDate: "2026-01-01",
      status: "DEFAULTED",
      title: "L",
      totalInstallments: 1,
    });
    const createArg = mockDb.loan.create.mock.calls[0]?.[0] as { data: AnyRow };
    expect(createArg.data.notes).toBe("hola");
    expect(createArg.data.status).toBe("DEFAULTED");
  });

  it("generateSchedule=false skips schedule creation", async () => {
    await createLoan({
      borrowerName: "Ana",
      borrowerType: "PERSON",
      frequency: "MONTHLY",
      generateSchedule: false,
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 1000,
      startDate: "2026-01-01",
      title: "L",
      totalInstallments: 3,
    });
    expect(mockDb.loanSchedule.createMany).not.toHaveBeenCalled();
  });

  it("publicId has loan_ prefix", async () => {
    await createLoan({
      borrowerName: "Ana",
      borrowerType: "PERSON",
      frequency: "MONTHLY",
      interestRate: 0,
      interestType: "SIMPLE",
      principalAmount: 1000,
      startDate: "2026-01-01",
      title: "L",
      totalInstallments: 1,
    });
    const createArg = mockDb.loan.create.mock.calls[0]?.[0] as { data: AnyRow };
    expect(String(createArg.data.publicId)).toMatch(/^loan_[a-f0-9]{12}$/);
  });
});

// ===========================================================================
// regenerateLoanSchedules — lock guard
// ===========================================================================
describe("regenerateLoanSchedules — payment lock", () => {
  it("throws 409 when a schedule has a paidAmount (transactionId null)", async () => {
    // Isolates the LEFT side of the `paidAmount !== null || transactionId !== null`
    // guard — kills the `||→&&` and left-operand removal mutants.
    state.detailLoan = detailLoanWith([
      schedule({ paidAmount: new Decimal(50), transactionId: null }),
    ]);
    state.detailSchedules = state.detailLoan.schedules as AnyRow[];
    await expect(
      regenerateLoanSchedules("loan_abc", { totalInstallments: 6 })
    ).rejects.toMatchObject({ code: "LOAN_SCHEDULES_LOCKED", status: 409 });
  });

  it("throws 409 when a schedule has a transactionId (paidAmount null)", async () => {
    // Isolates the RIGHT side of the guard — kills right-operand removal.
    state.detailLoan = detailLoanWith([
      schedule({ paidAmount: null, transactionId: 3 }),
    ]);
    state.detailSchedules = state.detailLoan.schedules as AnyRow[];
    await expect(
      regenerateLoanSchedules("loan_abc", { totalInstallments: 6 })
    ).rejects.toMatchObject({ code: "LOAN_SCHEDULES_LOCKED", status: 409 });
  });

  it("regenerates when no payments registered", async () => {
    const loan = detailLoanWith([schedule({ paidAmount: null, transactionId: null })]);
    state.detailLoan = loan;
    state.detailSchedules = loan.schedules as AnyRow[];
    state.refreshedLoan = {
      ...loan,
      schedules: undefined,
      interestRate: new Decimal(0),
      principalAmount: new Decimal(600),
      totalInstallments: 3,
      frequency: "MONTHLY",
      interestType: "SIMPLE",
      startDate: new Date("2026-01-01T00:00:00Z"),
    };
    await regenerateLoanSchedules("loan_abc", { totalInstallments: 3 });
    expect(mockDb.loanSchedule.deleteMany).toHaveBeenCalled();
    expect(state.createdSchedules.map((s) => Number(s.expectedPrincipal as Decimal))).toEqual([
      200, 200, 200,
    ]);
  });
});

// ===========================================================================
// 404 guards
// ===========================================================================
describe("not-found guards", () => {
  it("getLoanDetail throws 404 when loan missing", async () => {
    state.detailLoan = null;
    await expect(getLoanDetail("nope")).rejects.toMatchObject({
      code: "LOAN_NOT_FOUND",
      status: 404,
    });
  });

  it("deleteLoan throws 404 when loan missing", async () => {
    state.detailLoan = null;
    await expect(deleteLoan("nope")).rejects.toMatchObject({ code: "LOAN_NOT_FOUND" });
  });

  it("registerLoanPayment throws 404 when schedule missing", async () => {
    state.scheduleRow = null;
    await expect(
      registerLoanPayment(99, { paidAmount: 10, paidDate: "2026-01-01", transactionId: 1 })
    ).rejects.toMatchObject({ code: "LOAN_SCHEDULE_NOT_FOUND", status: 404 });
  });

  it("registerLoanPayment throws 404 when transaction missing", async () => {
    state.scheduleRow = {
      id: 5,
      loanId: 1,
      dueDate: new Date("2026-06-01T00:00:00Z"),
      expectedAmount: new Decimal(100),
      loan: { id: 1 },
    };
    state.transactionRow = null;
    await expect(
      registerLoanPayment(5, { paidAmount: 10, paidDate: "2026-01-01", transactionId: 999 })
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND", status: 404 });
  });
});
