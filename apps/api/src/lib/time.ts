import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

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
  return (instantToChileDate(date) ?? "").slice(0, 7);
}

/**
 * Return the YYYY-MM-DD string of a given Date, in Chile local time.
 */
export function toChileDateString(date: Date): string {
  return instantToChileDate(date) ?? "";
}

// ===========================================================================
// Canonical DB date/time helpers — the ONE way to read/write @db.Date,
// @db.Time and @db.Timestamptz columns. See ~/.claude memory
// "project-datetime-architecture" + plan starry-sauteeing-moon.
//
// Empirically verified (server TZ=America/Santiago, ZenStack v3 = Kysely+pg):
//   @db.Date (1082)  -> Date at UTC midnight in BOTH ZenStack and $qb.
//   @db.Time (1083)  -> Date anchored 1970-01-01 UTC (ZenStack) OR "HH:MM:SS"
//                       string ($qb). Helpers accept Date | string.
//   @db.Timestamptz  -> a real instant; this is the ONLY class where .tz() is
//                       correct (instantToChileDate).
//
// Anti-pattern that caused the recurring off-by-one bugs: bare `dayjs(x)` or
// `dayjs(x).tz(TZ)` on a @db.Date/@db.Time value rolls the calendar day back
// under Santiago. NEVER do that — use these helpers.
//
// These helpers are intentionally dayjs-free: native Date + Intl only. (Temporal
// is NOT available in the Node 26 runtime — verified, even with --harmony-temporal
// — so we don't depend on it.) `en-CA` locale renders YYYY-MM-DD, which combined
// with `timeZone` gives a correct, DST-aware local calendar date.
// ===========================================================================

const HHMM_OR_HHMMSS = /^(\d{1,2}):(\d{2})(?::\d{2})?/;

// Reusable: a true instant -> its calendar date in America/Santiago, "YYYY-MM-DD".
const CHILE_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Format a @db.Date column value as "YYYY-MM-DD". Reads the UTC wall-clock
 * (the column has no timezone; both ZenStack and $qb return UTC-midnight).
 * Accepts the Date from ZenStack/$qb, or an already-"YYYY-MM-DD" string.
 */
export function dbDateToISO(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null;
}

/**
 * Build the value to WRITE to a @db.Date column from a "YYYY-MM-DD" string:
 * a Date anchored at UTC midnight, so the stored calendar day is exact.
 */
export function isoToDbDate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(`Invalid date: ${iso}. Expected YYYY-MM-DD`);
  }
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Format a @db.Time column value as "HH:mm". Accepts the UTC-anchored Date
 * (ZenStack) or the "HH:MM:SS" string ($qb). Reads UTC components.
 */
export function dbTimeToHHmm(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    // UTC-anchored @db.Time Date -> "HH:mm" from the UTC time part (native).
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(11, 16);
  }
  const match = value.match(HHMM_OR_HHMMSS);
  if (!match) return null;
  const [, hours, minutes] = match;
  if (!hours || !minutes) return null;
  return `${hours.padStart(2, "0")}:${minutes}`;
}

/**
 * Build the value to WRITE to a @db.Time column from "HH:mm[:ss]": a Date whose
 * UTC components are the wall-clock time (Postgres stores the UTC time part).
 * Anchored at the epoch day (Postgres ignores the date for a TIME column).
 */
export function hhmmToDbTime(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, h, m, s = "0"] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds, 0));
}

/**
 * Format a @db.Timestamptz (true instant) as its Chile-local calendar date
 * "YYYY-MM-DD". This is the ONLY date helper that applies .tz() — never use it
 * on a @db.Date value.
 */
export function instantToChileDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : CHILE_DATE_FORMAT.format(d);
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
 * Build a Date from Chile wall-clock components. Use this whenever you have
 * year/month/day/hour/minute values that represent a moment in America/Santiago
 * local time — never `new Date(y, m, d, h, min)`, which interprets the
 * components in the Node runtime's timezone (UTC on Railway) and silently
 * shifts the result by the Chile↔runtime offset.
 *
 * `month` is 0-indexed (matches the JS `Date` convention).
 */
export function buildChileDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const iso = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
  return dayjs.tz(iso, TIMEZONE).toDate();
}

/**
 * Parse an arbitrary date string as Chile local time when no timezone designator is present.
 * If the string already carries a `Z`/offset, honor that offset.
 */
export function parseChileDateTime(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  // Belt-and-suspenders: dayjs.tz / new Date can throw RangeError
  // ("Invalid time value") on certain pathological inputs instead of
  // returning an Invalid Date. The caller already null-guards the
  // result, so swallow throws and return null — the row will be
  // demoted to a per-row error message upstream.
  try {
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
      try {
        const parsed = dayjs.tz(trimmed, fmt, TIMEZONE);
        if (parsed.isValid() && parsed.format(fmt) === trimmed) {
          return parsed.toDate();
        }
      } catch {
        // dayjs.tz(value, fmt, tz) can throw RangeError when the
        // `fmt` doesn't match `trimmed` shape (e.g. fmt expects
        // "HH:mm:ss" but trimmed is "2026-05-18"). The outer catch
        // would swallow this and skip ALL remaining formats —
        // causing every date to return null. Per-format catch lets
        // the loop continue to the next pattern.
        continue;
      }
    }

    try {
      const loose = dayjs.tz(trimmed, TIMEZONE);
      return loose.isValid() ? loose.toDate() : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
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

export function normalizeDate(input: string, boundary: "start" | "end"): string | null {
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

export function normalizeTimestamp(primary: string | Date | null, fallback: string | null): string {
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
  fallback: Date | null | undefined
): string {
  const normalized = normalizeTimestampString(primary ?? null);
  if (normalized) {
    return normalized.replace("T", " ");
  }

  if (fallback instanceof Date) {
    return formatDateForDB(fallback);
  }

  return "";
}

export function normalizeTimestampString(value: string | Date | null): string {
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

export function iterateDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let cursor = dayjs(start).tz(TIMEZONE).startOf("day");
  const limit = dayjs(end).tz(TIMEZONE).startOf("day");
  while (cursor.valueOf() <= limit.valueOf()) {
    dates.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }
  return dates;
}

export function parseDateOnly(value: string): Date | null {
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

export function formatDateOnly(date: Date): string {
  return instantToChileDate(date) ?? "";
}

export function formatChileDateTime(date: Date | string, pattern = "DD/MM/YYYY HH:mm"): string {
  return dayjs(date).tz(TIMEZONE).format(pattern);
}

export function coerceDateOnly(value: string): string | null {
  const parsed = parseDateOnly(value);
  return parsed ? formatDateOnly(parsed) : null;
}

export function getNthBusinessDay(base: Date, n: number): Date {
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

export function getMonthRange(month: string): { from: string; to: string } {
  const start = dayjs.tz(`${month}-01`, "YYYY-MM-DD", TIMEZONE);
  const end = start.add(1, "month").subtract(1, "day");
  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}
