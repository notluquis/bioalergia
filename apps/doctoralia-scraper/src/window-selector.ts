import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);

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

type Dayjs = ReturnType<typeof dayjs>;

const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 19;

function weekWindow(monday: Dayjs, tier: TierKey): WindowRequest {
  const sunday = monday.add(6, "day");
  return {
    from: monday.format("YYYY-MM-DD"),
    to: `${sunday.format("YYYY-MM-DD")}T23:59:59`,
    tier,
  };
}

function monthAsWeekWindows(local: Dayjs, monthOffset: number, tier: TierKey): WindowRequest[] {
  const monthStart = local.startOf("month").add(monthOffset, "month");
  const monthEnd = monthStart.endOf("month");
  const firstMonday = monthStart.startOf("isoWeek");
  const lastMonday = monthEnd.startOf("isoWeek");

  const windows: WindowRequest[] = [];
  let cursor = firstMonday;
  while (cursor.isSameOrBefore(lastMonday, "day")) {
    windows.push(weekWindow(cursor, tier));
    cursor = cursor.add(7, "day");
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
  timezone: string = SCRAPER_TIMEZONE,
): WindowRequest[] {
  const local = dayjs.utc(now).tz(timezone);
  const hour = local.hour();
  if (hour < BUSINESS_HOUR_START || hour >= BUSINESS_HOUR_END) return [];

  const tickInDay = (hour - BUSINESS_HOUR_START) * 2 + (local.minute() >= 30 ? 1 : 0);
  const isFirstTickOfDay = tickInDay === 0;
  const isMonday = local.isoWeekday() === 1;
  const isFirstTickOfWeek = isFirstTickOfDay && isMonday;
  const isoWeekNumber = local.isoWeek();

  const monday = local.startOf("isoWeek");
  const windows: WindowRequest[] = [];

  windows.push(weekWindow(monday, "W0"));

  if (tickInDay % 3 === 0) {
    windows.push(weekWindow(monday.add(1, "week"), "W1"));
  }

  if (isFirstTickOfDay) {
    windows.push(weekWindow(monday.add(2, "week"), "W2"));
  }

  if (isFirstTickOfWeek) {
    windows.push(...monthAsWeekWindows(local, 1, "M1"));
  }

  if (isFirstTickOfWeek && isoWeekNumber % 2 === 0) {
    windows.push(...monthAsWeekWindows(local, 2, "M2"));
  }

  if (isFirstTickOfWeek && isoWeekNumber % 3 === 0) {
    windows.push(...monthAsWeekWindows(local, 3, "M3"));
  }

  const seen = new Set<string>();
  return windows.filter((w) => {
    const key = `${w.from}|${w.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getTickDebugInfo(
  now: Date,
  timezone: string = SCRAPER_TIMEZONE,
): TickDebugInfo {
  const local = dayjs.utc(now).tz(timezone);
  const hour = local.hour();
  const minute = local.minute();
  const withinBusinessHours = hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;

  return {
    hour,
    isoNow: now.toISOString(),
    localIso: local.format(),
    minute,
    tickInDay: withinBusinessHours
      ? (hour - BUSINESS_HOUR_START) * 2 + (minute >= 30 ? 1 : 0)
      : null,
    timezone,
    withinBusinessHours,
  };
}
