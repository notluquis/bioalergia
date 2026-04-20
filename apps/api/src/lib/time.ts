import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const TIMEZONE = "America/Santiago";

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const TZ_DESIGNATOR_REGEX = /[Zz]$|[+-]\d{2}:?\d{2}$/;

const ISO_TIMESTAMP_REGEX =
  /^([0-9]{4}-[0-9]{2}-[0-9]{2})[T ]([0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?$/;

/**
 * Build UTC instants representing the bounds of a YYYY-MM period in Chile local time.
 * `from` is the first millisecond of the month, `to` is the last millisecond.
 */
export function getPeriodRange(period: string): { from: Date; to: Date } {
  if (!PERIOD_REGEX.test(period)) {
    throw new Error(`Invalid period: ${period}`);
  }
  const start = dayjs.tz(`${period}-01`, "YYYY-MM-DD", TIMEZONE);
  return {
    from: start.toDate(),
    to: start.add(1, "month").subtract(1, "millisecond").toDate(),
  };
}

/**
 * Return the YYYY-MM period that a given Date belongs to, in Chile local time.
 */
export function toChilePeriod(date: Date): string {
  return dayjs(date).tz(TIMEZONE).format("YYYY-MM");
}

/**
 * Return the YYYY-MM-DD string of a given Date, in Chile local time.
 */
export function toChileDateString(date: Date): string {
  return dayjs(date).tz(TIMEZONE).format("YYYY-MM-DD");
}

/**
 * Parse "YYYY-MM-DD" as midnight in Chile local time, returning the equivalent UTC instant.
 */
export function parseChileDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = dayjs.tz(trimmed, "YYYY-MM-DD", TIMEZONE);
  return parsed.isValid() ? parsed.startOf("day").toDate() : null;
}

/**
 * Parse an arbitrary date string as Chile local time when no timezone designator is present.
 * If the string already carries a `Z`/offset, honor that offset.
 */
export function parseChileDateTime(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  if (TZ_DESIGNATOR_REGEX.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const formats = [
    "YYYY-MM-DDTHH:mm:ss.SSS",
    "YYYY-MM-DDTHH:mm:ss",
    "YYYY-MM-DD HH:mm:ss.SSS",
    "YYYY-MM-DD HH:mm:ss",
    "YYYY-MM-DD HH:mm",
    "YYYY-MM-DD",
    "DD-MM-YYYY HH:mm:ss",
    "DD-MM-YYYY HH:mm",
    "DD-MM-YYYY",
    "DD/MM/YYYY HH:mm:ss",
    "DD/MM/YYYY HH:mm",
    "DD/MM/YYYY",
  ];
  for (const fmt of formats) {
    const parsed = dayjs.tz(trimmed, fmt, TIMEZONE);
    if (parsed.isValid() && parsed.format(fmt) === trimmed) {
      return parsed.toDate();
    }
  }

  const loose = dayjs.tz(trimmed, TIMEZONE);
  return loose.isValid() ? loose.toDate() : null;
}

export function formatDateForDB(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function normalizeDate(input: string, boundary: "start" | "end") {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts;
  if (!year || !month || !day) {
    return null;
  }
  const base = dayjs.tz(trimmed, "YYYY-MM-DD", TIMEZONE);
  if (!base.isValid()) {
    return null;
  }
  const adjusted = boundary === "start" ? base.startOf("day") : base.endOf("day");
  return adjusted.format("YYYY-MM-DD HH:mm:ss");
}

export function normalizeTimestamp(primary: string | Date | null, fallback: string | null) {
  const normalizedFallback = normalizeTimestampString(fallback);
  if (normalizedFallback) {
    return normalizedFallback;
  }

  if (primary instanceof Date) {
    return formatDateForDB(primary).replace(" ", "T");
  }

  const normalizedPrimary = normalizeTimestampString(primary);
  if (normalizedPrimary) {
    return normalizedPrimary;
  }

  return "";
}

export function normalizeTimestampForDb(
  primary: string | null | undefined,
  fallback: Date | null | undefined,
) {
  const normalized = normalizeTimestampString(primary ?? null);
  if (normalized) {
    return normalized.replace("T", " ");
  }

  if (fallback instanceof Date) {
    return formatDateForDB(fallback);
  }

  return "";
}

export function normalizeTimestampString(value: string | Date | null) {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return formatDateForDB(value).replace(" ", "T");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const isoMatch = trimmed.match(ISO_TIMESTAMP_REGEX);
  if (isoMatch) {
    const [, datePart, timePart] = isoMatch;
    return `${datePart}T${timePart}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateForDB(parsed).replace(" ", "T");
  }

  return trimmed.replace(" ", "T");
}

export function iterateDateRange(start: Date, end: Date) {
  const dates: string[] = [];
  let cursor = dayjs(start).tz(TIMEZONE).startOf("day");
  const limit = dayjs(end).tz(TIMEZONE).startOf("day");
  while (cursor.valueOf() <= limit.valueOf()) {
    dates.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }
  return dates;
}

export function parseDateOnly(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts;
  if (!year || !month || !day) {
    return null;
  }
  const parsed = dayjs.tz(trimmed, "YYYY-MM-DD", TIMEZONE);
  if (
    !parsed.isValid() ||
    parsed.year() !== year ||
    parsed.month() !== month - 1 ||
    parsed.date() !== day
  ) {
    return null;
  }
  return parsed.toDate();
}

export function formatDateOnly(date: Date) {
  return dayjs(date).tz(TIMEZONE).format("YYYY-MM-DD");
}

export function coerceDateOnly(value: string) {
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : null;
}

export function getNthBusinessDay(base: Date, n: number) {
  let cursor = dayjs(base).tz(TIMEZONE);
  let count = 0;
  while (count < n) {
    const day = cursor.day();
    if (day !== 0 && day !== 6) {
      count += 1;
      if (count === n) {
        break;
      }
    }
    cursor = cursor.add(1, "day");
  }
  return cursor.toDate();
}

export function getMonthRange(month: string) {
  const start = dayjs.tz(`${month}-01`, "YYYY-MM-DD", TIMEZONE);
  const end = start.add(1, "month").subtract(1, "day");
  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}
