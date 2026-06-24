export const SCRAPER_TIMEZONE = "America/Santiago";

export type TierKey = "W0" | "W1" | "W2" | "M1" | "M2" | "M3";

export type WindowRequest = {
  from: string;
  to: string;
  tier: TierKey;
};

export type TickDebugInfo = {
  hour: number;
  isoNow: string;
  localIso: string;
  minute: number;
  tickInDay: number | null;
  timezone: string;
  withinBusinessHours: boolean;
};

const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 19;
const DAY_MS = 86_400_000;

// ---- native Chile-local helpers (Intl + civil-noon UTC anchor) -------------
// A calendar day is a "YYYY-MM-DD" string; we anchor it at noon-UTC for all
// arithmetic so adding whole days never crosses a DST boundary into the wrong
// day. The wall-clock (hour/minute) of an instant is read via Intl in the
// requested zone — replaces the old `dayjs.utc(now).tz(zone)` projection.

type LocalParts = { isoDate: string; hour: number; minute: number; second: number };

function localParts(now: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // en-CA emits "24" at midnight
  return {
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function civilNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, n: number): string {
  return isoOf(new Date(civilNoon(isoDate).getTime() + n * DAY_MS));
}

/** ISO weekday 1=Mon … 7=Sun. */
function isoWeekday(isoDate: string): number {
  return ((civilNoon(isoDate).getUTCDay() + 6) % 7) + 1;
}

/** Monday of the ISO week containing `isoDate`. */
function startOfIsoWeek(isoDate: string): string {
  return addDays(isoDate, -(isoWeekday(isoDate) - 1));
}

/** ISO-8601 week number (1–53). */
function isoWeekNumber(isoDate: string): number {
  const d = civilNoon(isoDate);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}

/** Shift a "YYYY-MM[-DD]" by n months, returning the first-of-month "YYYY-MM-DD". */
function addMonths(isoDate: string, n: number): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return isoOf(new Date(Date.UTC(year, month - 1 + n, 1, 12)));
}

/** Last day of the month containing `isoDate`, "YYYY-MM-DD". */
function lastOfMonth(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  // day 0 of next month = last day of this month.
  return isoOf(new Date(Date.UTC(year, month, 0, 12)));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ----------------------------------------------------------------------------

function weekWindow(mondayIso: string, tier: TierKey): WindowRequest {
  const sundayIso = addDays(mondayIso, 6);
  return {
    from: mondayIso,
    to: `${sundayIso}T23:59:59`,
    tier,
  };
}

export function forcedCurrentWeekWindow(
  now: Date,
  timezone: string = SCRAPER_TIMEZONE
): WindowRequest {
  const { isoDate } = localParts(now, timezone);
  return weekWindow(startOfIsoWeek(isoDate), "W0");
}

function monthAsWeekWindows(localIso: string, monthOffset: number, tier: TierKey): WindowRequest[] {
  const monthStart = addMonths(localIso, monthOffset); // first-of-month
  const monthEnd = lastOfMonth(monthStart);
  const firstMonday = startOfIsoWeek(monthStart);
  const lastMonday = startOfIsoWeek(monthEnd);

  const windows: WindowRequest[] = [];
  let cursor = firstMonday;
  while (cursor <= lastMonday) {
    windows.push(weekWindow(cursor, tier));
    cursor = addDays(cursor, 7);
  }
  return windows;
}

/**
 * Decide which windows to fetch on the current cron tick.
 *
 * Tiers (only fire between 9:00–19:00 local time):
 *  - W0: current ISO week                         — every tick
 *  - W1: next ISO week                            — every 3rd tick of the day
 *  - W2: ISO week after next                      — first tick of the day (09:00)
 *  - M1: next calendar month (split into weeks)   — first tick of Monday
 *  - M2: month after next                         — first tick of Monday on even ISO weeks
 *  - M3: three months ahead                       — first tick of Monday on ISO weeks divisible by 3
 *
 * The tick index within a day is 0 at 09:00, 1 at 09:30, …, 19 at 18:30.
 */
export function selectWindowsForTick(
  now: Date,
  timezone: string = SCRAPER_TIMEZONE
): WindowRequest[] {
  const { isoDate, hour, minute } = localParts(now, timezone);
  if (hour < BUSINESS_HOUR_START || hour >= BUSINESS_HOUR_END) return [];

  const tickInDay = (hour - BUSINESS_HOUR_START) * 2 + (minute >= 30 ? 1 : 0);
  const isFirstTickOfDay = tickInDay === 0;
  const isMonday = isoWeekday(isoDate) === 1;
  const isFirstTickOfWeek = isFirstTickOfDay && isMonday;
  const weekNumber = isoWeekNumber(isoDate);

  const monday = startOfIsoWeek(isoDate);
  const windows: WindowRequest[] = [];

  windows.push(weekWindow(monday, "W0"));

  if (tickInDay % 3 === 0) {
    windows.push(weekWindow(addDays(monday, 7), "W1"));
  }

  if (isFirstTickOfDay) {
    windows.push(weekWindow(addDays(monday, 14), "W2"));
  }

  if (isFirstTickOfWeek) {
    windows.push(...monthAsWeekWindows(isoDate, 1, "M1"));
  }

  if (isFirstTickOfWeek && weekNumber % 2 === 0) {
    windows.push(...monthAsWeekWindows(isoDate, 2, "M2"));
  }

  if (isFirstTickOfWeek && weekNumber % 3 === 0) {
    windows.push(...monthAsWeekWindows(isoDate, 3, "M3"));
  }

  const seen = new Set<string>();
  return windows.filter((w) => {
    const key = `${w.from}|${w.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getTickDebugInfo(now: Date, timezone: string = SCRAPER_TIMEZONE): TickDebugInfo {
  const { isoDate, hour, minute, second } = localParts(now, timezone);
  const withinBusinessHours = hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;

  return {
    hour,
    isoNow: now.toISOString(),
    localIso: `${isoDate}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
    minute,
    tickInDay: withinBusinessHours
      ? (hour - BUSINESS_HOUR_START) * 2 + (minute >= 30 ? 1 : 0)
      : null,
    timezone,
    withinBusinessHours,
  };
}
