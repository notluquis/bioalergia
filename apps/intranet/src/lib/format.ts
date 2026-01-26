import { Decimal } from "decimal.js";

// === CURRENCY FORMATTING ===

/** Shared currency formatter instance (CLP, no decimals) */
export const currencyFormatter = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

export const fmtCLP = (n?: Decimal | null | number | string) => {
  // Handle null/undefined
  if (n == null) return "$0";

  // Convert string or Decimal to number
  let num: number;
  if (typeof n === "object" && Decimal.isDecimal(n)) {
    num = n.toNumber();
  } else if (typeof n === "string") {
    num = Number(n);
  } else {
    num = n;
  }

  // Handle NaN or non-finite numbers
  if (!Number.isFinite(num)) return "$0";

  try {
    return currencyFormatter.format(num);
  } catch (error) {
    // Fallback if formatting fails
    console.error("Error formatting currency:", error, "value:", n);
    return "$0";
  }
};

export const coerceAmount = (v?: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v)
    .replaceAll("$", "")
    .replaceAll(".", "")
    .replaceAll(/\s/g, "")
    .replaceAll(/CLP/gi, "")
    .replaceAll(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// === DATE/TIME FORMATTING ===

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || Number.isNaN(d.getTime())) return "-";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
  return `Hace ${Math.floor(diffDays / 365)} años`;
}

// === DURATION FORMATTING ===

export { formatFileSize } from "../../shared/format";

// === NUMERIC FORMATTING ===

/** Shared number formatter instance (es-CL locale) */
export const numberFormatter = new Intl.NumberFormat("es-CL");

/** Safe wrapper for currency formatting that handles null/undefined/invalid values */
export function formatCurrency(value?: Decimal | null | number | string): string {
  if (value == null) return "$0";

  let num: number;
  if (typeof value === "object" && Decimal.isDecimal(value)) {
    num = value.toNumber();
  } else if (typeof value === "string") {
    num = Number(value);
  } else {
    num = value;
  }

  if (!Number.isFinite(num)) return "$0";

  try {
    return currencyFormatter.format(num);
  } catch (error) {
    console.error("Error formatting currency:", error, "value:", value);
    return "$0";
  }
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CL", options).format(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(decimals)}%`;
}

// === FILE SIZE FORMATTING ===

export {
  durationToMinutes,
  minutesToDuration,
  minutesToTime,
  parseTimeToMinutes,
} from "~/shared/time";
