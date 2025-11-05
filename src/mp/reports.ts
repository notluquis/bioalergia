import { detectDelimiter, stripBom } from "../../shared/csv";
import { z } from "zod";

// Un registro genérico de un reporte de MP, donde todas las columnas son strings.
export type MPReportRow = Record<string, string>;

export async function createReleasedMoneyReport(
  accessToken: string,
  dateFromISO: string, // e.g., "2025-09-01T00:00:00Z"
  dateToISO: string // e.g., "2025-09-19T23:59:59Z"
) {
  const res = await fetch("https://api.mercadopago.com/v1/account/release_report", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date_from: dateFromISO, date_to: dateToISO }),
  });
  if (!res.ok) throw new Error(`Release report create failed: ${res.status}`);
  const schema = z.object({ file_name: z.string(), url: z.string() });
  const data = schema.parse(await res.json());
  return data; // devuelve metadata del archivo a generar
}

export async function downloadReportFile(fileUrl: string, accessToken: string) {
  const res = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return await res.text(); // CSV/TSV/pipe según config
}

export function parseDelimited(text: string): MPReportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];
  const headerLine = stripBom(firstLine);
  const delimiter = detectDelimiter(headerLine);
  const headers = splitLine(headerLine, delimiter);

  return lines.slice(1).map((line) => {
    const cols = splitLine(line, delimiter);
    const row: MPReportRow = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

export type Movement = {
  timestamp: string;
  direction: "IN" | "OUT" | "NEUTRO";
  amount: number;
  counterparty?: string;
  description?: string;
  from?: string;
  to?: string;
  balance_pre?: number;
  balance_pos?: number;
  raw: MPReportRow;
};

export function deriveMovements(rows: MPReportRow[], options?: { accountName?: string }): Movement[] {
  const accountName = options?.accountName ?? "Bioalergia";

  return rows.map((r) => {
    const amountRaw = firstNumber([
      toNumber(r.REAL_AMOUNT),
      toNumber(r.TRANSACTION_AMOUNT),
      toNumber(r.NET_CREDIT),
      negateIf(toNumber(r.NET_DEBIT)),
    ]);

    const direction = inferDirection(r, amountRaw);
    const amount = Math.abs(amountRaw ?? 0);

    const balance_pre = firstNumber([
      toNumber(r.AVAILABLE_BALANCE_PRE),
      toNumber(r.BALANCE_PRE),
      toNumber(r.BALANCE_BEFORE_TRANSACTION),
    ]);
    const balance_pos = firstNumber([
      toNumber(r.AVAILABLE_BALANCE_POS),
      toNumber(r.BALANCE_POS),
      toNumber(r.BALANCE_AFTER_TRANSACTION),
    ]);

    const counterparty =
      r.SOURCE_ID || r.SUB_UNIT || r.BUSINESS_UNIT || r.PAYMENT_METHOD_TYPE || r.TRANSACTION_TYPE || undefined;

    const timestamp = r.TRANSACTION_DATE || r.MONEY_RELEASE_DATE || r.SETTLEMENT_DATE || r.DATE || "";

    const description =
      r.DESCRIPTION || r.TRANSACTION_TYPE || r.PAYMENT_METHOD_TYPE || r.SUB_UNIT || r.BUSINESS_UNIT || undefined;

    const origin = direction === "OUT" ? accountName : counterparty || r.BUSINESS_UNIT || r.SUB_UNIT || "Externo";
    const destination = direction === "IN" ? accountName : counterparty || r.BUSINESS_UNIT || r.SUB_UNIT || "Externo";

    return {
      timestamp,
      direction,
      amount,
      counterparty,
      description,
      from: origin || undefined,
      to: destination || undefined,
      balance_pre,
      balance_pos,
      raw: r,
    };
  });
}

function splitLine(line: string, delimiter: string) {
  return stripBom(line)
    .split(delimiter)
    .map((value) => value.trim());
}

function toNumber(value?: string): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Limpia el valor de todo lo que no sea un dígito, coma, punto o signo negativo.
  const cleaned = trimmed
    .replace(/CLP/gi, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return undefined;

  let normalized = cleaned;
  // Heurística para normalizar números con separadores de miles y decimales.
  // Si hay ambos, asumimos que el punto es separador de miles.
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    // Si la coma está después del último punto, es el separador decimal.
    normalized = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function firstNumber(values: (number | undefined)[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function negateIf(value?: number) {
  if (typeof value !== "number") return undefined;
  return value > 0 ? -value : value;
}

function inferDirection(row: MPReportRow, amount?: number): Movement["direction"] {
  const type = (row.TRANSACTION_TYPE || "").toLowerCase();
  const method = (row.PAYMENT_METHOD_TYPE || "").toLowerCase();

  if (typeof amount === "number" && amount !== 0) {
    return amount > 0 ? "IN" : "OUT";
  }

  if (isCreditHint(type) || isCreditHint(method)) return "IN";
  if (isDebitHint(type) || isDebitHint(method)) return "OUT";

  return "NEUTRO";
}

const creditHints = ["credit", "payment", "charge", "collection", "release", "deposit", "incoming"];
const debitHints = ["debit", "withdraw", "withdrawal", "payout", "transfer", "outgoing", "retention"];

function isCreditHint(value: string) {
  return creditHints.some((hint) => value.includes(hint));
}

function isDebitHint(value: string) {
  return debitHints.some((hint) => value.includes(hint));
}
