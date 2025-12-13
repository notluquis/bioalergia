import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import { normalizeRut } from "../lib/rut.js";
import { accessibleBy } from "@casl/prisma";
import type { AppAbility } from "../lib/authz/ability.js";

export type TransactionFilters = {
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  direction?: "IN" | "OUT" | "NEUTRO";
  description?: string;
  origin?: string;
  destination?: string;
};

export type EnrichedTransaction = Prisma.TransactionGetPayload<{
  include: {
    person: true;
  };
}>;

export type ParticipantSummary = {
  participant: string;
  displayName: string;
  outgoingCount: number;
  identificationNumber: string | null;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  bankName: string | null;
  bankBranch: string | null;
  withdrawId: string | null;
  incomingCount: number;
  outgoingAmount: number;
  incomingAmount: number;
  totalCount: number;
  totalAmount: number;
};

export type ParticipantLeaderboardFilters = {
  from?: Date;
  to?: Date;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
};

/**
 * Get participant leaderboard (top participants by transaction volume)
 */
export async function getParticipantLeaderboard(filters: ParticipantLeaderboardFilters): Promise<ParticipantSummary[]> {
  const { from, to, limit = 10, mode = "outgoing" } = filters;

  // Build date filter
  const dateFilter: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (from) {
    dateFilter.push(`t.timestamp >= $${paramIndex}::timestamp`);
    params.push(from);
    paramIndex++;
  }
  if (to) {
    dateFilter.push(`t.timestamp <= $${paramIndex}::timestamp`);
    params.push(to);
    paramIndex++;
  }

  const whereClause = dateFilter.length > 0 ? `AND ${dateFilter.join(" AND ")}` : "";

  // Parse rawJson to extract bank details - we group by destination for outgoing transactions
  const query = `
    WITH parsed AS (
      SELECT
        t.id,
        t.timestamp,
        t.amount,
        t.direction,
        t.destination,
        t.origin,
        t.raw_json,
        -- Try to parse rawJson for bank details
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountHolder'
          ELSE NULL
        END as bank_account_holder,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountNumber'
          ELSE NULL
        END as bank_account_number,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountType'
          ELSE NULL
        END as bank_account_type,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankName'
          ELSE NULL
        END as bank_name,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'identificationNumber'
          ELSE NULL
        END as identification_number,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'withdrawId'
          ELSE NULL
        END as withdraw_id
      FROM transactions t
      INNER JOIN people p ON t.person_id = p.id
      WHERE (p.names NOT LIKE '%Test%' AND p.names NOT LIKE '%test%'
             AND p.rut NOT LIKE '11111111%' AND p.rut NOT LIKE 'TEMP-%'
             AND (p.email IS NULL OR p.email NOT LIKE '%test%'))
      ${whereClause}
    )
    SELECT 
      COALESCE(p.bank_account_number, p.destination, p.withdraw_id, 'unknown') as participant,
      COALESCE(p.bank_account_holder, p.destination, 'Sin información') as display_name,
      p.identification_number,
      p.bank_account_holder,
      p.bank_account_number,
      p.bank_account_type,
      p.bank_name,
      p.withdraw_id,
      COUNT(*) FILTER (WHERE p.direction = 'OUT') as outgoing_count,
      COUNT(*) FILTER (WHERE p.direction = 'IN') as incoming_count,
      COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0) as outgoing_amount,
      COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0) as incoming_amount,
      COUNT(*) as total_count,
      COALESCE(SUM(p.amount), 0) as total_amount
    FROM parsed p
    GROUP BY 
      COALESCE(p.bank_account_number, p.destination, p.withdraw_id, 'unknown'),
      p.bank_account_holder,
      p.bank_account_number,
      p.destination,
      p.identification_number,
      p.bank_account_type,
      p.bank_name,
      p.withdraw_id
    ${mode === "outgoing" ? "HAVING COUNT(*) FILTER (WHERE p.direction = 'OUT') > 0" : ""}
    ${mode === "incoming" ? "HAVING COUNT(*) FILTER (WHERE p.direction = 'IN') > 0" : ""}
    ORDER BY ${mode === "outgoing" ? "outgoing_amount" : mode === "incoming" ? "incoming_amount" : "total_amount"} DESC
    LIMIT $${paramIndex}
  `;

  params.push(limit);

  const results = await prisma.$queryRawUnsafe<
    Array<{
      participant: string;
      display_name: string;
      identification_number: string | null;
      bank_account_holder: string | null;
      bank_account_number: string | null;
      bank_account_type: string | null;
      bank_name: string | null;
      withdraw_id: string | null;
      outgoing_count: bigint;
      incoming_count: bigint;
      outgoing_amount: number;
      incoming_amount: number;
      total_count: bigint;
      total_amount: number;
    }>
  >(query, ...params);

  return results.map((row) => ({
    participant: row.participant,
    displayName: row.display_name,
    identificationNumber: row.identification_number ? normalizeRut(row.identification_number) : null,
    bankAccountHolder: row.bank_account_holder,
    bankAccountNumber: row.bank_account_number,
    bankAccountType: row.bank_account_type,
    bankName: row.bank_name,
    bankBranch: null,
    withdrawId: row.withdraw_id,
    outgoingCount: Number(row.outgoing_count),
    incomingCount: Number(row.incoming_count),
    outgoingAmount: Number(row.outgoing_amount),
    incomingAmount: Number(row.incoming_amount),
    totalCount: Number(row.total_count),
    totalAmount: Number(row.total_amount),
  }));
}

