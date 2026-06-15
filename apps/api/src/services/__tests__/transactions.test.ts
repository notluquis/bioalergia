import { beforeEach, describe, expect, it, vi } from "vitest";

// transactions.ts pure logic is exercised through the exported async
// functions. All private helpers (asNumber sign/null handling, mapRow amount
// math, reconcileTransactions matching, monthKey bucketing, matchesFilter,
// isTestLike, getTransactionStats running totals + byType categorization) run
// over rows we feed via the mocked db.findMany calls. Mock @finanzas/db
// (+ slices per repo rule). Midday-UTC dates so monthKey (UTC) is stable.

const at = (d: string) => new Date(`${d}T12:00:00Z`);

type SettlementSeed = {
  id?: number;
  metadata?: unknown;
  description?: null | string;
  externalReference?: null | string;
  identificationNumber?: null | string;
  paymentMethod?: null | string;
  paymentMethodType?: null | string;
  settlementNetAmount?: number | string | null;
  sourceId?: string;
  transactionAmount?: number | string | null;
  transactionDate?: Date;
  transactionType?: string;
};

type ReleaseSeed = {
  id?: number;
  metadata?: unknown;
  description?: null | string;
  date?: Date;
  externalReference?: null | string;
  grossAmount?: number | string | null;
  identificationNumber?: null | string;
  netCreditAmount?: number | string | null;
  netDebitAmount?: number | string | null;
  paymentMethod?: null | string;
  paymentMethodType?: null | string;
  payoutBankAccountNumber?: null | string;
  recordType?: null | string;
  sourceId?: string;
};

type WithdrawSeed = {
  id?: number;
  amount?: number | string | null;
  bankAccountHolder?: null | string;
  bankAccountNumber?: null | string;
  bankAccountType?: null | string;
  bankName?: null | string;
  dateCreated?: Date;
  identificationNumber?: null | string;
  status?: null | string;
  withdrawId?: string;
};

const { mockSettlementFindMany, mockReleaseFindMany, mockWithdrawFindMany, mockDb } = vi.hoisted(
  () => {
    const mockSettlementFindMany = vi.fn();
    const mockReleaseFindMany = vi.fn();
    const mockWithdrawFindMany = vi.fn();
    const mockDb = {
      settlementTransaction: { findMany: (...a: unknown[]) => mockSettlementFindMany(...a) },
      releaseTransaction: { findMany: (...a: unknown[]) => mockReleaseFindMany(...a) },
      withdrawTransaction: { findMany: (...a: unknown[]) => mockWithdrawFindMany(...a) },
    };
    return { mockSettlementFindMany, mockReleaseFindMany, mockWithdrawFindMany, mockDb };
  }
);

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  fetchMergedTransactions,
  fetchMergedTransactionsBySourceIds,
  getParticipantLeaderboard,
  getParticipantInsight,
  getTransactionStats,
  listTransactions,
} = await import("../transactions.ts");

function seed(opts: {
  settlements?: SettlementSeed[];
  releases?: ReleaseSeed[];
  withdraws?: WithdrawSeed[];
}) {
  const settlements = (opts.settlements ?? []).map((s, i) => ({
    id: s.id ?? i + 1,
    metadata: s.metadata ?? null,
    description: s.description ?? null,
    externalReference: s.externalReference ?? null,
    identificationNumber: s.identificationNumber ?? null,
    paymentMethod: s.paymentMethod ?? null,
    paymentMethodType: s.paymentMethodType ?? null,
    settlementNetAmount: s.settlementNetAmount ?? null,
    sourceId: s.sourceId ?? `set-${i}`,
    transactionAmount: "transactionAmount" in s ? s.transactionAmount : 0,
    transactionDate: s.transactionDate ?? at("2026-01-15"),
    transactionType: s.transactionType ?? "payment",
  }));
  const releases = (opts.releases ?? []).map((r, i) => ({
    id: r.id ?? i + 1,
    metadata: r.metadata ?? null,
    description: r.description ?? null,
    date: r.date ?? at("2026-01-15"),
    externalReference: r.externalReference ?? null,
    grossAmount: r.grossAmount ?? null,
    identificationNumber: r.identificationNumber ?? null,
    netCreditAmount: r.netCreditAmount ?? null,
    netDebitAmount: r.netDebitAmount ?? null,
    paymentMethod: r.paymentMethod ?? null,
    paymentMethodType: r.paymentMethodType ?? null,
    payoutBankAccountNumber: r.payoutBankAccountNumber ?? null,
    recordType: r.recordType ?? null,
    sourceId: r.sourceId ?? `rel-${i}`,
  }));
  const withdraws = (opts.withdraws ?? []).map((w, i) => ({
    id: w.id ?? i + 1,
    amount: w.amount ?? 0,
    bankAccountHolder: w.bankAccountHolder ?? null,
    bankAccountNumber: w.bankAccountNumber ?? null,
    bankAccountType: w.bankAccountType ?? null,
    bankName: w.bankName ?? null,
    dateCreated: w.dateCreated ?? at("2026-01-15"),
    identificationNumber: w.identificationNumber ?? null,
    status: w.status ?? null,
    withdrawId: w.withdrawId ?? `wd-${i}`,
  }));
  mockSettlementFindMany.mockResolvedValue(settlements);
  mockReleaseFindMany.mockResolvedValue(releases);
  mockWithdrawFindMany.mockResolvedValue(withdraws);
}

beforeEach(() => {
  mockSettlementFindMany.mockReset();
  mockReleaseFindMany.mockReset();
  mockWithdrawFindMany.mockReset();
});

