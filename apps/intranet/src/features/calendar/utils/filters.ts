import dayjs from "dayjs";

import type { CalendarFilters } from "../types";

export const unique = (values: string[]) =>
  [...new Set(values)].toSorted((a, b) => a.localeCompare(b));

export function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (const [i, element] of a.entries()) {
    if (element !== b[i]) return false; // eslint-disable-line security/detect-object-injection -- safe array iteration
  }
  return true;
}

export function filtersEqual(a: CalendarFilters, b: CalendarFilters) {
  return (
    a.from === b.from &&
    a.to === b.to &&
    arraysEqual(unique(a.calendarIds ?? []), unique(b.calendarIds ?? [])) &&
    arraysEqual(unique(a.categories), unique(b.categories)) &&
    (a.search ?? "").trim() === (b.search ?? "").trim() &&
    a.maxDays === b.maxDays
  );
}

export function normalizeFilters(filters: CalendarFilters): CalendarFilters {
  return {
    ...filters,
    calendarIds: unique(filters.calendarIds ?? []),
    categories: unique(filters.categories),
    search: (filters.search ?? "").trim(),
  };
}

export const computeDefaultFilters = (settings: {
  calendarDailyMaxDays?: string;
  calendarSyncLookaheadDays?: string;
  calendarSyncStart?: string;
}): CalendarFilters => {
  const syncStart = settings.calendarSyncStart?.trim() ?? "2000-01-01";
  const lookaheadRaw = Number(settings.calendarSyncLookaheadDays ?? "365");
  const lookahead =
    Number.isFinite(lookaheadRaw) && lookaheadRaw > 0
      ? Math.min(Math.floor(lookaheadRaw), 1095)
      : 365;
  const defaultMax = Number(settings.calendarDailyMaxDays ?? "28");
  const configuredMax =
    Number.isFinite(defaultMax) && defaultMax > 0 ? Math.min(Math.floor(defaultMax), 365) : 28;
  // Default to ±2 weeks from today for faster initial load
  const defaultFrom = dayjs().subtract(2, "week");
  const defaultTo = dayjs().add(2, "week");
  const startDate = dayjs(syncStart);
  const from = startDate.isValid() && startDate.isAfter(defaultFrom) ? startDate : defaultFrom;
  const maxForward = dayjs().add(lookahead, "day");
  const toCandidate = defaultTo.isAfter(maxForward) ? maxForward : defaultTo;
  const spanDays = Math.max(1, toCandidate.diff(from, "day") + 1);
  const maxDays = Math.min(Math.max(spanDays, configuredMax), 365);
  return {
    calendarIds: [],
    categories: [],
    from: from.format("YYYY-MM-DD"),
    maxDays,
    search: "",
    to: toCandidate.format("YYYY-MM-DD"),
  };
};