/**
 * Get participant insight (monthly breakdown and counterparts for a specific participant)
 */
export async function getParticipantInsight(
  participantId: string,
  filters: { from?: Date; to?: Date }
): Promise<{
  monthly: Array<{
    month: string;
    outgoingCount: number;
    incomingCount: number;
    outgoingAmount: number;
    incomingAmount: number;
  }>;
  counterparts: Array<{
    counterpart: string;
    counterpartId: string | null;
    withdrawId: string | null;
    bankAccountHolder: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountType: string | null;
    bankBranch: string | null;
    identificationType: string | null;
    identificationNumber: string | null;
    outgoingCount: number;
    incomingCount: number;
    outgoingAmount: number;
    incomingAmount: number;
  }>;
}> {
  const { from, to } = filters;

  // Build date filter
  const dateFilter: string[] = [];
  const params: unknown[] = [participantId];
  let paramIndex = 2;

  if (from) {
    dateFilter.push(`t.timestamp >= $${paramIndex}::timestamp`);
    params.push(from);
    paramIndex++;
  }
  if (to) {
    dateFilter.push(`t.timestamp <= $${paramIndex}::timestamp`);
    params.push(to);
    paramIndex++;
  }

  const dateClause = dateFilter.length > 0 ? `AND ${dateFilter.join(" AND ")}` : "";

  // Monthly breakdown
  const monthlyQuery = `
    WITH parsed AS (
      SELECT
        t.id,
        t.timestamp,
        t.amount,
        t.direction,
        t.destination,
        t.raw_json,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountNumber'
          ELSE NULL
        END as bank_account_number,
        CASE
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'withdrawId'
          ELSE NULL
        END as withdraw_id
      FROM transactions t
      INNER JOIN people p ON t.person_id = p.id
      WHERE (p.names NOT LIKE '%Test%' AND p.names NOT LIKE '%test%'
             AND p.rut NOT LIKE '11111111%' AND p.rut NOT LIKE 'TEMP-%'
             AND (p.email IS NULL OR p.email NOT LIKE '%test%'))
      ${dateClause}
    )
    SELECT 
      TO_CHAR(p.timestamp, 'YYYY-MM') as month,
      COUNT(*) FILTER (WHERE p.direction = 'OUT') as outgoing_count,
      COUNT(*) FILTER (WHERE p.direction = 'IN') as incoming_count,
      COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0) as outgoing_amount,
      COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0) as incoming_amount
    FROM parsed p
    WHERE COALESCE(p.bank_account_number, p.destination, p.withdraw_id, 'unknown') = $1
    GROUP BY TO_CHAR(p.timestamp, 'YYYY-MM')
    ORDER BY month DESC
  `;

  const monthlyResults = await prisma.$queryRawUnsafe<
    Array<{
      month: string;
      outgoing_count: bigint;
      incoming_count: bigint;
      outgoing_amount: number;
      incoming_amount: number;
    }>
  >(monthlyQuery, ...params);

  // Counterparts - transactions with this participant
  const counterpartsQuery = `
    WITH parsed AS (
      SELECT 
        t.id,
        t.timestamp,
        t.amount,
        t.direction,
        t.destination,
        t.origin,
        t.raw_json,
        CASE 
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountHolder'
          ELSE NULL
        END as bank_account_holder,
        CASE 
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountNumber'
          ELSE NULL
        END as bank_account_number,
        CASE 
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankAccountType'
          ELSE NULL
        END as bank_account_type,
        CASE 
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'bankName'
          ELSE NULL
        END as bank_name,
        CASE 
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'identificationNumber'
          ELSE NULL
        END as identification_number,
        CASE 
          WHEN t.raw_json IS NOT NULL AND t.raw_json != '' THEN
            (t.raw_json::json)->>'withdrawId'
          ELSE NULL
        END as withdraw_id
      FROM transactions t
      INNER JOIN people p ON t.person_id = p.id
      WHERE (p.names NOT LIKE '%Test%' AND p.names NOT LIKE '%test%'
             AND p.rut NOT LIKE '11111111%' AND p.rut NOT LIKE 'TEMP-%'
             AND (p.email IS NULL OR p.email NOT LIKE '%test%'))
      ${dateClause}
    )
    SELECT 
      COALESCE(p.origin, 'unknown') as counterpart,
      NULL as counterpart_id,
      p.withdraw_id,
      p.bank_account_holder,
      p.bank_name,
      p.bank_account_number,
      p.bank_account_type,
      NULL as bank_branch,
      NULL as identification_type,
      p.identification_number,
      COUNT(*) FILTER (WHERE p.direction = 'OUT') as outgoing_count,
      COUNT(*) FILTER (WHERE p.direction = 'IN') as incoming_count,
      COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0) as outgoing_amount,
      COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0) as incoming_amount
    FROM parsed p
    WHERE COALESCE(p.bank_account_number, p.destination, p.withdraw_id, 'unknown') = $1
    GROUP BY p.origin, p.withdraw_id, p.bank_account_holder, p.bank_name, p.bank_account_number, p.bank_account_type, p.identification_number
    ORDER BY outgoing_amount DESC
    LIMIT 50
  `;

  const counterpartsResults = await prisma.$queryRawUnsafe<
    Array<{
      counterpart: string;
      counterpart_id: string | null;
      withdraw_id: string | null;
      bank_account_holder: string | null;
      bank_name: string | null;
      bank_account_number: string | null;
      bank_account_type: string | null;
      bank_branch: string | null;
      identification_type: string | null;
      identification_number: string | null;
      outgoing_count: bigint;
      incoming_count: bigint;
      outgoing_amount: number;
      incoming_amount: number;
    }>
  >(counterpartsQuery, ...params);

  return {
    monthly: monthlyResults.map((row) => ({
      month: row.month,
      outgoingCount: Number(row.outgoing_count),
      incomingCount: Number(row.incoming_count),
      outgoingAmount: Number(row.outgoing_amount),
      incomingAmount: Number(row.incoming_amount),
    })),
    counterparts: counterpartsResults.map((row) => ({
      counterpart: row.counterpart,
      counterpartId: row.counterpart_id,
      withdrawId: row.withdraw_id,
      bankAccountHolder: row.bank_account_holder,
      bankName: row.bank_name,
      bankAccountNumber: row.bank_account_number,
      bankAccountType: row.bank_account_type,
      bankBranch: row.bank_branch,
      identificationType: row.identification_type,
      identificationNumber: row.identification_number ? normalizeRut(row.identification_number) : null,
      outgoingCount: Number(row.outgoing_count),
      incomingCount: Number(row.incoming_count),
      outgoingAmount: Number(row.outgoing_amount),
      incomingAmount: Number(row.incoming_amount),
    })),
  };
}

