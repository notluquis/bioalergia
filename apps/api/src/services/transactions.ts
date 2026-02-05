import { db } from "@finanzas/db";
import type { TransactionCreateArgs, TransactionWhereInput } from "@finanzas/db/input";

// Aggregate result interfaces for Kysely raw queries
interface AggregateByMonth {
  month: string | number;
  in: number | string;
  out: number | string;
  net: number | string;
}

interface AggregateByType {
  description: string;
  total: number | string;
}

// Types for raw SQL query results
interface ParticipantRow {
  participant: string;
  displayName: string;
  identificationNumber: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankName: string;
  withdrawId: string;
  totalCount: number;
  totalAmount: number;
  outgoingCount: number;
  outgoingAmount: number;
  incomingCount: number;
  incomingAmount: number;
}

interface MonthlyStatsRow {
  month: string;
  outgoingCount: number;
  outgoingAmount: number;
  incomingCount: number;
  incomingAmount: number;
}

interface CounterpartRow {
  counterpart: string;
  counterpartId: string;
  withdrawId: string;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  identificationNumber: string;
  outgoingCount: number;
  outgoingAmount: number;
  incomingCount: number;
  incomingAmount: number;
}

export type TransactionFilters = {
  from?: Date;
  to?: Date;
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

// Extract transaction input types from Zenstack args
type TransactionCreateInput = NonNullable<TransactionCreateArgs["data"]>;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy filtering logic
export async function listTransactions(
  filters: TransactionFilters,
  limit = 100,
  offset = 0,
  includeTotal = true,
) {
  const where: TransactionWhereInput = {};

  if (filters.from || filters.to) {
    where.transactionDate = {};
    if (filters.from) {
      where.transactionDate.gte = filters.from;
    }
    if (filters.to) {
      where.transactionDate.lte = filters.to;
    }
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.transactionAmount = {};
    if (filters.minAmount !== undefined) {
      where.transactionAmount.gte = filters.minAmount;
    }
    if (filters.maxAmount !== undefined) {
      where.transactionAmount.lte = filters.maxAmount;
    }
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.transactionType) {
    where.transactionType = filters.transactionType;
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.externalReference) {
    where.externalReference = {
      contains: filters.externalReference,
      mode: "insensitive",
    };
  }

  if (filters.sourceId) {
    where.sourceId = { contains: filters.sourceId, mode: "insensitive" };
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { externalReference: { contains: filters.search, mode: "insensitive" } },
      { paymentMethod: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // Exclude test data by default
  if (!filters.includeTest) {
    // Add to AND array to ensure it doesn't conflict with other filters
    if (!where.AND) {
      where.AND = [];
    }
    if (Array.isArray(where.AND)) {
      where.AND.push({
        NOT: {
          OR: [
            { description: { contains: "test", mode: "insensitive" } },
            { sourceId: { contains: "test", mode: "insensitive" } },
            { externalReference: { contains: "test", mode: "insensitive" } },
          ],
        },
      });
    }
  }

  const transactionsPromise = db.transaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
    take: limit,
    skip: offset,
  });

  if (!includeTotal) {
    const transactions = await transactionsPromise;
    return { total: undefined, transactions };
  }

  const [total, transactions] = await Promise.all([
    db.transaction.count({ where }),
    transactionsPromise,
  ]);

  return { total, transactions };
}

export async function getTransactionById(id: number) {
  return await db.transaction.findUnique({
    where: { id },
  });
}

export async function createTransaction(data: TransactionCreateInput) {
  return await db.transaction.create({
    data,
  });
}

export async function createTransactionsBatch(data: TransactionCreateInput[]) {
  return await db.transaction.createMany({
    data,
    skipDuplicates: true,
  });
}

// Participants Logic
import { sql } from "kysely";

export async function getParticipantLeaderboard(params: {
  from?: Date;
  to?: Date;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
}) {
  const { from, to, limit } = params;
  // ZenStack Query Builder handles the mapping (Model Key: Transaction)
  // Note: We must use Model Field Names (e.g. transactionDate) not DB columns
  let query = db.$qb
    .selectFrom("Transaction")
    .select([
      sql<string>`COALESCE(metadata->>'recipient_rut', metadata->>'rut', metadata->>'identification_number')`.as(
        "identificationNumber",
      ),
      sql<string>`COALESCE(metadata->>'bank_account_holder_name', metadata->>'name', metadata->>'account_holder')`.as(
        "bankAccountHolder",
      ),
      sql<string>`COALESCE(metadata->>'bank_account_number', metadata->>'account_number')`.as(
        "bankAccountNumber",
      ),
      sql<string>`COALESCE(metadata->>'bank_name', metadata->>'bank')`.as("bankName"),
      sql<string>`COALESCE(metadata->>'bank_account_type', metadata->>'account_type')`.as(
        "bankAccountType",
      ),
      sql<string>`COALESCE(metadata->>'withdraw_id', metadata->>'id')`.as("withdrawId"),
      // Determine participant key (prefer RUT, then Account, then Name)
      sql<string>`COALESCE(metadata->>'recipient_rut', metadata->>'rut', metadata->>'identification_number', metadata->>'bank_account_number', metadata->>'account_number', 'unknown')`.as(
        "participant",
      ),
      // Display Name
      sql<string>`COALESCE(metadata->>'bank_account_holder_name', metadata->>'name', metadata->>'account_holder', 'Desconocido')`.as(
        "displayName",
      ),
      // Metrics
      sql<number>`count(*)`.as("totalCount"),
      sql<number>`sum(transaction_amount)`.as("totalAmount"),
      sql<number>`sum(case when transaction_amount < 0 then 1 else 0 end)`.as("outgoingCount"),
      sql<number>`sum(case when transaction_amount < 0 then ABS(transaction_amount) else 0 end)`.as(
        "outgoingAmount",
      ),
      sql<number>`sum(case when transaction_amount > 0 then 1 else 0 end)`.as("incomingCount"),
      sql<number>`sum(case when transaction_amount > 0 then transaction_amount else 0 end)`.as(
        "incomingAmount",
      ),
    ])
    .groupBy([
      "participant",
      "displayName",
      "identificationNumber",
      "bankAccountHolder",
      "bankAccountNumber",
      "bankAccountType",
      "bankName",
      "withdrawId",
    ])
    .orderBy("outgoingAmount", "desc");

  if (from) {
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    query = query.where("transactionDate", ">=", from as any);
  }
  if (to) {
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    query = query.where("transactionDate", "<=", to as any);
  }
  if (limit) {
    query = query.limit(limit);
  }

  // Filter by mode? Default combined.

  const stats = await query.execute();

  return {
    status: "ok",
    data: (stats as ParticipantRow[]).map((s) => ({
      count: Number(s.outgoingCount),
      personId: s.participant,
      personName: s.displayName,
      total: Number(s.outgoingAmount),
    })),
  };
}

export async function getParticipantInsight(
  participantId: string,
  params: { from?: Date; to?: Date },
) {
  const { from, to } = params;

  // 1. Monthly Stats
  // ZenStack Query Builder: Use Model Fields
  let monthlyQuery = db.$qb
    .selectFrom("Transaction")
    .select([
      sql<string>`to_char(transaction_date, 'YYYY-MM-01')`.as("month"), // SQL helper uses raw DB names inside template strings
      sql<number>`sum(case when transaction_amount < 0 then 1 else 0 end)`.as("outgoingCount"),
      sql<number>`sum(case when transaction_amount < 0 then ABS(transaction_amount) else 0 end)`.as(
        "outgoingAmount",
      ),
      sql<number>`sum(case when transaction_amount > 0 then 1 else 0 end)`.as("incomingCount"),
      sql<number>`sum(case when transaction_amount > 0 then transaction_amount else 0 end)`.as(
        "incomingAmount",
      ),
    ])
    .where((eb) =>
      eb.or([
        sql<boolean>`metadata->>'recipient_rut' = ${participantId}`,
        sql<boolean>`metadata->>'rut' = ${participantId}`,
        sql<boolean>`metadata->>'identification_number' = ${participantId}`,
        sql<boolean>`metadata->>'bank_account_number' = ${participantId}`,
      ]),
    )
    .groupBy("month")
    .orderBy("month", "desc");

  if (from) {
    monthlyQuery = monthlyQuery.where("transactionDate", ">=", from.toISOString());
  }
  if (to) {
    monthlyQuery = monthlyQuery.where("transactionDate", "<=", to.toISOString());
  }

  const monthlyStats = await monthlyQuery.execute();

  // 2. Counterparts (Details) - Reuse leaderboard logic but filtered by ID
  // ZenStack Query Builder
  let counterpartsQuery = db.$qb
    .selectFrom("Transaction")
    .select([
      sql<string>`COALESCE(metadata->>'recipient_rut', metadata->>'rut', metadata->>'identification_number')`.as(
        "identificationNumber",
      ),
      sql<string>`COALESCE(metadata->>'bank_account_holder_name', metadata->>'name')`.as(
        "bankAccountHolder",
      ),
      sql<string>`COALESCE(metadata->>'bank_account_number', metadata->>'account_number')`.as(
        "bankAccountNumber",
      ),
      sql<string>`COALESCE(metadata->>'bank_name', metadata->>'bank')`.as("bankName"),
      sql<string>`COALESCE(metadata->>'bank_account_type', metadata->>'account_type')`.as(
        "bankAccountType",
      ),
      sql<string>`COALESCE(metadata->>'withdraw_id', metadata->>'id')`.as("withdrawId"),
      //
      sql<number>`sum(case when transaction_amount < 0 then 1 else 0 end)`.as("outgoingCount"),
      sql<number>`sum(case when transaction_amount < 0 then ABS(transaction_amount) else 0 end)`.as(
        "outgoingAmount",
      ),
      sql<number>`sum(case when transaction_amount > 0 then 1 else 0 end)`.as("incomingCount"),
      sql<number>`sum(case when transaction_amount > 0 then transaction_amount else 0 end)`.as(
        "incomingAmount",
      ),
    ])
    .where((eb) =>
      eb.or([
        sql<boolean>`metadata->>'recipient_rut' = ${participantId}`,
        sql<boolean>`metadata->>'rut' = ${participantId}`,
        sql<boolean>`metadata->>'identification_number' = ${participantId}`,
        sql<boolean>`metadata->>'bank_account_number' = ${participantId}`,
      ]),
    )
    .groupBy([
      "identificationNumber",
      "bankAccountHolder",
      "bankAccountNumber",
      "bankName",
      "bankAccountType",
      "withdrawId",
    ])
    .orderBy("outgoingAmount", "desc");

  if (from) {
    counterpartsQuery = counterpartsQuery.where("transactionDate", ">=", from.toISOString());
  }
  if (to) {
    counterpartsQuery = counterpartsQuery.where("transactionDate", "<=", to.toISOString());
  }

  const counterparts = await counterpartsQuery.execute();

  return {
    status: "ok",
    participant: participantId,
    monthly: (monthlyStats as MonthlyStatsRow[]).map((s) => ({
      month: s.month,
      outgoingCount: Number(s.outgoingCount),
      outgoingAmount: Number(s.outgoingAmount),
      incomingCount: Number(s.incomingCount),
      incomingAmount: Number(s.incomingAmount),
    })),
    counterparts: (counterparts as CounterpartRow[]).map((s) => ({
      counterpart: s.bankAccountHolder || "Desconocido",
      counterpartId: s.identificationNumber,
      withdrawId: s.withdrawId,
      bankAccountHolder: s.bankAccountHolder,
      bankName: s.bankName,
      bankAccountNumber: s.bankAccountNumber,
      bankAccountType: s.bankAccountType,
      bankBranch: null,
      identificationType: "RUT", // Assumption
      identificationNumber: s.identificationNumber,
      outgoingCount: Number(s.outgoingCount),
      outgoingAmount: Number(s.outgoingAmount),
      incomingCount: Number(s.incomingCount),
      incomingAmount: Number(s.incomingAmount),
    })),
  };
}

export async function getTransactionStats(params: { from: Date; to: Date }) {
  const { from, to } = params;

  // Monthly
  const monthly = await db.$qb
    .selectFrom("Transaction")
    .select([
      sql<string>`to_char(transaction_date, 'YYYY-MM-01')`.as("month"),
      sql<number>`sum(case when transaction_amount > 0 then transaction_amount else 0 end)`.as(
        "in",
      ),
      sql<number>`sum(case when transaction_amount < 0 then ABS(transaction_amount) else 0 end)`.as(
        "out",
      ),
      sql<number>`sum(transaction_amount)`.as("net"),
    ])
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", ">=", from as any)
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", "<=", to as any)
    .groupBy("month")
    .orderBy("month", "asc")
    .execute();

  // By Type
  const byType = await db.$qb
    .selectFrom("Transaction")
    .select([
      (eb) => eb.ref("transactionType").as("description"),
      sql<number>`sum(transaction_amount)`.as("total"),
    ])
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", ">=", from as any)
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", "<=", to as any)
    .groupBy("transactionType")
    .execute();

  const byTypeMapped = byType.map((t: AggregateByType) => ({
    description: t.description,
    direction: Number(t.total) > 0 ? "IN" : Number(t.total) < 0 ? "OUT" : "NEUTRO",
    total: Math.abs(Number(t.total)),
  }));

  // Totals
  const totalsQuery = await db.$qb
    .selectFrom("Transaction")
    .select([
      sql<number>`sum(case when transaction_amount > 0 then transaction_amount else 0 end)`.as(
        "in",
      ),
      sql<number>`sum(case when transaction_amount < 0 then ABS(transaction_amount) else 0 end)`.as(
        "out",
      ),
      sql<number>`sum(transaction_amount)`.as("net"),
    ])
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", ">=", from as any)
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", "<=", to as any)
    .executeTakeFirst();

  const totals = {
    in: Number(totalsQuery?.in || 0),
    out: Number(totalsQuery?.out || 0),
    net: Number(totalsQuery?.net || 0),
  };

  return {
    status: "ok",
    monthly: monthly.map((m: AggregateByMonth) => ({
      month: m.month,
      in: Number(m.in),
      out: Number(m.out),
      net: Number(m.net),
    })),
    totals,
    byType: byTypeMapped,
  };
}
