import { detectDelimiter, stripBom } from "../../shared/csv";

const REQUIRED_COLUMNS = [
  "SOURCE_ID",
  "PAYMENT_METHOD_TYPE",
  "TRANSACTION_TYPE",
  "TRANSACTION_AMOUNT",
  "TRANSACTION_DATE",
  "SETTLEMENT_DATE",
  "REAL_AMOUNT",
];

const WITHDRAW_IDENTIFIER_TOKEN = "withdraw_id";

export async function analyzeTransactionHeaders(file: File) {
  const text = await file.text();
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const delimiter = detectDelimiter(firstLine);
  const headers = stripBom(firstLine)
    .split(delimiter)
    .map((h) => h.trim().toUpperCase());
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  return { headersCount: headers.length, missing };
}

export async function fileHasWithdrawHeader(file: File) {
  const text = await file.text();
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const normalized = stripBom(firstLine).toLowerCase();
  return normalized.includes(WITHDRAW_IDENTIFIER_TOKEN);
}
