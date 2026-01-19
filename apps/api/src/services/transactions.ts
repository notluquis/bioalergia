import { db } from "@finanzas/db";

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy filtering logic
export async function listTransactions(filters: TransactionFilters, limit = 100, offset = 0) {
  // biome-ignore lint/suspicious/noExplicitAny: legacy query builder
  const where: any = {};

  if (filters.from || filters.to) {
    where.transactionDate = {};
    if (filters.from) where.transactionDate.gte = filters.from;
    if (filters.to) where.transactionDate.lte = filters.to;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.transactionAmount = {};
    if (filters.minAmount !== undefined) where.transactionAmount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) where.transactionAmount.lte = filters.maxAmount;
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
    where.AND = where.AND || [];
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

  const [total, transactions] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return { total, transactions };
}

export async function getTransactionById(id: number) {
  return await db.transaction.findUnique({
    where: { id },
  });
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic payload
export async function createTransaction(data: any) {
  return await db.transaction.create({
    data,
  });
}

// biome-ignore lint/suspicious/noExplicitAny: legacy batch op
export async function createTransactionsBatch(data: any[]) {
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
    // biome-ignore lint/suspicious/noExplicitAny: kysely raw result
    participants: stats.map((s: any) => ({
      participant: s.participant,
      displayName: s.displayName,
      identificationNumber: s.identificationNumber,
      bankAccountHolder: s.bankAccountHolder,
      bankAccountNumber: s.bankAccountNumber,
      bankAccountType: s.bankAccountType,
      bankName: s.bankName,
      bankBranch: null, // Not typically in metadata
      withdrawId: s.withdrawId,
      totalCount: Number(s.totalCount),
      totalAmount: Number(s.totalAmount),
      outgoingCount: Number(s.outgoingCount),
      outgoingAmount: Number(s.outgoingAmount),
      incomingCount: Number(s.incomingCount),
      incomingAmount: Number(s.incomingAmount),
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
    // biome-ignore lint/suspicious/noExplicitAny: Kysely expression builder type
    .where((eb: any) =>
      eb.or([
        sql<boolean>`metadata->>'recipient_rut' = ${participantId}`,
        sql<boolean>`metadata->>'rut' = ${participantId}`,
        sql<boolean>`metadata->>'identification_number' = ${participantId}`,
        sql<boolean>`metadata->>'bank_account_number' = ${participantId}`,
      ]),
    )
    .groupBy("month")
    .orderBy("month", "desc");

  // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
  if (from) monthlyQuery = monthlyQuery.where("transactionDate", ">=", from as any);
  // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
  if (to) monthlyQuery = monthlyQuery.where("transactionDate", "<=", to as any);

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
    // biome-ignore lint/suspicious/noExplicitAny: Kysely expression builder type
    .where((eb: any) =>
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

  // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
  if (from) counterpartsQuery = counterpartsQuery.where("transactionDate", ">=", from as any);
  // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
  if (to) counterpartsQuery = counterpartsQuery.where("transactionDate", "<=", to as any);

  const counterparts = await counterpartsQuery.execute();

  return {
    status: "ok",
    participant: participantId,
    // biome-ignore lint/suspicious/noExplicitAny: kysely raw result
    monthly: monthlyStats.map((s: any) => ({
      month: s.month,
      outgoingCount: Number(s.outgoingCount),
      outgoingAmount: Number(s.outgoingAmount),
      incomingCount: Number(s.incomingCount),
      incomingAmount: Number(s.incomingAmount),
    })),
    // biome-ignore lint/suspicious/noExplicitAny: kysely raw result
    counterparts: counterparts.map((s: any) => ({
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
    .select([(eb) => eb.ref("transactionType").as("description"), sql<number>`sum(transaction_amount)`.as("total")])
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", ">=", from as any)
    // biome-ignore lint/suspicious/noExplicitAny: Kysely Date strictness
    .where("transactionDate", "<=", to as any)
    .groupBy("transactionType")
    .execute();

  // biome-ignore lint/suspicious/noExplicitAny: kysely raw result
  const byTypeMapped = byType.map((t: any) => ({
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
    // biome-ignore lint/suspicious/noExplicitAny: kysely raw result
    monthly: monthly.map((m: any) => ({
      month: m.month,
      in: Number(m.in),
      out: Number(m.out),
      net: Number(m.net),
    })),
    totals,
    byType: byTypeMapped,
  };
}
