import { addDays, diffDays, isoWeekday, today, weekday } from "@/lib/dates";

import type { CalendarFilters } from "../types";

export const unique = (values: string[]) =>
  [...new Set(values)].toSorted((a, b) => a.localeCompare(b));

export function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (const [i, element] of a.entries()) {
    if (element !== b[i]) {
      return false; // eslint-disable-line security/detect-object-injection -- safe array iteration
    }
  }
  return true;
}

export function filtersEqual(a: CalendarFilters, b: CalendarFilters) {
  return (
    (a.beneficiaryRut ?? "") === (b.beneficiaryRut ?? "") &&
    a.from === b.from &&
    a.to === b.to &&
    arraysEqual(unique(a.calendarIds ?? []), unique(b.calendarIds ?? [])) &&
    arraysEqual(unique(a.categories), unique(b.categories)) &&
    (a.clinicalSeriesId ?? null) === (b.clinicalSeriesId ?? null) &&
    (a.patientName ?? "").trim() === (b.patientName ?? "").trim() &&
    (a.patientRut ?? "") === (b.patientRut ?? "") &&
    (a.search ?? "").trim() === (b.search ?? "").trim() &&
    (a.seriesKind ?? "") === (b.seriesKind ?? "") &&
    (a.seriesStatus ?? "") === (b.seriesStatus ?? "") &&
    a.maxDays === b.maxDays
  );
}

export function normalizeFilters(filters: CalendarFilters): CalendarFilters {
  return {
    ...filters,
    beneficiaryRut: filters.beneficiaryRut?.trim(),
    calendarIds: unique(filters.calendarIds ?? []),
    categories: unique(filters.categories),
    patientName: filters.patientName?.trim(),
    patientRut: filters.patientRut?.trim(),
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
  const todayStr = today();
  const defaultFrom = addDays(todayStr, -14);
  const defaultTo = addDays(todayStr, 14);
  const startValid = /^\d{4}-\d{2}-\d{2}$/.test(syncStart);
  // ISO "YYYY-MM-DD" strings compare lexicographically == chronologically.
  const from = startValid && syncStart > defaultFrom ? syncStart : defaultFrom;
  const maxForward = addDays(todayStr, lookahead);
  const toCandidate = defaultTo > maxForward ? maxForward : defaultTo;
  const spanDays = Math.max(1, diffDays(toCandidate, from) + 1);
  const maxDays = Math.min(Math.max(spanDays, configuredMax), 365);
  return {
    calendarIds: [],
    categories: [],
    from,
    maxDays,
    search: "",
    to: toCandidate,
  };
};

export function getScheduleDefaultRange() {
  const now = today();
  // If it's Sunday, jump to the next week's Monday
  const base = weekday(now) === 0 ? addDays(now, 1) : now;
  const start = addDays(base, -(isoWeekday(base) - 1));
  return {
    from: start,
    to: addDays(start, 5),
  };
}
