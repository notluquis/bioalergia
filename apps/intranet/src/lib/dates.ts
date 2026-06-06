/**
 * Native date utilities for the intranet — Temporal-free, dayjs-free.
 *
 * Strategy: `Intl.DateTimeFormat` for all display formatting (works in every
 * browser incl. Safari, no polyfill) and the "civil-noon UTC anchor" for
 * calendar arithmetic. A Chile calendar day is represented as a `Date` at
 * `YYYY-MM-DDT12:00:00Z`; noon-UTC is 08–09h Chile local, far from both
 * midnights, so adding `n*86400000` ms never crosses a DST boundary into the
 * wrong calendar day. Everything is rendered in America/Santiago.
 *
 * Mirrors the backend `apps/api/src/lib/time.ts` API (formatChile, etc.) so
 * call-sites read the same on both sides of the wire.
 */

export const TIMEZONE = "America/Santiago";
const LOCALE = "es-CL";
const DAY_MS = 86_400_000;

/** Formato ISO estándar: "YYYY-MM-DD" */
export const ISO_DATE_FORMAT = "YYYY-MM-DD";

export type DateInput = Date | string | number | null | undefined;

// ---- token format shim (Intl, es-CL, Chile tz) ----------------------------
const NUMERIC = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const MONTH_LONG = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, month: "long" });
const MONTH_SHORT = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, month: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, weekday: "long" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, weekday: "short" });
const TOKEN_RE = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|mm|ss/g;

// Coerce a display input to a Date: null/undefined -> now; a bare "YYYY-MM-DD"
// is anchored at noon UTC so it renders as that same calendar day in Chile;
// anything else parses as an instant.
function toDisplayDate(value: DateInput): Date {
  if (value == null) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s);
}

function chileTokens(date: Date): Record<string, string> {
  const parts = NUMERIC.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((x) => x.type === type)?.value ?? "";
  const year = get("year");
  const hour = get("hour");
  return {
    YYYY: year,
    YY: year.slice(-2),
    MM: get("month"),
    M: String(Number(get("month"))),
    DD: get("day"),
    D: String(Number(get("day"))),
    HH: hour === "24" ? "00" : hour, // en-CA emits "24" at midnight
    mm: get("minute"),
    ss: get("second"),
    MMMM: MONTH_LONG.format(date),
    MMM: MONTH_SHORT.format(date).replace(".", ""), // dayjs es: "mar" (no period)
    dddd: WEEKDAY_LONG.format(date),
    ddd: WEEKDAY_SHORT.format(date), // dayjs es: "lun." (keep period)
  };
}

/**
 * Format a value with a dayjs-style token pattern, in Chile local time.
 * Drop-in for `dayjs(value).format(pattern)`. Tokens: YYYY YY MMMM MMM MM M
 * DD D dddd ddd HH mm ss, plus `[literal]` escapes.
 */
export function formatChile(value: DateInput, pattern: string): string {
  const tokens = chileTokens(toDisplayDate(value));
  return pattern.replace(TOKEN_RE, (match, literal) =>
    literal === undefined ? (tokens[match] ?? match) : literal
  );
}

// ---- core day helpers ------------------------------------------------------
/** The Chile calendar day of an instant, "YYYY-MM-DD". */
export function chileDay(value: DateInput): string {
  return formatChile(value, "YYYY-MM-DD");
}

/** A "YYYY-MM-DD" string -> Date anchored at noon UTC (DST-safe day anchor). */
export function civilNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** A civil-noon Date back to its "YYYY-MM-DD" (UTC, stable for ±day math). */
function civilISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Shift a "YYYY-MM-DD" by n days (DST-safe). */
export function addDays(isoDate: string, n: number): string {
  return civilISO(new Date(civilNoon(isoDate).getTime() + n * DAY_MS));
}

/** Whole-day difference a-b (both "YYYY-MM-DD"); positive when a is later. */
export function diffDays(a: string, b: string): number {
  return Math.round((civilNoon(a).getTime() - civilNoon(b).getTime()) / DAY_MS);
}

/** Completed years between `birth` and today in Chile (drop-in for dayjs().diff(birth,"year")). */
export function ageYears(birth: DateInput): number {
  const b = chileDay(birth);
  const t = today();
  let years = Number(t.slice(0, 4)) - Number(b.slice(0, 4));
  if (t.slice(5) < b.slice(5)) years--; // birthday not reached yet this year
  return years;
}

