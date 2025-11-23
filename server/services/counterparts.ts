import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { normalizeRut, validateRut } from "../lib/rut.js";

export async function listCounterparts() {
  return await prisma.counterpart.findMany({
    orderBy: { name: "asc" },
    include: {
      accounts: true,
    },
  });
}

export async function getCounterpartById(id: number) {
  const counterpart = await prisma.counterpart.findUnique({
    where: { id },
    include: {
      accounts: true,
    },
  });

  if (!counterpart) return null;

  return {
    counterpart,
    accounts: counterpart.accounts,
  };
}

export async function createCounterpart(data: Prisma.CounterpartUncheckedCreateInput) {
  return await prisma.counterpart.create({
    data,
  });
}

export async function updateCounterpart(id: number, data: Prisma.CounterpartUncheckedUpdateInput) {
  return await prisma.counterpart.update({
    where: { id },
    data,
  });
}

export async function upsertCounterpartAccount(
  counterpartId: number,
  payload: {
    accountIdentifier: string;
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  const account = await prisma.counterpartAccount.upsert({
    where: { accountIdentifier: payload.accountIdentifier },
    create: {
      counterpartId,
      accountIdentifier: payload.accountIdentifier,
      bankName: payload.bankName,
      accountType: payload.accountType,
      holder: payload.holder,
      concept: payload.concept,
      metadata: payload.metadata ?? Prisma.JsonNull,
    },
    update: {
      counterpartId, // Ensure it's linked to this counterpart
      bankName: payload.bankName ?? undefined,
      accountType: payload.accountType ?? undefined,
      holder: payload.holder ?? undefined,
      concept: payload.concept ?? undefined,
      metadata: payload.metadata ?? undefined,
    },
  });
  return account.id;
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: {
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return await prisma.counterpartAccount.update({
    where: { id: accountId },
    data: {
      bankName: payload.bankName,
      accountType: payload.accountType,
      holder: payload.holder,
      concept: payload.concept,
      metadata: payload.metadata ?? undefined,
    },
  });
}

export async function listAccountSuggestions(query: string, limit: number) {
  const like = `%${query.trim()}%`;
  const normalizedRut = normalizeRut(query);
  const numericRut = normalizedRut ? normalizedRut.replace(/[^0-9K]/gi, "") : null;

  // This query joins legacy tables mp_transactions and mp_withdrawals
  // We use raw query because of the complex join and aggregation not easily mapped in Prisma yet
  // assuming mp_transactions and mp_withdrawals still exist or are mapped

  const conditions = [
    "t.source_id LIKE ?",
    "mw.bank_account_number LIKE ?",
    "mw.bank_account_holder LIKE ?",
    "mw.identification_number LIKE ?",
  ];
  const params: (string | number)[] = [like, like, like, like];

  if (numericRut) {
    conditions.push("REPLACE(REPLACE(REPLACE(UPPER(mw.identification_number),'.',''),'-',''),' ','') = ?");
    params.push(numericRut);
  }

  const sql = `
    SELECT
        t.source_id AS account_identifier,
        MAX(mw.bank_account_number) AS bank_account_number,
        MAX(mw.identification_number) AS rut,
        MAX(mw.bank_account_holder) AS holder,
        MAX(mw.bank_name) AS bank_name,
        MAX(mw.bank_account_type) AS account_type,
        SUM(t.amount) AS total_amount,
        COUNT(*) AS movements,
        MAX(ca.counterpart_id) AS assigned_counterpart_id
      FROM mp_transactions t
      LEFT JOIN mp_withdrawals mw ON t.source_id = mw.withdraw_id
      LEFT JOIN mp_counterpart_accounts ca ON ca.account_identifier = t.source_id
     WHERE t.direction = 'OUT'
       AND (${conditions.join(" OR ")})
     GROUP BY t.source_id
     ORDER BY total_amount DESC, movements DESC
     LIMIT ?
  `;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      account_identifier: string;
      rut: string | null;
      holder: string | null;
      bank_name: string | null;
      account_type: string | null;
      bank_account_number: string | null;
      total_amount: number | null;
      movements: number | null;
      assigned_counterpart_id: number | null;
    }>
  >(sql, ...params, limit);

  return rows.map(
    (row: {
      account_identifier: string;
      rut: string | null;
      holder: string | null;
      bank_name: string | null;
      account_type: string | null;
      bank_account_number: string | null;
      total_amount: number | null;
      movements: number | null;
      assigned_counterpart_id: number | null;
    }) => ({
      accountIdentifier: String(row.account_identifier),
      rut: row.rut ? String(row.rut) : null,
      holder: row.holder ? String(row.holder) : null,
      bankName: row.bank_name ? String(row.bank_name) : null,
      accountType: row.account_type ? String(row.account_type) : null,
      bankAccountNumber: row.bank_account_number ? String(row.bank_account_number) : null,
      withdrawId: row.account_identifier ? String(row.account_identifier) : null,
      totalAmount: Number(row.total_amount ?? 0),
      movements: Number(row.movements ?? 0),
      assignedCounterpartId: row.assigned_counterpart_id != null ? Number(row.assigned_counterpart_id) : null,
    })
  );
}

export async function counterpartSummary(counterpartId: number, params: { from?: string; to?: string }) {
  const conditions: string[] = ["a.counterpart_id = ?", "t.direction = 'OUT'"];
  const paramsList: (string | number)[] = [counterpartId];

  // EFFECTIVE_TIMESTAMP_EXPR equivalent
  const effectiveTimestamp = "COALESCE(t.user_timestamp, t.timestamp)";

  if (params.from) {
    conditions.push(`${effectiveTimestamp} >= ?`);
    paramsList.push(params.from);
  }
  if (params.to) {
    conditions.push(`${effectiveTimestamp} <= ?`);
    paramsList.push(params.to);
  }
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const monthlySql = `
    SELECT DATE_FORMAT(${effectiveTimestamp}, '%Y-%m-01') AS month,
            COALESCE(a.concept, 'Sin concepto') AS concept,
            SUM(t.amount) AS total
       FROM mp_transactions t
       JOIN mp_counterpart_accounts a ON t.source_id = a.account_identifier
      ${whereClause}
      GROUP BY month, concept
      ORDER BY month ASC
  `;

  const accountSql = `
    SELECT a.account_identifier,
            a.concept,
            a.bank_name,
            SUM(t.amount) AS total,
            COUNT(*) AS count
       FROM mp_transactions t
       JOIN mp_counterpart_accounts a ON t.source_id = a.account_identifier
      ${whereClause}
      GROUP BY a.account_identifier, a.concept, a.bank_name
      ORDER BY total DESC
  `;

  const monthlyRows = await prisma.$queryRawUnsafe<Array<{ month: string; concept: string; total: number | null }>>(
    monthlySql,
    ...paramsList
  );
  const accountRows = await prisma.$queryRawUnsafe<
    Array<{
      account_identifier: string;
      concept: string | null;
      bank_name: string | null;
      total: number | null;
      count: number | null;
    }>
  >(accountSql, ...paramsList);

  return {
    monthly: monthlyRows.map((row: { month: string; concept: string; total: number | null }) => ({
      month: String(row.month),
      concept: String(row.concept),
      total: Number(row.total ?? 0),
    })),
    byAccount: accountRows.map(
      (row: {
        account_identifier: string;
        concept: string | null;
        bank_name: string | null;
        total: number | null;
        count: number | null;
      }) => ({
        account_identifier: String(row.account_identifier),
        concept: row.concept ? String(row.concept) : null,
        bank_name: row.bank_name ? String(row.bank_name) : null,
        total: Number(row.total ?? 0),
        count: Number(row.count ?? 0),
      })
    ),
  };
}

export async function assignAccountsToCounterpartByRut(counterpartId: number, rut: string) {
  const normalized = normalizeRut(rut);
  if (!normalized || !validateRut(normalized)) {
    throw new Error("El RUT no es válido");
  }

  // Logic from attachAccountsByRut in db.ts
  // Find accounts in mp_withdrawals matching the RUT
  // Upsert them into mp_counterpart_accounts linked to counterpartId

  const numericRut = normalized.replace(/[^0-9K]/gi, "");

  const sql = `
    SELECT DISTINCT w.withdraw_id, w.bank_name, w.bank_account_type, w.bank_account_holder
    FROM mp_withdrawals w
    WHERE REPLACE(REPLACE(REPLACE(UPPER(w.identification_number),'.',''),'-',''),' ','') = ?
  `;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      withdraw_id: string;
      bank_name: string | null;
      bank_account_type: string | null;
      bank_account_holder: string | null;
    }>
  >(sql, numericRut);

  for (const row of rows) {
    await prisma.counterpartAccount.upsert({
      where: { accountIdentifier: row.withdraw_id },
      create: {
        counterpartId,
        accountIdentifier: row.withdraw_id,
        bankName: row.bank_name,
        accountType: row.bank_account_type,
        holder: row.bank_account_holder,
      },
      update: {
        counterpartId, // Re-assign if it was assigned to someone else or unassigned
      },
    });
  }
}
