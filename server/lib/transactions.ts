import { formatLocalDateForMySQL, normalizeDate } from "./time.js";

export const EFFECTIVE_TIMESTAMP_EXPR =
  "COALESCE(STR_TO_DATE(SUBSTRING(timestamp_raw, 1, 19), '%Y-%m-%dT%H:%i:%s'), timestamp)";

export type TransactionsQueryOptions = {
  limit: number;
  includeAmounts: boolean;
  from?: string;
  to?: string;
  description?: string;
  origin?: string;
  destination?: string;
  sourceId?: string;
  direction?: "IN" | "OUT" | "NEUTRO";
  bankAccountNumber?: string;
  file?: string;
  page: number;
  pageSize: number;
};

export function clampLimit(value: unknown) {
  const num = Number(value ?? 500);
  if (!Number.isFinite(num) || num <= 0) return 500;
  return Math.min(Math.floor(num), 2000);
}

export function buildTransactionsQuery(options: TransactionsQueryOptions) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? options.limit;
  const offset = (page - 1) * pageSize;

  const effectiveTimestampExpr =
    "COALESCE(STR_TO_DATE(SUBSTRING(t.timestamp_raw, 1, 19), '%Y-%m-%dT%H:%i:%s'), t.timestamp)";

  const fields = [
    "t.id",
    "t.timestamp",
    "t.timestamp_raw",
    "t.description",
    "t.origin",
    "t.destination",
    "t.source_id",
    "t.direction",
    options.includeAmounts ? "t.amount" : "NULL AS amount",
    "t.created_at",
    "mw.withdraw_id AS payout_withdraw_id",
    "mw.date_created AS payout_date_created",
    "mw.status AS payout_status",
    "mw.status_detail AS payout_status_detail",
    "mw.amount AS payout_amount",
    "mw.fee AS payout_fee",
    "mw.payout_desc AS payout_desc",
    "mw.bank_account_holder AS payout_bank_account_holder",
    "mw.bank_name AS payout_bank_name",
    "mw.bank_account_type AS payout_bank_account_type",
    "mw.bank_account_number AS payout_bank_account_number",
    "mw.bank_branch AS payout_bank_branch",
    "mw.identification_type AS payout_identification_type",
    "mw.identification_number AS payout_identification_number",
    "ls.id AS loan_schedule_id",
    "ls.installment_number AS loan_installment_number",
    "ls.status AS loan_schedule_status",
    "ls.due_date AS loan_due_date",
    "ls.expected_amount AS loan_expected_amount",
    "l.public_id AS loan_public_id",
    "l.title AS loan_title",
    "ssvc.id AS service_schedule_id",
    "ssvc.status AS service_schedule_status",
    "ssvc.due_date AS service_due_date",
    "ssvc.expected_amount AS service_expected_amount",
    "ssvc.period_start AS service_period_start",
    "svc.public_id AS service_public_id",
    "svc.name AS service_name",
  ];

  const conditions: string[] = [];
  const params: Array<string | number> = [];
  let hasFromCondition = false;

  if (options.from) {
    const fromDate = normalizeDate(options.from, "start");
    if (fromDate) {
      conditions.push(`${effectiveTimestampExpr} >= ?`);
      params.push(fromDate);
      hasFromCondition = true;
    }
  }

  if (options.to) {
    const toDate = normalizeDate(options.to, "end");
    if (toDate) {
      conditions.push(`${effectiveTimestampExpr} <= ?`);
      params.push(toDate);
    }
  }

  if (options.description) {
    conditions.push("t.description LIKE ?");
    params.push(`%${options.description}%`);
  }

  if (options.origin) {
    conditions.push("t.origin LIKE ?");
    params.push(`%${options.origin}%`);
  }

  if (options.destination) {
    conditions.push("t.destination LIKE ?");
    params.push(`%${options.destination}%`);
  }

  if (options.sourceId) {
    conditions.push("t.source_id LIKE ?");
    params.push(`%${options.sourceId}%`);
  }

  if (options.direction) {
    conditions.push("t.direction = ?");
    params.push(options.direction);
  }

  if (options.bankAccountNumber) {
    const normalizedBankAccountNumber = options.bankAccountNumber.replace(/^0+/, "") || options.bankAccountNumber;
    conditions.push("(mw.bank_account_number = ? OR TRIM(LEADING '0' FROM mw.bank_account_number) = ?)");
    params.push(options.bankAccountNumber, normalizedBankAccountNumber);
  }

  if (options.file) {
    conditions.push("t.source_file LIKE ?");
    params.push(`%${options.file}%`);
  }

  if (!options.from && !hasFromCondition) {
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 10);
    defaultFrom.setHours(0, 0, 0, 0);
    const normalized = formatLocalDateForMySQL(defaultFrom);
    conditions.push(`${effectiveTimestampExpr} >= ?`);
    params.push(normalized);
    hasFromCondition = true;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const joinClause = `LEFT JOIN mp_withdrawals mw ON t.source_id = mw.withdraw_id
    LEFT JOIN loan_schedules ls ON ls.transaction_id = t.id
    LEFT JOIN loans l ON l.id = ls.loan_id
    LEFT JOIN service_schedules ssvc ON ssvc.transaction_id = t.id
    LEFT JOIN services svc ON svc.id = ssvc.service_id`;

  const countSql = `SELECT COUNT(*) AS total
    FROM mp_transactions t
    ${joinClause}
    ${whereClause}`;

  const countParams = [...params];

  const sql = `SELECT ${fields.join(", ")}
    FROM mp_transactions t
    ${joinClause}
    ${whereClause}
    ORDER BY ${effectiveTimestampExpr} DESC
    LIMIT ? OFFSET ?`;

  const dataParams = [...params, pageSize, offset];

  return { sql, dataParams, countSql, countParams, page, pageSize };
}