export async function listTransactions(filters: TransactionFilters, limit = 100, offset = 0, ability?: AppAbility) {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.from || filters.to) {
    where.timestamp = {};
    if (filters.from) where.timestamp.gte = filters.from;
    if (filters.to) where.timestamp.lte = filters.to;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
  }

  if (filters.direction) {
    where.direction = filters.direction;
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.origin) {
    where.origin = { contains: filters.origin, mode: "insensitive" };
  }

  if (filters.destination) {
    where.destination = { contains: filters.destination, mode: "insensitive" };
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { origin: { contains: filters.search, mode: "insensitive" } },
      { destination: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // ABAC: Apply accessibleBy filter if ability is provided
  if (ability) {
    const accessQuery = accessibleBy(ability).Transaction;
    // merge with existing where using AND
    where.AND = [accessQuery];
  }

  // Filter out test/demo data by excluding transactions linked to test persons
  where.person = {
    NOT: {
      OR: [
        { names: { contains: "Test" } },
        { names: { contains: "test" } },
        { rut: { startsWith: "11111111" } },
        { rut: { startsWith: "TEMP-" } },
        { email: { contains: "test" } },
      ],
    },
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
      include: {
        person: true,
      },
    }),
  ]);

  return { total, transactions };
}

export async function getTransactionById(id: number) {
  return await prisma.transaction.findUnique({
    where: { id },
  });
}

export async function createTransaction(data: Prisma.TransactionUncheckedCreateInput) {
  return await prisma.transaction.create({
    data,
  });
}

export async function createTransactionsBatch(data: Prisma.TransactionCreateManyInput[]) {
  return await prisma.transaction.createMany({
    data,
    skipDuplicates: true,
  });
}