function ym(isoDate: string): { year: number; month: number } {
  const parts = isoDate.split("-");
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

function firstOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function lastOfMonth(isoDate: string): string {
  const { year, month } = ym(isoDate);
  // day 0 of next month = last day of this month.
  return civilISO(new Date(Date.UTC(year, month, 0, 12)));
}

/** Shift a "YYYY-MM[-DD]" by n months, returning the first-of-month "YYYY-MM-DD". */
export function addMonths(isoDate: string, n: number): string {
  const { year, month } = ym(`${isoDate.slice(0, 7)}-01`);
  return civilISO(new Date(Date.UTC(year, month - 1 + n, 1, 12)));
}

// ---- public API (mirrors the previous dayjs-based helpers) -----------------
/** Fecha actual en Chile, "YYYY-MM-DD". */
export function today(): string {
  return chileDay(new Date());
}

/** N días atrás (desde hoy en Chile), "YYYY-MM-DD". */
export function daysAgo(days: number): string {
  return addDays(today(), -days);
}

/** Primer día del mes actual, "YYYY-MM-DD". */
export function startOfMonth(): string {
  return firstOfMonth(today());
}

/** Último día del mes actual, "YYYY-MM-DD". */
export function endOfMonth(): string {
  return lastOfMonth(today());
}

/** Primer día del mes de `date`, "YYYY-MM-DD". */
export function startOfMonthFor(date: DateInput): string {
  return firstOfMonth(chileDay(date));
}

/** Último día del mes de `date`, "YYYY-MM-DD". */
export function endOfMonthFor(date: DateInput): string {
  return lastOfMonth(chileDay(date));
}

/** Primer día del año actual, "YYYY-01-01". */
export function startOfYear(): string {
  return `${today().slice(0, 4)}-01-01`;
}

/** Último día del año actual, "YYYY-12-31". */
export function endOfYear(): string {
  return `${today().slice(0, 4)}-12-31`;
}

/** Primer día del mes N meses atrás, "YYYY-MM-DD". */
export function monthsAgoStart(months: number): string {
  return firstOfMonth(addMonths(today(), -months));
}

/** Último día del mes N meses atrás, "YYYY-MM-DD". */
export function monthsAgoEnd(months: number): string {
  return lastOfMonth(addMonths(today(), -months));
}

/** Cualquier fecha -> "YYYY-MM-DD" (en Chile). */
export function formatISO(date: DateInput): string {
  return chileDay(date);
}

/** Inclusive list of "YYYY-MM" months spanning fromYM..toYM (each accepts YYYY-MM[-DD]). */
export function iterateMonths(fromYM: string, toYM: string): string[] {
  const end = toYM.slice(0, 7);
  const out: string[] = [];
  let cur = fromYM.slice(0, 7);
  while (cur <= end && out.length < 1200) {
    out.push(cur);
    cur = addMonths(`${cur}-01`, 1).slice(0, 7);
  }
  return out;
}

/** Days in the month of `isoDate` (YYYY-MM[-DD]). */
export function daysInMonth(isoDate: string): number {
  const { year, month } = ym(`${isoDate.slice(0, 7)}-01`);
  return new Date(year, month, 0).getDate();
}

/** ISO weekday (1=Mon … 7=Sun) of `isoDate` (YYYY-MM-DD). */
export function isoWeekday(isoDate: string): number {
  return ((civilNoon(isoDate).getUTCDay() + 6) % 7) + 1;
}

/** Weekday index (0=Sun … 6=Sat, matches dayjs `.day()`) of `isoDate`. */
export function weekday(isoDate: string): number {
  return civilNoon(isoDate).getUTCDay();
}

/** Monday ("YYYY-MM-DD") of the ISO week containing `date`'s Chile calendar day. */
export function startOfWeek(date: DateInput): string {
  const iso = chileDay(date);
  return addDays(iso, -(isoWeekday(iso) - 1));
}

/** Sunday ("YYYY-MM-DD") of the ISO week containing `date`'s Chile calendar day. */
export function endOfWeek(date: DateInput): string {
  return addDays(startOfWeek(date), 6);
}

// ---- ISO week --------------------------------------------------------------
/** ISO-8601 week number (1–53) of `date`'s Chile calendar day. */
export function getISOWeek(date: DateInput): number {
  const d = civilNoon(chileDay(date));
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - day + 3); // move to the Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}

/** ISO-8601 week-year (pair with getISOWeek at year boundaries). */
export function getISOWeekYear(date: DateInput): number {
  const d = civilNoon(chileDay(date));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // the Thursday's year is the ISO week-year
  return d.getUTCFullYear();
}

// ---- relative time ---------------------------------------------------------
const RELATIVE = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];

/** "hace 3 días" / "en 2 horas" — relative to now. Drop-in for dayjs().fromNow(). */
export function fromNow(value: DateInput): string {
  const deltaMs = toDisplayDate(value).getTime() - Date.now();
  const abs = Math.abs(deltaMs);
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms || unit === "second") {
      return RELATIVE.format(Math.round(deltaMs / ms), unit);
    }
  }
  return RELATIVE.format(0, "second");
}
