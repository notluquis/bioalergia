// === CURRENCY FORMATTING ===

export const fmtCLP = (n: number | string) => {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num);
};

export const coerceAmount = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\$/g, "").replace(/\./g, "").replace(/\s/g, "").replace(/CLP/gi, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// === RUT FORMATTING ===

export function normalizeRut(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.toUpperCase().replace(/[^0-9K]/g, "");
  if (!cleaned) return null;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body || !/^[0-9]+$/.test(body)) return null;
  return `${parseInt(body, 10)}-${dv}`;
}

export function formatRut(value: string | null | undefined): string {
  const normalized = normalizeRut(value);
  if (!normalized) return "";
  const [body, dv] = normalized.split("-");
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

// === DATE/TIME FORMATTING ===

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "-";

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

export {
  durationToMinutes,
  minutesToDuration,
  parseTimeToMinutes,
  minutesToTime,
} from "~/shared/time";

// === NUMERIC FORMATTING ===

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-CL", options).format(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(decimals)}%`;
}

// === FILE SIZE FORMATTING ===

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
