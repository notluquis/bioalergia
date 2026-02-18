import { db } from "@finanzas/db";

export type TransactionFilters = {
  from?: Date;
  to?: Date;
  bankAccountNumber?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  status?: string;
  transactionType?: string;
  description?: string;
  externalReference?: string;
  sourceId?: string;
  includeTest?: boolean;
};

type RawMeta = Record<string, unknown>;
type DecimalLike = { toString(): string };
type NumericInput = DecimalLike | null | number | string | undefined;

type SettlementRow = {
  description: null | string;
  externalReference: null | string;
  id: number;
  identificationNumber: null | string;
  metadata: unknown;
  paymentMethod: null | string;
  settlementNetAmount: NumericInput;
  sourceId: string;
  transactionAmount: NumericInput;
  transactionDate: Date;
  transactionType: string;
};

type ReleaseRow = {
  date: Date;
  description: null | string;
  externalReference: null | string;
  grossAmount: NumericInput;
  id: number;
  identificationNumber: null | string;
  metadata: unknown;
  netCreditAmount: NumericInput;
  netDebitAmount: NumericInput;
  paymentMethod: null | string;
  payoutBankAccountNumber: null | string;
  recordType: null | string;
  sourceId: string;
};

type WithdrawRow = {
  amount: NumericInput;
  bankAccountHolder: null | string;
  bankAccountNumber: null | string;
  bankAccountType: null | string;
  bankName: null | string;
  dateCreated: Date;
  id: number;
  identificationNumber: null | string;
  status: null | string;
  withdrawId: string;
};

type UnifiedTransaction = {
  id: number;
  source: "release" | "settlement" | "withdraw";
  transactionDate: Date;
  description: null | string;
  transactionType: string;
  transactionAmount: number;
  status: null | string;
  externalReference: null | string;
  sourceId: null | string;
  paymentMethod: null | string;
  settlementNetAmount: null | number;
  identificationNumber: null | string;
  bankAccountHolder: null | string;
  bankAccountNumber: null | string;
  bankAccountType: null | string;
  bankName: null | string;
  withdrawId: null | string;
};

const toLower = (value: null | string | undefined) => value?.toLowerCase() ?? "";
const ACCOUNT_SPACES_REGEX = /\s+/g;
const LEADING_ZEROS_REGEX = /^0+/;
const normalizeAccountIdentifier = (value: null | string | undefined) =>
  (() => {
    const compact = (value ?? "").replaceAll(ACCOUNT_SPACES_REGEX, "").toUpperCase();
    if (!compact) {
      return "";
    }
    const normalized = compact.replace(LEADING_ZEROS_REGEX, "");
    return normalized.length > 0 ? normalized : "0";
  })();
const asNumber = (value: NumericInput) => {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return Number(value.toString());
};

const asObject = (value: unknown): RawMeta =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RawMeta) : {};

