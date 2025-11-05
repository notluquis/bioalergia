import { formatLocalDateForMySQL } from "./lib/time.js";

export type PayoutCsvRow = Record<string, string>;

export type PayoutRecord = {
  withdrawId: string;
  dateCreated: string | null;
  status: string | null;
  statusDetail: string | null;
  amount: number | null;
  fee: number | null;
  activityUrl: string | null;
  payoutDesc: string | null;
  bankAccountHolder: string | null;
  identificationType: string | null;
  identificationNumber: string | null;
  bankId: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  raw: PayoutCsvRow;
};

const NUMBER_FIELDS = new Set(["amount", "fee"]);

const DATE_FIELDS = new Set(["date_created"]);

function toStringOrNull(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  return String(value);
}

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildPayouts(rows: PayoutCsvRow[]): PayoutRecord[] {
  const payouts: PayoutRecord[] = [];

  for (const row of rows) {
    const normalized = normalizeRow(row);
    if (!normalized.withdrawId) continue;

    payouts.push({
      withdrawId: normalized.withdrawId,
      dateCreated: normalized.date_created ?? null,
      status: toStringOrNull(normalized.status),
      statusDetail: toStringOrNull(normalized.status_detail),
      amount: toNumberOrNull(normalized.amount),
      fee: toNumberOrNull(normalized.fee),
      activityUrl: toStringOrNull(normalized.activity_url),
      payoutDesc: toStringOrNull(normalized.payout_desc),
      bankAccountHolder: toStringOrNull(normalized.bank_account_holder),
      identificationType: toStringOrNull(normalized.identification_type),
      identificationNumber: toStringOrNull(normalized.identification_number),
      bankId: toStringOrNull(normalized.bank_id),
      bankName: toStringOrNull(normalized.bank_name),
      bankBranch: toStringOrNull(normalized.bank_branch),
      bankAccountType: toStringOrNull(normalized.bank_account_type),
      bankAccountNumber: toStringOrNull(normalized.bank_account_number),
      raw: row,
    });
  }

  return payouts;
}

type NormalizedRow = Record<string, string | number | null> & { withdrawId?: string; date_created?: string | null };

function normalizeRow(row: PayoutCsvRow): NormalizedRow {
  const normalized: NormalizedRow = {};

  for (const [key, value] of Object.entries(row)) {
    const canonicalKey = normalizeHeaderKey(key);
    if (!canonicalKey) continue;
    const trimmed = value?.trim?.() ?? "";

    if (!trimmed) {
      normalized[canonicalKey] = null;
      continue;
    }

    if (NUMBER_FIELDS.has(canonicalKey)) {
      normalized[canonicalKey] = parseNumber(trimmed);
      continue;
    }

    if (DATE_FIELDS.has(canonicalKey)) {
      normalized[canonicalKey] = parseDate(trimmed);
      continue;
    }

    if (canonicalKey === "withdraw_id") {
      normalized.withdrawId = trimmed;
      continue;
    }

    normalized[canonicalKey] = trimmed;
  }

  if (normalized.withdrawId) {
    normalized.withdrawId = normalized.withdrawId.trim();
  }

  return normalized;
}

function normalizeHeaderKey(header: string): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;

  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    return parenMatch[1].trim().toLowerCase();
  }

  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function parseNumber(value: string): number | null {
  const cleaned = value
    .replace(/CLP/gi, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Split on '/' or '-' (no need to escape '/' inside character class)
  const parts = trimmed.split(/[/-]/).map((part) => part.trim());
  if (parts.length !== 3) return null;

  let [day, month, year] = parts;
  if (!day || !month || !year) return null;

  if (year.length === 2) {
    const numericYear = Number(year);
    const century = numericYear >= 70 ? 1900 : 2000;
    year = String(century + numericYear);
  }

  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (!dayNum || !monthNum || !yearNum) return null;

  const date = new Date(yearNum, monthNum - 1, dayNum);
  if (Number.isNaN(date.getTime())) return null;

  return formatLocalDateForMySQL(date);
}