describe("asNumber via settlement mapping", () => {
  it("coerces numeric string to number (not NaN, not concat)", async () => {
    seed({ settlements: [{ transactionAmount: "150.5" }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(150.5);
  });

  it("null amount becomes 0 and grossAmount stays null", async () => {
    seed({ settlements: [{ transactionAmount: null }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(0);
    expect(tx.grossAmount).toBeNull();
  });

  it("non-null amount populates grossAmount with same coerced value", async () => {
    seed({ settlements: [{ transactionAmount: "42" }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.grossAmount).toBe(42);
  });

  it("DecimalLike object (toString) is coerced", async () => {
    const decimal = { toString: () => "99.99" };
    seed({ settlements: [{ transactionAmount: decimal as unknown as number }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(99.99);
  });

  it("negative numeric value preserved as-is", async () => {
    seed({ settlements: [{ transactionAmount: -7 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(-7);
  });
});

describe("mapReleaseRow amount math (credit - debit, else gross)", () => {
  it("credit only -> positive amount", async () => {
    seed({ releases: [{ netCreditAmount: 100, netDebitAmount: 0 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(100);
  });

  it("debit only -> negative amount", async () => {
    seed({ releases: [{ netCreditAmount: 0, netDebitAmount: 40 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(-40);
  });

  it("credit and debit -> difference", async () => {
    seed({ releases: [{ netCreditAmount: 100, netDebitAmount: 30 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(70);
  });

  it("both zero -> falls back to grossAmount", async () => {
    seed({ releases: [{ netCreditAmount: 0, netDebitAmount: 0, grossAmount: 55 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(55);
  });

  it("both null (->0) -> falls back to grossAmount", async () => {
    seed({ releases: [{ netCreditAmount: null, netDebitAmount: null, grossAmount: 12 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(12);
  });

  it("recordType drives transactionType, defaults to 'release'", async () => {
    seed({ releases: [{ recordType: null, grossAmount: 1 }] });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.transactionType).toBe("release");
  });

  it("release id is offset by RELEASE_ID_OFFSET (negative)", async () => {
    seed({ releases: [{ id: 5, grossAmount: 1 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.id).toBe(-1_000_000_000 - 5);
  });
});

describe("mapWithdrawRow sign handling (always negative)", () => {
  it("positive amount becomes negative", async () => {
    seed({ withdraws: [{ amount: 200 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(-200);
  });

  it("already-negative amount stays negative (abs then negate)", async () => {
    seed({ withdraws: [{ amount: -200 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(-200);
  });

  it("zero stays zero (no -0 leakage to value)", async () => {
    seed({ withdraws: [{ amount: 0 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.transactionAmount).toBe(-0);
    expect(Math.abs(tx.transactionAmount)).toBe(0);
  });

  it("withdraw id offset and description with withdrawId", async () => {
    seed({ withdraws: [{ id: 3, withdrawId: "W9", amount: 10 }] });
    const [tx] = await fetchMergedTransactions({});
    expect(tx.id).toBe(-2_000_000_000 - 3);
    expect(tx.description).toBe("withdraw W9");
  });
});

describe("reconcileTransactions matching", () => {
  it("merges release+withdraw on same sourceId/withdrawId, amount, account", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "MATCH1",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "12345",
        },
      ],
      withdraws: [
        { id: 1, withdrawId: "MATCH1", amount: 500, bankAccountNumber: "12345", status: "done" },
      ],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    // merged: one release row remains, withdraw consumed
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("release");
    expect(rows[0].status).toBe("done"); // withdraw.status preferred
    expect(rows[0].id).toBe(-1_000_000_000 - 1); // keeps release id
    expect(rows[0].transactionAmount).toBe(-500); // release amount (credit-debit)
    expect(rows[0].withdrawId).toBe("MATCH1"); // withdraw id flows in
    expect(rows.filter((r) => r.source === "withdraw")).toHaveLength(0);
  });

  it("does NOT merge when amounts differ beyond epsilon", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 499, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(2);
  });

  it("merges when amount differs within epsilon (<=0.01)", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500.0,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500.01, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
  });

  it("matches by amount regardless of sign (release negative, withdraw negated)", async () => {
    // release amount = -500, withdraw amount = -500; sameAmount uses abs
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
  });

  it("sameAccount returns true when one account is empty/missing -> still merges", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: null,
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500, bankAccountNumber: "999" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
  });

  it("does NOT merge when both accounts present and differ", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "111",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500, bankAccountNumber: "222" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(2);
  });

  it("normalizeAccountIdentifier strips leading zeros + non-alnum so 0012-3 == 123", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "0012-3",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500, bankAccountNumber: "123" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
  });

  it("one withdraw consumed by only one release (usedWithdraw guard)", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
        {
          id: 2,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    // one merged release + one unmerged release = 2; withdraw consumed once
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.source === "withdraw")).toHaveLength(0);
  });

  it("release without matching withdraw is kept untouched", async () => {
    seed({
      releases: [{ id: 1, sourceId: "NOMATCH", netCreditAmount: 100, netDebitAmount: 0 }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].transactionAmount).toBe(100);
  });

  it("merged row keeps release amount/type/extRef/sourceId, takes withdraw bank+id fields", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
          recordType: "payout",
          externalReference: "rel-ext",
          description: "rel-desc",
        },
      ],
      withdraws: [
        {
          id: 1,
          withdrawId: "K",
          amount: 500,
          bankAccountNumber: "1",
          bankAccountHolder: "WD Holder",
          bankName: "WD Bank",
          bankAccountType: "checking",
          identificationNumber: "WD-RUT",
          status: "done",
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.source).toBe("release");
    expect(tx.transactionAmount).toBe(-500); // release amount preserved (credit-debit)
    expect(tx.transactionType).toBe("payout"); // release type
    expect(tx.externalReference).toBe("rel-ext"); // release extRef preferred
    expect(tx.description).toBe("rel-desc"); // release description preferred
    // withdraw-sourced fields win on the merge
    expect(tx.bankAccountHolder).toBe("WD Holder");
    expect(tx.bankName).toBe("WD Bank");
    expect(tx.bankAccountType).toBe("checking");
    expect(tx.identificationNumber).toBe("WD-RUT");
    expect(tx.withdrawId).toBe("K");
    expect(tx.status).toBe("done");
  });

  it("merge falls back to withdraw fields when release ones are null", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
          recordType: "payout",
          description: null,
          externalReference: null,
        },
      ],
      withdraws: [
        {
          id: 1,
          withdrawId: "K",
          amount: 500,
          bankAccountNumber: "1",
          identificationNumber: "WD-RUT",
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.description).toBe("withdraw K"); // withdraw desc fallback
    expect(tx.externalReference).toBe("K"); // withdraw.externalReference (=withdrawId) fallback
  });

  it("does NOT merge when withdraw amount is JUST over epsilon (0.02)", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500.02, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(2);
  });

  it("reconcile key trims whitespace on both sides (' K ' release == withdraw 'K')", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: " K ",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "K", amount: 500, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
  });

  it("withdraw reconcile key falls back to sourceId when withdrawId missing — empty key skips reconcile", async () => {
    // withdrawId is what populates both withdrawId+sourceId on a withdraw row;
    // an empty withdrawId yields empty key -> not bucketed -> no merge.
    seed({
      releases: [
        {
          id: 1,
          sourceId: "",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
        },
      ],
      withdraws: [{ id: 1, withdrawId: "", amount: 500, bankAccountNumber: "1" }],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(2); // empty keys never reconcile
  });

  it("merged transactionDate = max(release, withdraw)", async () => {
    seed({
      releases: [
        {
          id: 1,
          sourceId: "K",
          netCreditAmount: 0,
          netDebitAmount: 500,
          payoutBankAccountNumber: "1",
          date: at("2026-01-10"),
        },
      ],
      withdraws: [
        {
          id: 1,
          withdrawId: "K",
          amount: 500,
          bankAccountNumber: "1",
          dateCreated: at("2026-01-20"),
        },
      ],
    });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows[0].transactionDate.getTime()).toBe(at("2026-01-20").getTime());
  });
});

describe("matchesFilter + isTestLike", () => {
  it("excludes test-like by default (description contains 'test')", async () => {
    seed({ settlements: [{ description: "TEST payment", transactionAmount: 1 }] });
    const rows = await fetchMergedTransactions({});
    expect(rows).toHaveLength(0);
  });

  it("includeTest:true keeps test-like rows", async () => {
    seed({ settlements: [{ description: "test payment", transactionAmount: 1 }] });
    const rows = await fetchMergedTransactions({ includeTest: true });
    expect(rows).toHaveLength(1);
  });

  it("minAmount boundary is inclusive", async () => {
    seed({ settlements: [{ transactionAmount: 100, sourceId: "a" }] });
    const eq = await fetchMergedTransactions({ minAmount: 100 });
    expect(eq).toHaveLength(1);
    seed({ settlements: [{ transactionAmount: 99, sourceId: "a" }] });
    const below = await fetchMergedTransactions({ minAmount: 100 });
    expect(below).toHaveLength(0);
  });

  it("maxAmount boundary is inclusive", async () => {
    seed({ settlements: [{ transactionAmount: 100 }] });
    const eq = await fetchMergedTransactions({ maxAmount: 100 });
    expect(eq).toHaveLength(1);
    seed({ settlements: [{ transactionAmount: 101 }] });
    const above = await fetchMergedTransactions({ maxAmount: 100 });
    expect(above).toHaveLength(0);
  });

  it("minAmount:0 is honored (not treated as falsy)", async () => {
    seed({ settlements: [{ transactionAmount: -5 }] });
    const rows = await fetchMergedTransactions({ minAmount: 0 });
    expect(rows).toHaveLength(0);
  });

  it("from boundary inclusive (>=)", async () => {
    seed({ settlements: [{ transactionDate: at("2026-01-15"), transactionAmount: 1 }] });
    const rows = await fetchMergedTransactions({ from: at("2026-01-15") });
    expect(rows).toHaveLength(1);
  });

  it("to boundary inclusive (<=)", async () => {
    seed({ settlements: [{ transactionDate: at("2026-01-15"), transactionAmount: 1 }] });
    const rows = await fetchMergedTransactions({ to: at("2026-01-15") });
    expect(rows).toHaveLength(1);
  });

  it("status filter is exact (case-insensitive) match, not substring", async () => {
    seed({ withdraws: [{ status: "approved", amount: 1 }] });
    const exact = await fetchMergedTransactions({ status: "APPROVED" });
    expect(exact).toHaveLength(1);
    seed({ withdraws: [{ status: "approved", amount: 1 }] });
    const partial = await fetchMergedTransactions({ status: "appr" });
    expect(partial).toHaveLength(0);
  });

  it("transactionType filter is substring (case-insensitive)", async () => {
    seed({ settlements: [{ transactionType: "payment_refund", transactionAmount: 1 }] });
    const rows = await fetchMergedTransactions({ transactionType: "REFUND" });
    expect(rows).toHaveLength(1);
  });

  it("search matches across description/extRef/paymentMethod/sourceId", async () => {
    seed({ settlements: [{ paymentMethod: "visa", transactionAmount: 1, sourceId: "x" }] });
    const hit = await fetchMergedTransactions({ search: "VISA" });
    expect(hit).toHaveLength(1);
    seed({ settlements: [{ paymentMethod: "visa", transactionAmount: 1, sourceId: "x" }] });
    const miss = await fetchMergedTransactions({ search: "mastercard" });
    expect(miss).toHaveLength(0);
  });

  it("results sorted by transactionDate desc", async () => {
    seed({
      settlements: [
        { transactionDate: at("2026-01-10"), transactionAmount: 1, sourceId: "a" },
        { transactionDate: at("2026-03-10"), transactionAmount: 1, sourceId: "b" },
        { transactionDate: at("2026-02-10"), transactionAmount: 1, sourceId: "c" },
      ],
    });
    const rows = await fetchMergedTransactions({});
    expect(rows.map((r) => r.transactionDate.getUTCMonth())).toEqual([2, 1, 0]);
  });
});

describe("fetchMergedTransactionsBySourceIds", () => {
  it("returns [] for empty / whitespace-only ids without hitting db", async () => {
    mockSettlementFindMany.mockResolvedValue([]);
    mockReleaseFindMany.mockResolvedValue([]);
    mockWithdrawFindMany.mockResolvedValue([]);
    const rows = await fetchMergedTransactionsBySourceIds(["", "   "]);
    expect(rows).toEqual([]);
    expect(mockSettlementFindMany).not.toHaveBeenCalled();
  });

  it("dedupes + trims source ids before querying", async () => {
    seed({ settlements: [{ transactionAmount: 1 }] });
    await fetchMergedTransactionsBySourceIds([" abc ", "abc", "def"]);
    const arg = mockSettlementFindMany.mock.calls[0][0] as {
      where: { sourceId: { in: string[] } };
    };
    expect(arg.where.sourceId.in.sort()).toEqual(["abc", "def"]);
  });

  it("always filters test-like rows regardless of flag", async () => {
    seed({ settlements: [{ description: "test", transactionAmount: 1 }] });
    const rows = await fetchMergedTransactionsBySourceIds(["set-0"]);
    expect(rows).toHaveLength(0);
  });
});

describe("getTransactionStats running totals + categorization", () => {
  it("splits in/out by sign and computes net = in - out", async () => {
    seed({
      settlements: [
        { transactionDate: at("2026-01-10"), transactionAmount: 100, sourceId: "a" },
        { transactionDate: at("2026-01-11"), transactionAmount: -30, sourceId: "b" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    expect(res.totals.in).toBe(100);
    expect(res.totals.out).toBe(30);
    expect(res.totals.net).toBe(70);
  });

  it("zero amount counts as 'in' (>= 0 branch) contributing 0", async () => {
    seed({ settlements: [{ transactionAmount: 0, transactionType: "z", sourceId: "a" }] });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    expect(res.totals.in).toBe(0);
    expect(res.totals.out).toBe(0);
    expect(res.totals.net).toBe(0);
  });

  it("buckets by month (UTC) and sorts ascending", async () => {
    seed({
      settlements: [
        { transactionDate: at("2026-03-05"), transactionAmount: 10, sourceId: "a" },
        { transactionDate: at("2026-01-05"), transactionAmount: 20, sourceId: "b" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-12-31") });
    expect(res.monthly.map((m) => m.month)).toEqual(["2026-01-01", "2026-03-01"]);
    expect(res.monthly[0].in).toBe(20);
    expect(res.monthly[1].in).toBe(10);
  });

  it("buckets by the America/Santiago calendar day when granularity = 'day'", async () => {
    seed({
      settlements: [
        // 12:00Z -> 09:00 Santiago (UTC-3 summer) -> same day, Jan 5.
        { transactionDate: at("2026-01-05"), transactionAmount: 10, sourceId: "a" },
        { transactionDate: at("2026-01-05"), transactionAmount: -4, sourceId: "b" },
        { transactionDate: at("2026-01-07"), transactionAmount: 20, sourceId: "c" },
      ],
    });
    const res = await getTransactionStats({
      from: at("2026-01-01"),
      granularity: "day",
      to: at("2026-01-31"),
    });
    expect(res.monthly.map((m) => m.month)).toEqual(["2026-01-05", "2026-01-07"]);
    expect(res.monthly[0].in).toBe(10);
    expect(res.monthly[0].out).toBe(4);
    expect(res.monthly[0].net).toBe(6);
    expect(res.monthly[1].in).toBe(20);
  });

  it("buckets a near-midnight instant by its Santiago day, not its UTC day", async () => {
    // 2026-01-06T02:30:00Z is 2026-01-05 23:30 in Santiago (UTC-3, summer DST).
    // Old UTC dayKey put it in 2026-01-06; the Santiago bucket is 2026-01-05.
    // A clearly-Jan-06-Santiago tx (15:00Z -> 12:00 Santiago) anchors the later day.
    seed({
      settlements: [
        {
          transactionDate: new Date("2026-01-06T02:30:00Z"),
          transactionAmount: 10,
          sourceId: "boundary",
        },
        {
          transactionDate: new Date("2026-01-06T15:00:00Z"),
          transactionAmount: 20,
          sourceId: "next-day",
        },
      ],
    });
    const res = await getTransactionStats({
      from: at("2026-01-01"),
      granularity: "day",
      to: at("2026-01-31"),
    });
    // The 02:30Z tx lands on the PREVIOUS Santiago calendar day.
    expect(res.monthly.map((m) => m.month)).toEqual(["2026-01-05", "2026-01-06"]);
    expect(res.monthly[0].in).toBe(10);
    expect(res.monthly[1].in).toBe(20);
  });

  it("defaults to month buckets when granularity is omitted", async () => {
    seed({
      settlements: [
        { transactionDate: at("2026-01-05"), transactionAmount: 10, sourceId: "a" },
        { transactionDate: at("2026-01-25"), transactionAmount: 5, sourceId: "b" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    expect(res.monthly.map((m) => m.month)).toEqual(["2026-01-01"]);
    expect(res.monthly[0].in).toBe(15);
  });

  it("monthly net accumulates both signs", async () => {
    seed({
      settlements: [
        { transactionDate: at("2026-01-05"), transactionAmount: 50, sourceId: "a" },
        { transactionDate: at("2026-01-20"), transactionAmount: -20, sourceId: "b" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    const jan = res.monthly[0];
    expect(jan.in).toBe(50);
    expect(jan.out).toBe(20);
    expect(jan.net).toBe(30);
  });

  it("byType direction: positive total -> IN, negative -> OUT, zero -> NEUTRO", async () => {
    seed({
      settlements: [
        { transactionType: "pos", transactionAmount: 10, sourceId: "a" },
        { transactionType: "neg", transactionAmount: -10, sourceId: "b" },
        { transactionType: "zero", transactionAmount: 5, sourceId: "c" },
        { transactionType: "zero", transactionAmount: -5, sourceId: "d" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    const byType = Object.fromEntries(res.byType.map((t) => [t.description, t]));
    expect(byType.pos.direction).toBe("IN");
    expect(byType.pos.total).toBe(10);
    expect(byType.neg.direction).toBe("OUT");
    expect(byType.neg.total).toBe(10); // abs
    expect(byType.zero.direction).toBe("NEUTRO");
    expect(byType.zero.total).toBe(0);
  });

  it("empty transactionType defaults to 'unknown'", async () => {
    seed({ settlements: [{ transactionType: "", transactionAmount: 1, sourceId: "a" }] });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    expect(res.byType.some((t) => t.description === "unknown")).toBe(true);
  });
});

describe("getParticipantLeaderboard (outgoing only)", () => {
  it("aggregates only negative (outgoing) amounts as abs", async () => {
    seed({
      withdraws: [
        { identificationNumber: "P1", bankAccountHolder: "Ana", amount: 100, withdrawId: "w1" },
        { identificationNumber: "P1", bankAccountHolder: "Ana", amount: 50, withdrawId: "w2" },
      ],
      settlements: [{ identificationNumber: "P1", transactionAmount: 999, sourceId: "incoming" }],
    });
    const res = await getParticipantLeaderboard({ limit: 10 });
    const p1 = res.data.find((d) => d.personId === "P1");
    expect(p1?.total).toBe(150); // 100+50, ignores the +999 incoming
    expect(p1?.count).toBe(2);
  });

  it("populates representative identificationNumber + bankAccountNumber per person", async () => {
    seed({
      withdraws: [
        {
          identificationNumber: "RUT-1",
          bankAccountHolder: "Ana",
          bankAccountNumber: "ACC-100",
          amount: 100,
          withdrawId: "w1",
        },
        {
          identificationNumber: "RUT-1",
          bankAccountHolder: "Ana",
          bankAccountNumber: "ACC-200",
          amount: 50,
          withdrawId: "w2",
        },
      ],
    });
    const res = await getParticipantLeaderboard({ limit: 10 });
    const p1 = res.data.find((d) => d.personId === "RUT-1");
    expect(p1?.identificationNumber).toBe("RUT-1");
    // first non-null account seen wins
    expect(p1?.bankAccountNumber).toBe("ACC-100");
  });

  it("sorts by total desc and respects limit", async () => {
    seed({
      withdraws: [
        { identificationNumber: "A", amount: 10, withdrawId: "a" },
        { identificationNumber: "B", amount: 200, withdrawId: "b" },
        { identificationNumber: "C", amount: 50, withdrawId: "c" },
      ],
    });
    const res = await getParticipantLeaderboard({ limit: 2 });
    expect(res.data.map((d) => d.personId)).toEqual(["B", "C"]);
  });

  it("zero-amount row is NOT counted as outgoing (strict < 0)", async () => {
    seed({ settlements: [{ identificationNumber: "Z", transactionAmount: 0, sourceId: "s" }] });
    const res = await getParticipantLeaderboard({});
    const z = res.data.find((d) => d.personId === "Z");
    expect(z?.total).toBe(0);
    expect(z?.count).toBe(0); // 0 is not < 0, so not counted
  });

  it("participant with only incoming is present with zero outgoing", async () => {
    seed({ settlements: [{ identificationNumber: "X", transactionAmount: 500, sourceId: "s" }] });
    const res = await getParticipantLeaderboard({});
    const x = res.data.find((d) => d.personId === "X");
    expect(x?.total).toBe(0);
    expect(x?.count).toBe(0);
  });
});

describe("getParticipantInsight monthly + counterpart buckets", () => {
  it("splits incoming/outgoing per month for the matched participant", async () => {
    seed({
      settlements: [
        {
          identificationNumber: "P",
          transactionAmount: 300,
          transactionDate: at("2026-01-10"),
          sourceId: "s1",
        },
      ],
      withdraws: [
        {
          identificationNumber: "P",
          amount: 120,
          dateCreated: at("2026-01-15"),
          withdrawId: "w1",
        },
      ],
    });
    const res = await getParticipantInsight("P", {});
    const jan = res.monthly.find((m) => m.month === "2026-01-01");
    expect(jan?.incomingAmount).toBe(300);
    expect(jan?.incomingCount).toBe(1);
    expect(jan?.outgoingAmount).toBe(120);
    expect(jan?.outgoingCount).toBe(1);
  });

  it("monthly sorted descending by month", async () => {
    seed({
      settlements: [
        {
          identificationNumber: "P",
          transactionAmount: 10,
          transactionDate: at("2026-01-10"),
          sourceId: "s1",
        },
        {
          identificationNumber: "P",
          transactionAmount: 10,
          transactionDate: at("2026-03-10"),
          sourceId: "s2",
        },
      ],
    });
    const res = await getParticipantInsight("P", {});
    expect(res.monthly.map((m) => m.month)).toEqual(["2026-03-01", "2026-01-01"]);
  });

  it("zero-amount row goes to incoming branch (not outgoing) in monthly + counterpart", async () => {
    seed({
      settlements: [
        {
          identificationNumber: "P",
          transactionAmount: 0,
          transactionDate: at("2026-01-10"),
          sourceId: "s1",
        },
      ],
    });
    const res = await getParticipantInsight("P", {});
    const jan = res.monthly.find((m) => m.month === "2026-01-01");
    expect(jan?.outgoingCount).toBe(0); // 0 is not < 0
    expect(jan?.incomingCount).toBe(1); // falls into else (incoming)
    expect(res.counterparts[0].outgoingCount).toBe(0);
    expect(res.counterparts[0].incomingCount).toBe(1);
  });

  it("non-matching participant yields empty buckets", async () => {
    seed({ settlements: [{ identificationNumber: "OTHER", transactionAmount: 1, sourceId: "s" }] });
    const res = await getParticipantInsight("P", {});
    expect(res.monthly).toHaveLength(0);
    expect(res.counterparts).toHaveLength(0);
  });

  it("counterparts sorted by outgoingAmount descending", async () => {
    seed({
      withdraws: [
        {
          identificationNumber: "P",
          bankAccountHolder: "Small",
          bankAccountNumber: "S",
          amount: 10,
          withdrawId: "w1",
        },
        {
          identificationNumber: "P",
          bankAccountHolder: "Big",
          bankAccountNumber: "B",
          amount: 900,
          withdrawId: "w2",
        },
      ],
    });
    const res = await getParticipantInsight("P", {});
    expect(res.counterparts.map((c) => c.outgoingAmount)).toEqual([900, 10]);
  });

  it("counterpart fallback id chain when identificationNumber null", async () => {
    seed({
      withdraws: [
        {
          identificationNumber: null,
          bankAccountNumber: "ACC9",
          bankAccountHolder: "Holder",
          amount: 80,
          withdrawId: "MATCHME",
        },
      ],
    });
    const res = await getParticipantInsight("MATCHME", {});
    expect(res.counterparts).toHaveLength(1);
    expect(res.counterparts[0].counterpartId).toBe("ACC9");
    expect(res.counterparts[0].outgoingAmount).toBe(80);
  });
});

// ─── db query args: date-where building + select shape ────────────────────────

describe("fetchMergedTransactions db query args", () => {
  it("passes where:undefined to all three tables when no from/to", async () => {
    seed({});
    await fetchMergedTransactions({});
    expect((mockSettlementFindMany.mock.calls[0][0] as { where?: unknown }).where).toBeUndefined();
    expect((mockReleaseFindMany.mock.calls[0][0] as { where?: unknown }).where).toBeUndefined();
    expect((mockWithdrawFindMany.mock.calls[0][0] as { where?: unknown }).where).toBeUndefined();
  });

  it("builds gte+lte windows on the correct column per table when from AND to given", async () => {
    seed({});
    const from = at("2026-01-01");
    const to = at("2026-01-31");
    await fetchMergedTransactions({ from, to });
    expect((mockSettlementFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      transactionDate: { gte: from, lte: to },
    });
    expect((mockReleaseFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      date: { gte: from, lte: to },
    });
    expect((mockWithdrawFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      dateCreated: { gte: from, lte: to },
    });
  });

  it("includes only gte when from given without to", async () => {
    seed({});
    const from = at("2026-02-01");
    await fetchMergedTransactions({ from });
    expect((mockSettlementFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      transactionDate: { gte: from },
    });
    expect((mockReleaseFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      date: { gte: from },
    });
    expect((mockWithdrawFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      dateCreated: { gte: from },
    });
  });

  it("includes only lte when to given without from", async () => {
    seed({});
    const to = at("2026-03-01");
    await fetchMergedTransactions({ to });
    expect((mockSettlementFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      transactionDate: { lte: to },
    });
    expect((mockReleaseFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      date: { lte: to },
    });
    expect((mockWithdrawFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      dateCreated: { lte: to },
    });
  });

  it("selects the exact column set for each table", async () => {
    seed({});
    await fetchMergedTransactions({});
    const settlementSelect = (
      mockSettlementFindMany.mock.calls[0][0] as { select: Record<string, boolean> }
    ).select;
    expect(settlementSelect).toEqual({
      id: true,
      metadata: true,
      description: true,
      externalReference: true,
      identificationNumber: true,
      paymentMethod: true,
      paymentMethodType: true,
      settlementNetAmount: true,
      sourceId: true,
      transactionAmount: true,
      transactionDate: true,
      transactionType: true,
    });
    const releaseSelect = (
      mockReleaseFindMany.mock.calls[0][0] as { select: Record<string, boolean> }
    ).select;
    expect(releaseSelect.netCreditAmount).toBe(true);
    expect(releaseSelect.netDebitAmount).toBe(true);
    expect(releaseSelect.payoutBankAccountNumber).toBe(true);
    expect(releaseSelect.date).toBe(true);
    const withdrawSelect = (
      mockWithdrawFindMany.mock.calls[0][0] as { select: Record<string, boolean> }
    ).select;
    expect(withdrawSelect.amount).toBe(true);
    expect(withdrawSelect.withdrawId).toBe(true);
    expect(withdrawSelect.dateCreated).toBe(true);
  });
});

describe("fetchMergedTransactionsBySourceIds db query args", () => {
  it("queries settlement+release by sourceId.in and withdraw by withdrawId.in", async () => {
    seed({});
    await fetchMergedTransactionsBySourceIds(["abc", "def"]);
    expect((mockSettlementFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      sourceId: { in: ["abc", "def"] },
    });
    expect((mockReleaseFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      sourceId: { in: ["abc", "def"] },
    });
    expect((mockWithdrawFindMany.mock.calls[0][0] as { where: unknown }).where).toEqual({
      withdrawId: { in: ["abc", "def"] },
    });
  });

  it("does not touch any table for empty ids (short-circuits before Promise.all)", async () => {
    await fetchMergedTransactionsBySourceIds([]);
    expect(mockSettlementFindMany).not.toHaveBeenCalled();
    expect(mockReleaseFindMany).not.toHaveBeenCalled();
    expect(mockWithdrawFindMany).not.toHaveBeenCalled();
  });
});

// ─── metadata extraction (getMetaString key precedence + trimming) ────────────

describe("settlement metadata extraction", () => {
  it("pulls bank/holder/account/type fields from metadata with first-key precedence", async () => {
    seed({
      settlements: [
        {
          transactionAmount: 1,
          metadata: {
            bank_account_holder_name: "Holder One",
            name: "ignored",
            bank_account_number: "  ACC-77  ",
            bank_account_type: "savings",
            bank_name: "Banco X",
            withdraw_id: "WX",
          },
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.bankAccountHolder).toBe("Holder One");
    expect(tx.bankAccountNumber).toBe("ACC-77"); // trimmed
    expect(tx.bankAccountType).toBe("savings");
    expect(tx.bankName).toBe("Banco X");
    expect(tx.withdrawId).toBe("WX");
  });

  it("falls back to the second key when the first is missing/blank", async () => {
    seed({
      settlements: [
        {
          transactionAmount: 1,
          metadata: { name: "Second Holder", account_number: "ACC-2", bank: "Banco2" },
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.bankAccountHolder).toBe("Second Holder");
    expect(tx.bankAccountNumber).toBe("ACC-2");
    expect(tx.bankName).toBe("Banco2");
  });

  it("ignores whitespace-only metadata values (treated as absent)", async () => {
    seed({
      settlements: [{ transactionAmount: 1, metadata: { bank_account_holder_name: "   " } }],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.bankAccountHolder).toBeNull();
  });

  it("ignores non-object metadata (array / primitive) -> all meta fields null", async () => {
    seed({
      settlements: [{ transactionAmount: 1, metadata: ["bank_account_number", "x"] }],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.bankAccountNumber).toBeNull();
    expect(tx.bankAccountHolder).toBeNull();
  });

  it("identificationNumber prefers the column over metadata recipient_rut", async () => {
    seed({
      settlements: [
        {
          transactionAmount: 1,
          identificationNumber: "COL-RUT",
          metadata: { recipient_rut: "META" },
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.identificationNumber).toBe("COL-RUT");
  });

  it("identificationNumber falls back to metadata recipient_rut when column null", async () => {
    seed({
      settlements: [
        {
          transactionAmount: 1,
          identificationNumber: null,
          metadata: { recipient_rut: "META-RUT" },
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.identificationNumber).toBe("META-RUT");
  });

  it("settlement settlementNetAmount coerced when present, null when absent", async () => {
    seed({ settlements: [{ transactionAmount: 1, settlementNetAmount: "88.5" }] });
    const [withNet] = await fetchMergedTransactions({ includeTest: true });
    expect(withNet.settlementNetAmount).toBe(88.5);
    seed({ settlements: [{ transactionAmount: 1, settlementNetAmount: null }] });
    const [withoutNet] = await fetchMergedTransactions({ includeTest: true });
    expect(withoutNet.settlementNetAmount).toBeNull();
  });

  it("settlement static fields: source=settlement, status=null, passthrough sourceId/extRef/paymentMethod", async () => {
    seed({
      settlements: [
        {
          transactionAmount: 1,
          sourceId: "SRC-1",
          externalReference: "EXT-1",
          paymentMethod: "visa",
          paymentMethodType: "credit_card",
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.source).toBe("settlement");
    expect(tx.status).toBeNull();
    expect(tx.sourceId).toBe("SRC-1");
    expect(tx.externalReference).toBe("EXT-1");
    expect(tx.paymentMethod).toBe("visa");
    expect(tx.paymentMethodType).toBe("credit_card");
    expect(tx.id).toBe(1); // settlement id is NOT offset
  });
});

describe("release metadata + bankAccountNumber precedence", () => {
  it("bankAccountNumber prefers payoutBankAccountNumber column over metadata", async () => {
    seed({
      releases: [
        {
          grossAmount: 1,
          payoutBankAccountNumber: "PAYOUT-1",
          metadata: { payout_bank_account_number: "META-1" },
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.bankAccountNumber).toBe("PAYOUT-1");
  });

  it("bankAccountNumber falls back to metadata payout key when column null", async () => {
    seed({
      releases: [
        {
          grossAmount: 1,
          payoutBankAccountNumber: null,
          metadata: { payout_bank_account_number: "META-PAY" },
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.bankAccountNumber).toBe("META-PAY");
  });

  it("release settlementNetAmount mirrors netCreditAmount (coerced / null)", async () => {
    seed({ releases: [{ netCreditAmount: 70, netDebitAmount: 0 }] });
    const [withCredit] = await fetchMergedTransactions({ includeTest: true });
    expect(withCredit.settlementNetAmount).toBe(70);
    seed({ releases: [{ netCreditAmount: null, netDebitAmount: null, grossAmount: 1 }] });
    const [noCredit] = await fetchMergedTransactions({ includeTest: true });
    expect(noCredit.settlementNetAmount).toBeNull();
  });

  it("release grossAmount populated when present, null when absent", async () => {
    seed({ releases: [{ netCreditAmount: 5, netDebitAmount: 0, grossAmount: 99 }] });
    const [withGross] = await fetchMergedTransactions({ includeTest: true });
    expect(withGross.grossAmount).toBe(99);
    seed({ releases: [{ netCreditAmount: 5, netDebitAmount: 0, grossAmount: null }] });
    const [noGross] = await fetchMergedTransactions({ includeTest: true });
    expect(noGross.grossAmount).toBeNull();
  });

  it("release static fields: source=release, status=null, withdrawId=null", async () => {
    seed({ releases: [{ grossAmount: 1, sourceId: "REL-SRC" }] });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.source).toBe("release");
    expect(tx.status).toBeNull();
    expect(tx.withdrawId).toBeNull();
    expect(tx.sourceId).toBe("REL-SRC");
  });
});

describe("withdraw mapping static fields", () => {
  it("withdraw with no withdrawId uses bare 'withdraw' description and offset id", async () => {
    seed({ withdraws: [{ id: 4, withdrawId: "", amount: 10, status: "pending" }] });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.description).toBe("withdraw");
    expect(tx.id).toBe(-2_000_000_000 - 4);
    expect(tx.source).toBe("withdraw");
    expect(tx.transactionType).toBe("withdraw");
    expect(tx.status).toBe("pending");
    expect(tx.grossAmount).toBeNull();
    expect(tx.settlementNetAmount).toBeNull();
    expect(tx.paymentMethod).toBeNull();
  });

  it("withdraw externalReference + sourceId mirror withdrawId, bank fields passthrough", async () => {
    seed({
      withdraws: [
        {
          withdrawId: "WID",
          amount: 5,
          bankAccountHolder: "H",
          bankAccountNumber: "N",
          bankAccountType: "T",
          bankName: "B",
          identificationNumber: "RUT",
        },
      ],
    });
    const [tx] = await fetchMergedTransactions({ includeTest: true });
    expect(tx.externalReference).toBe("WID");
    expect(tx.sourceId).toBe("WID");
    expect(tx.withdrawId).toBe("WID");
    expect(tx.bankAccountHolder).toBe("H");
    expect(tx.bankAccountNumber).toBe("N");
    expect(tx.bankAccountType).toBe("T");
    expect(tx.bankName).toBe("B");
    expect(tx.identificationNumber).toBe("RUT");
  });
});

// ─── listTransactions (offset/limit slice + includeTotal) ─────────────────────

describe("listTransactions pagination", () => {
  function seedN(n: number) {
    // distinct dates descending so order is deterministic
    seed({
      settlements: Array.from({ length: n }, (_, i) => ({
        transactionAmount: i + 1,
        sourceId: `s${i}`,
        transactionDate: at(`2026-01-${String(i + 1).padStart(2, "0")}`),
      })),
    });
  }

  it("returns total = full count and the first `limit` rows", async () => {
    seedN(5);
    const res = await listTransactions({}, 2, 0);
    expect(res.total).toBe(5);
    expect(res.transactions).toHaveLength(2);
  });

  it("slices by offset (offset+limit window)", async () => {
    seedN(5);
    const res = await listTransactions({}, 2, 2);
    expect(res.transactions).toHaveLength(2);
    // sorted desc by date: ids s4,s3,s2,s1,s0 -> offset 2 = s2,s1
    expect(res.transactions.map((t) => t.sourceId)).toEqual(["s2", "s1"]);
  });

  it("includeTotal=false yields total undefined but still slices", async () => {
    seedN(5);
    const res = await listTransactions({}, 2, 0, false);
    expect(res.total).toBeUndefined();
    expect(res.transactions).toHaveLength(2);
  });

  it("defaults limit=100 offset=0 includeTotal=true", async () => {
    seedN(3);
    const res = await listTransactions({});
    expect(res.total).toBe(3);
    expect(res.transactions).toHaveLength(3);
  });
});

// ─── leaderboard participant key + displayName fallbacks ──────────────────────

describe("getParticipantLeaderboard participant identity", () => {
  it("groups by identificationNumber first; displayName prefers holder", async () => {
    seed({
      withdraws: [
        { identificationNumber: "RUT", bankAccountHolder: "Ana", amount: 100, withdrawId: "w" },
      ],
    });
    const res = await getParticipantLeaderboard({});
    expect(res.data[0].personId).toBe("RUT");
    expect(res.data[0].personName).toBe("Ana");
  });

  it("falls back personId to bankAccountNumber when no rut/holder/withdrawId", async () => {
    // a settlement with only a metadata bank account number, no rut
    seed({
      settlements: [
        {
          transactionAmount: -10,
          sourceId: "s",
          metadata: { bank_account_number: "ACCKEY" },
        },
      ],
    });
    const res = await getParticipantLeaderboard({});
    expect(res.data[0].personId).toBe("ACCKEY");
    expect(res.data[0].total).toBe(10);
  });

  it("displayName defaults to 'Desconocido' when neither holder nor rut", async () => {
    seed({
      settlements: [
        { transactionAmount: -10, sourceId: "s", metadata: { bank_account_number: "ACCKEY" } },
      ],
    });
    const res = await getParticipantLeaderboard({});
    expect(res.data[0].personName).toBe("Desconocido");
  });

  it("unknown participant key used when no identifying field at all", async () => {
    seed({ settlements: [{ transactionAmount: -10, sourceId: "s" }] });
    const res = await getParticipantLeaderboard({});
    expect(res.data[0].personId).toBe("unknown");
  });

  it("status='ok' wrapper is returned", async () => {
    seed({ withdraws: [{ identificationNumber: "A", amount: 1, withdrawId: "w" }] });
    const res = await getParticipantLeaderboard({});
    expect(res.status).toBe("ok");
  });

  it("no limit -> all rows returned (MAX_SAFE_INTEGER slice keeps everyone)", async () => {
    seed({
      withdraws: [
        { identificationNumber: "A", amount: 10, withdrawId: "a" },
        { identificationNumber: "B", amount: 20, withdrawId: "b" },
        { identificationNumber: "C", amount: 30, withdrawId: "c" },
      ],
    });
    const res = await getParticipantLeaderboard({});
    expect(res.data).toHaveLength(3);
    expect(res.data.map((d) => d.personId)).toEqual(["C", "B", "A"]);
  });

  it("accumulates outgoing across rows of the same participant (sum, not overwrite)", async () => {
    seed({
      withdraws: [
        { identificationNumber: "P", amount: 100, withdrawId: "w1" },
        { identificationNumber: "P", amount: 250, withdrawId: "w2" },
      ],
    });
    const res = await getParticipantLeaderboard({});
    expect(res.data[0].total).toBe(350);
    expect(res.data[0].count).toBe(2);
  });

  it("first non-null rut/account wins (??= does not overwrite with later values)", async () => {
    seed({
      withdraws: [
        {
          identificationNumber: "P",
          bankAccountNumber: null,
          amount: 10,
          withdrawId: "w1",
        },
        {
          identificationNumber: "P",
          bankAccountNumber: "LATE-ACC",
          amount: 10,
          withdrawId: "w2",
        },
      ],
    });
    const res = await getParticipantLeaderboard({});
    // grouped by "P"; first row had null account, second supplies it via ??=
    expect(res.data[0].bankAccountNumber).toBe("LATE-ACC");
  });
});

// ─── insight counterpart aggregation depth ────────────────────────────────────

describe("getParticipantInsight aggregation details", () => {
  it("matches participant by sourceId too (not only rut/account/holder)", async () => {
    seed({
      settlements: [
        { transactionAmount: 50, sourceId: "MATCH-SRC", transactionDate: at("2026-02-10") },
      ],
    });
    const res = await getParticipantInsight("MATCH-SRC", {});
    expect(res.monthly).toHaveLength(1);
    expect(res.monthly[0].incomingAmount).toBe(50);
  });

  it("counterpart incoming accumulates and counterpart='Desconocido' when no holder", async () => {
    seed({
      settlements: [
        {
          identificationNumber: "P",
          transactionAmount: 10,
          sourceId: "s1",
          transactionDate: at("2026-01-05"),
        },
        {
          identificationNumber: "P",
          transactionAmount: 30,
          sourceId: "s2",
          transactionDate: at("2026-01-06"),
        },
      ],
    });
    const res = await getParticipantInsight("P", {});
    expect(res.counterparts).toHaveLength(1);
    expect(res.counterparts[0].counterpart).toBe("Desconocido");
    expect(res.counterparts[0].incomingAmount).toBe(40);
    expect(res.counterparts[0].incomingCount).toBe(2);
  });

  it("identificationType is always 'RUT' and bankBranch always null", async () => {
    seed({ withdraws: [{ identificationNumber: "P", amount: 5, withdrawId: "w" }] });
    const res = await getParticipantInsight("P", {});
    expect(res.counterparts[0].identificationType).toBe("RUT");
    expect(res.counterparts[0].bankBranch).toBeNull();
  });

  it("participant + status='ok' echoed in the response", async () => {
    seed({ settlements: [{ identificationNumber: "P", transactionAmount: 1, sourceId: "s" }] });
    const res = await getParticipantInsight("P", {});
    expect(res.status).toBe("ok");
    expect(res.participant).toBe("P");
  });

  it("monthly incoming vs outgoing split: outgoing uses abs, incoming raw", async () => {
    seed({
      settlements: [
        {
          identificationNumber: "P",
          transactionAmount: 200,
          sourceId: "in",
          transactionDate: at("2026-05-10"),
        },
      ],
      withdraws: [
        { identificationNumber: "P", amount: 75, withdrawId: "out", dateCreated: at("2026-05-15") },
      ],
    });
    const res = await getParticipantInsight("P", {});
    const may = res.monthly.find((m) => m.month === "2026-05-01");
    expect(may?.incomingAmount).toBe(200);
    expect(may?.outgoingAmount).toBe(75); // abs(-75)
    expect(may?.incomingCount).toBe(1);
    expect(may?.outgoingCount).toBe(1);
  });
});

// ─── stats byType total sign + accumulation ───────────────────────────────────

describe("getTransactionStats byType accumulation", () => {
  it("accumulates the SIGNED total per type then reports abs + direction", async () => {
    seed({
      settlements: [
        { transactionType: "t", transactionAmount: 100, sourceId: "a" },
        { transactionType: "t", transactionAmount: -30, sourceId: "b" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    const t = res.byType.find((x) => x.description === "t");
    expect(t?.total).toBe(70); // abs(100 - 30)
    expect(t?.direction).toBe("IN"); // signed total 70 > 0
  });

  it("net signed total drives OUT when negatives dominate", async () => {
    seed({
      settlements: [
        { transactionType: "t", transactionAmount: 10, sourceId: "a" },
        { transactionType: "t", transactionAmount: -40, sourceId: "b" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    const t = res.byType.find((x) => x.description === "t");
    expect(t?.total).toBe(30); // abs(10 - 40)
    expect(t?.direction).toBe("OUT");
  });

  it("totals.net is exactly in minus out", async () => {
    seed({
      settlements: [
        { transactionAmount: 250, sourceId: "a" },
        { transactionAmount: -90, sourceId: "b" },
        { transactionAmount: -10, sourceId: "c" },
      ],
    });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    expect(res.totals.in).toBe(250);
    expect(res.totals.out).toBe(100);
    expect(res.totals.net).toBe(150);
  });

  it("status='ok' wrapper returned", async () => {
    seed({ settlements: [{ transactionAmount: 1, sourceId: "a" }] });
    const res = await getTransactionStats({ from: at("2026-01-01"), to: at("2026-01-31") });
    expect(res.status).toBe("ok");
  });
});