const getMetaString = (meta: RawMeta, keys: string[]) => {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;

const RELEASE_ID_OFFSET = -1_000_000_000;
const WITHDRAW_ID_OFFSET = -2_000_000_000;
const MONEY_EPSILON = 0.01;

function mapSettlementRow(row: SettlementRow): UnifiedTransaction {
  const meta = asObject(row.metadata);
  return {
    id: row.id,
    source: "settlement",
    transactionDate: row.transactionDate,
    description: row.description ?? null,
    transactionType: row.transactionType,
    transactionAmount: asNumber(row.transactionAmount),
    status: null,
    externalReference: row.externalReference ?? null,
    sourceId: row.sourceId ?? null,
    paymentMethod: row.paymentMethod ?? null,
    settlementNetAmount: row.settlementNetAmount != null ? asNumber(row.settlementNetAmount) : null,
    identificationNumber:
      row.identificationNumber ??
      getMetaString(meta, ["recipient_rut", "rut", "identification_number"]),
    bankAccountHolder:
      getMetaString(meta, ["bank_account_holder_name", "name", "account_holder"]) ?? null,
    bankAccountNumber: getMetaString(meta, ["bank_account_number", "account_number"]) ?? null,
    bankAccountType: getMetaString(meta, ["bank_account_type", "account_type"]) ?? null,
    bankName: getMetaString(meta, ["bank_name", "bank"]) ?? null,
    withdrawId: getMetaString(meta, ["withdraw_id", "id"]) ?? null,
  };
}

function mapReleaseRow(row: ReleaseRow): UnifiedTransaction {
  const meta = asObject(row.metadata);
  const credit = asNumber(row.netCreditAmount);
  const debit = asNumber(row.netDebitAmount);
  const amount = credit !== 0 || debit !== 0 ? credit - debit : asNumber(row.grossAmount);

  return {
    id: RELEASE_ID_OFFSET - row.id,
    source: "release",
    transactionDate: row.date,
    description: row.description ?? null,
    transactionType: row.recordType ?? "release",
    transactionAmount: amount,
    status: null,
    externalReference: row.externalReference ?? null,
    sourceId: row.sourceId ?? null,
    paymentMethod: row.paymentMethod ?? null,
    settlementNetAmount: row.netCreditAmount != null ? asNumber(row.netCreditAmount) : null,
    identificationNumber:
      row.identificationNumber ??
      getMetaString(meta, ["recipient_rut", "rut", "identification_number"]),
    bankAccountHolder:
      getMetaString(meta, ["bank_account_holder_name", "name", "account_holder"]) ?? null,
    bankAccountNumber:
      row.payoutBankAccountNumber ??
      getMetaString(meta, [
        "payout_bank_account_number",
        "bank_account_number",
        "account_number",
      ]) ??
      null,
    bankAccountType: getMetaString(meta, ["bank_account_type", "account_type"]) ?? null,
    bankName: getMetaString(meta, ["bank_name", "bank"]) ?? null,
    withdrawId: getMetaString(meta, ["withdraw_id", "id"]) ?? null,
  };
}

function mapWithdrawRow(row: WithdrawRow): UnifiedTransaction {
  return {
    id: WITHDRAW_ID_OFFSET - row.id,
    source: "withdraw",
    transactionDate: row.dateCreated,
    description: row.withdrawId ? `withdraw ${row.withdrawId}` : "withdraw",
    transactionType: "withdraw",
    transactionAmount: -Math.abs(asNumber(row.amount)),
    status: row.status ?? null,
    externalReference: row.withdrawId ?? null,
    sourceId: row.withdrawId ?? null,
    paymentMethod: null,
    settlementNetAmount: null,
    identificationNumber: row.identificationNumber ?? null,
    bankAccountHolder: row.bankAccountHolder ?? null,
    bankAccountNumber: row.bankAccountNumber ?? null,
    bankAccountType: row.bankAccountType ?? null,
    bankName: row.bankName ?? null,
    withdrawId: row.withdrawId ?? null,
  };
}

function getReleaseReconcileKey(tx: UnifiedTransaction) {
  if (tx.source !== "release") {
    return "";
  }
  return tx.sourceId?.trim() ?? "";
}

function getWithdrawReconcileKey(tx: UnifiedTransaction) {
  if (tx.source !== "withdraw") {
    return "";
  }
  return tx.withdrawId?.trim() ?? tx.sourceId?.trim() ?? "";
}

function sameAccount(a: UnifiedTransaction, b: UnifiedTransaction) {
  const aa = normalizeAccountIdentifier(a.bankAccountNumber);
  const bb = normalizeAccountIdentifier(b.bankAccountNumber);
  if (aa.length === 0 || bb.length === 0) {
    return true;
  }
  return aa === bb;
}

function sameAmount(a: UnifiedTransaction, b: UnifiedTransaction) {
  return Math.abs(Math.abs(a.transactionAmount) - Math.abs(b.transactionAmount)) <= MONEY_EPSILON;
}

function mergeReleaseWithdraw(
  release: UnifiedTransaction,
  withdraw: UnifiedTransaction,
): UnifiedTransaction {
  const transactionDate =
    release.transactionDate > withdraw.transactionDate
      ? release.transactionDate
      : withdraw.transactionDate;

  return {
    id: release.id,
    source: "release",
    transactionDate,
    description: release.description ?? withdraw.description,
    transactionType: release.transactionType,
    transactionAmount: release.transactionAmount,
    status: withdraw.status ?? release.status,
    externalReference: release.externalReference ?? withdraw.externalReference,
    sourceId: release.sourceId ?? withdraw.sourceId,
    paymentMethod: release.paymentMethod ?? withdraw.paymentMethod,
    settlementNetAmount: release.settlementNetAmount ?? withdraw.settlementNetAmount,
    identificationNumber: withdraw.identificationNumber ?? release.identificationNumber,
    bankAccountHolder: withdraw.bankAccountHolder ?? release.bankAccountHolder,
    bankAccountNumber: withdraw.bankAccountNumber ?? release.bankAccountNumber,
    bankAccountType: withdraw.bankAccountType ?? release.bankAccountType,
    bankName: withdraw.bankName ?? release.bankName,
    withdrawId: withdraw.withdrawId ?? release.withdrawId ?? release.sourceId,
  };
}

function reconcileTransactions(rows: UnifiedTransaction[]): UnifiedTransaction[] {
  const withdrawByKey = new Map<string, UnifiedTransaction[]>();
  const usedWithdraw = new Set<number>();
  const result: UnifiedTransaction[] = [];

  for (const row of rows) {
    if (row.source !== "withdraw") {
      continue;
    }
    const key = getWithdrawReconcileKey(row);
    if (!key) {
      continue;
    }
    const bucket = withdrawByKey.get(key) ?? [];
    bucket.push(row);
    withdrawByKey.set(key, bucket);
  }

  for (const row of rows) {
    if (row.source !== "release") {
      continue;
    }
    const key = getReleaseReconcileKey(row);
    if (!key) {
      continue;
    }

    const candidates = withdrawByKey.get(key);
    if (!candidates || candidates.length === 0) {
      continue;
    }

    const matched = candidates.find(
      (candidate) =>
        !usedWithdraw.has(candidate.id) &&
        sameAmount(row, candidate) &&
        sameAccount(row, candidate),
    );
    if (!matched) {
      continue;
    }

    usedWithdraw.add(matched.id);
    result.push(mergeReleaseWithdraw(row, matched));
  }

  for (const row of rows) {
    if (row.source === "withdraw" && usedWithdraw.has(row.id)) {
      continue;
    }
    if (row.source === "release" && getReleaseReconcileKey(row)) {
      const alreadyMerged = result.some((merged) => merged.id === row.id);
      if (alreadyMerged) {
        continue;
      }
    }
    result.push(row);
  }

  return result;
}

function isTestLike(tx: UnifiedTransaction) {
  const marker = "test";
  return (
    toLower(tx.description).includes(marker) ||
    toLower(tx.sourceId).includes(marker) ||
    toLower(tx.externalReference).includes(marker)
  );
}

function matchesFilter(tx: UnifiedTransaction, filters: TransactionFilters) {
  const normalizedFilterAccount = normalizeAccountIdentifier(filters.bankAccountNumber);
  const checks = [
    () => !filters.from || tx.transactionDate >= filters.from,
    () => !filters.to || tx.transactionDate <= filters.to,
    () =>
      normalizedFilterAccount.length === 0 ||
      normalizeAccountIdentifier(tx.bankAccountNumber) === normalizedFilterAccount,
    () => filters.minAmount === undefined || tx.transactionAmount >= filters.minAmount,
    () => filters.maxAmount === undefined || tx.transactionAmount <= filters.maxAmount,
    () => !filters.status || toLower(tx.status) === toLower(filters.status),
    () =>
      !filters.transactionType ||
      toLower(tx.transactionType).includes(toLower(filters.transactionType)),
    () => !filters.description || toLower(tx.description).includes(toLower(filters.description)),
    () =>
      !filters.externalReference ||
      toLower(tx.externalReference).includes(toLower(filters.externalReference)),
    () => !filters.sourceId || toLower(tx.sourceId).includes(toLower(filters.sourceId)),
  ];
  if (checks.some((check) => !check())) {
    return false;
  }

  if (filters.search) {
    const search = toLower(filters.search);
    const text = [tx.description, tx.externalReference, tx.paymentMethod, tx.sourceId]
      .map((value) => toLower(value))
      .join(" ");
    if (!text.includes(search)) {
      return false;
    }
  }
  if (!filters.includeTest && isTestLike(tx)) {
    return false;
  }
  return true;
}

export async function fetchMergedTransactions(
  filters: TransactionFilters,
): Promise<UnifiedTransaction[]> {
  const settlementDateWhere =
    filters.from || filters.to
      ? {
          transactionDate: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : undefined;

  const releaseDateWhere =
    filters.from || filters.to
      ? {
          date: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : undefined;

  const [settlements, releases, withdraws] = await Promise.all([
    db.settlementTransaction.findMany({
      where: settlementDateWhere,
      select: {
        id: true,
        metadata: true,
        description: true,
        externalReference: true,
        identificationNumber: true,
        paymentMethod: true,
        settlementNetAmount: true,
        sourceId: true,
        transactionAmount: true,
        transactionDate: true,
        transactionType: true,
      },
    }),
    db.releaseTransaction.findMany({
      where: releaseDateWhere,
      select: {
        id: true,
        metadata: true,
        description: true,
        date: true,
        externalReference: true,
        grossAmount: true,
        identificationNumber: true,
        netCreditAmount: true,
        netDebitAmount: true,
        paymentMethod: true,
        payoutBankAccountNumber: true,
        recordType: true,
        sourceId: true,
      },
    }),
    db.withdrawTransaction.findMany({
      where:
        filters.from || filters.to
          ? {
              dateCreated: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : undefined,
      select: {
        amount: true,
        bankAccountHolder: true,
        bankAccountNumber: true,
        bankAccountType: true,
        bankName: true,
        dateCreated: true,
        id: true,
        identificationNumber: true,
        status: true,
        withdrawId: true,
      },
    }),
  ]);

  const merged = [
    ...settlements.map(mapSettlementRow),
    ...releases.map(mapReleaseRow),
    ...withdraws.map(mapWithdrawRow),
  ];

  return reconcileTransactions(merged)
    .filter((tx) => matchesFilter(tx, filters))
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
}

export async function listTransactions(
  filters: TransactionFilters,
  limit = 100,
  offset = 0,
  includeTotal = true,
) {
  const all = await fetchMergedTransactions(filters);
  const transactions = all.slice(offset, offset + limit);
  return { total: includeTotal ? all.length : undefined, transactions };
}

export async function getParticipantLeaderboard(params: {
  from?: Date;
  to?: Date;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
}) {
  const rows = await fetchMergedTransactions({
    from: params.from,
    includeTest: false,
    to: params.to,
  });

  const grouped = new Map<
    string,
    {
      displayName: string;
      outgoingAmount: number;
      outgoingCount: number;
    }
  >();

  for (const row of rows) {
    const participant =
      row.identificationNumber ??
      row.bankAccountNumber ??
      row.withdrawId ??
      row.bankAccountHolder ??
      "unknown";
    const displayName = row.bankAccountHolder ?? row.identificationNumber ?? "Desconocido";
    const current = grouped.get(participant) ?? {
      displayName,
      outgoingAmount: 0,
      outgoingCount: 0,
    };
    if (row.transactionAmount < 0) {
      current.outgoingAmount += Math.abs(row.transactionAmount);
      current.outgoingCount += 1;
    }
    grouped.set(participant, current);
  }

  return {
    status: "ok",
    data: Array.from(grouped.entries())
      .map(([participant, stats]) => ({
        count: stats.outgoingCount,
        personId: participant,
        personName: stats.displayName,
        total: stats.outgoingAmount,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, params.limit ?? Number.MAX_SAFE_INTEGER),
  };
}

export async function getParticipantInsight(
  participantId: string,
  params: { from?: Date; to?: Date },
) {
  const rows = await fetchMergedTransactions({
    from: params.from,
    includeTest: false,
    to: params.to,
  });

  const participantRows = rows.filter((row) =>
    [
      row.identificationNumber,
      row.bankAccountNumber,
      row.withdrawId,
      row.bankAccountHolder,
      row.sourceId,
    ].some((candidate) => candidate != null && candidate === participantId),
  );

  const monthlyMap = new Map<
    string,
    { incomingAmount: number; incomingCount: number; outgoingAmount: number; outgoingCount: number }
  >();

  const counterpartMap = new Map<
    string,
    {
      bankAccountHolder: null | string;
      bankAccountNumber: null | string;
      bankAccountType: null | string;
      bankName: null | string;
      identificationNumber: null | string;
      incomingAmount: number;
      incomingCount: number;
      outgoingAmount: number;
      outgoingCount: number;
      withdrawId: null | string;
    }
  >();

  for (const row of participantRows) {
    const month = monthKey(row.transactionDate);
    const monthAgg = monthlyMap.get(month) ?? {
      incomingAmount: 0,
      incomingCount: 0,
      outgoingAmount: 0,
      outgoingCount: 0,
    };
    if (row.transactionAmount < 0) {
      monthAgg.outgoingAmount += Math.abs(row.transactionAmount);
      monthAgg.outgoingCount += 1;
    } else {
      monthAgg.incomingAmount += row.transactionAmount;
      monthAgg.incomingCount += 1;
    }
    monthlyMap.set(month, monthAgg);

    const counterpartKey = [
      row.identificationNumber ?? "",
      row.bankAccountNumber ?? "",
      row.bankAccountHolder ?? "",
      row.withdrawId ?? "",
    ].join("|");
    const counterpartAgg = counterpartMap.get(counterpartKey) ?? {
      bankAccountHolder: row.bankAccountHolder,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountType: row.bankAccountType,
      bankName: row.bankName,
      identificationNumber: row.identificationNumber,
      incomingAmount: 0,
      incomingCount: 0,
      outgoingAmount: 0,
      outgoingCount: 0,
      withdrawId: row.withdrawId,
    };
    if (row.transactionAmount < 0) {
      counterpartAgg.outgoingAmount += Math.abs(row.transactionAmount);
      counterpartAgg.outgoingCount += 1;
    } else {
      counterpartAgg.incomingAmount += row.transactionAmount;
      counterpartAgg.incomingCount += 1;
    }
    counterpartMap.set(counterpartKey, counterpartAgg);
  }

  return {
    status: "ok",
    participant: participantId,
    monthly: Array.from(monthlyMap.entries())
      .map(([month, value]) => ({
        month,
        outgoingCount: value.outgoingCount,
        outgoingAmount: value.outgoingAmount,
        incomingCount: value.incomingCount,
        incomingAmount: value.incomingAmount,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1)),
    counterparts: Array.from(counterpartMap.values())
      .map((s) => ({
        counterpart: s.bankAccountHolder || "Desconocido",
        counterpartId: s.identificationNumber,
        withdrawId: s.withdrawId,
        bankAccountHolder: s.bankAccountHolder,
        bankName: s.bankName,
        bankAccountNumber: s.bankAccountNumber,
        bankAccountType: s.bankAccountType,
        bankBranch: null,
        identificationType: "RUT",
        identificationNumber: s.identificationNumber,
        outgoingCount: s.outgoingCount,
        outgoingAmount: s.outgoingAmount,
        incomingCount: s.incomingCount,
        incomingAmount: s.incomingAmount,
      }))
      .sort((a, b) => b.outgoingAmount - a.outgoingAmount)
      .map((s) => ({
        ...s,
        counterpartId: s.counterpartId ?? s.bankAccountNumber ?? s.withdrawId ?? "unknown",
      })),
  };
}

export async function getTransactionStats(params: { from: Date; to: Date }) {
  const rows = await fetchMergedTransactions({
    from: params.from,
    includeTest: false,
    to: params.to,
  });

  const monthlyMap = new Map<string, { in: number; net: number; out: number }>();
  const byTypeMap = new Map<string, number>();

  let totalIn = 0;
  let totalOut = 0;

  for (const row of rows) {
    const month = monthKey(row.transactionDate);
    const monthAgg = monthlyMap.get(month) ?? { in: 0, net: 0, out: 0 };
    if (row.transactionAmount >= 0) {
      monthAgg.in += row.transactionAmount;
      totalIn += row.transactionAmount;
    } else {
      const outAmount = Math.abs(row.transactionAmount);
      monthAgg.out += outAmount;
      totalOut += outAmount;
    }
    monthAgg.net += row.transactionAmount;
    monthlyMap.set(month, monthAgg);

    const type = row.transactionType || "unknown";
    byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + row.transactionAmount);
  }

  const monthly = Array.from(monthlyMap.entries())
    .map(([month, values]) => ({
      month,
      in: values.in,
      out: values.out,
      net: values.net,
    }))
    .sort((a, b) => (a.month > b.month ? 1 : -1));

  const byType = Array.from(byTypeMap.entries()).map(([description, total]) => ({
    description,
    direction: total > 0 ? "IN" : total < 0 ? "OUT" : "NEUTRO",
    total: Math.abs(total),
  }));

  return {
    status: "ok",
    monthly,
    totals: {
      in: totalIn,
      out: totalOut,
      net: totalIn - totalOut,
    },
    byType,
  };
}
