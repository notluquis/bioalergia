import { queryOptions } from "@tanstack/react-query";
import {
  fetchCalendarDaily,
  fetchCalendarSummary,
  fetchCalendarSyncLogs,
  fetchCalendars,
  fetchClassificationOptions,
  fetchTreatmentAnalytics,
  fetchUnclassifiedCalendarEvents,
  type MissingFieldFilters,
} from "./api";
import type { CalendarFilters, TreatmentAnalyticsFilters } from "./types";
import { normalizeFilters } from "./utils/filters";

export const calendarSyncKeys = {
  all: ["calendar-sync"] as const,
  logs: (limit: number) => ["calendar-sync", "logs", limit] as const,
};

export const calendarKeys = {
  all: ["calendar"] as const,
  daily: (filters: CalendarFilters) => ["calendar", "daily", normalizeFilters(filters)] as const,
  options: ["classification-options"] as const,
  summary: (filters: CalendarFilters) =>
    ["calendar", "summary", normalizeFilters(filters)] as const,
  treatmentAnalytics: (filters: TreatmentAnalyticsFilters) =>
    ["calendar", "treatment-analytics", filters] as const,
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters) =>
    ["calendar-unclassified", page, pageSize, filters] as const,
  list: ["calendars"] as const,
};

export const calendarSyncQueries = {
  logs: (limit = 50) =>
    queryOptions({
      queryFn: () => fetchCalendarSyncLogs(limit),
      queryKey: calendarSyncKeys.logs(limit),
      staleTime: 60 * 1000,
    }),
};

export const calendarQueries = {
  daily: (filters: CalendarFilters) =>
    queryOptions({
      queryFn: () => fetchCalendarDaily(normalizeFilters(filters)),
      queryKey: calendarKeys.daily(filters),
    }),
  list: () =>
    queryOptions({
      queryFn: fetchCalendars,
      queryKey: calendarKeys.list,
    }),
  options: () =>
    queryOptions({
      queryFn: fetchClassificationOptions,
      queryKey: calendarKeys.options,
      staleTime: 1000 * 60 * 60, // 1 hour
    }),
  summary: (filters: CalendarFilters) =>
    queryOptions({
      queryFn: () => fetchCalendarSummary(normalizeFilters(filters)),
      queryKey: calendarKeys.summary(filters),
    }),
  treatmentAnalytics: (filters: TreatmentAnalyticsFilters) =>
    queryOptions({
      queryFn: () => fetchTreatmentAnalytics(filters),
      queryKey: calendarKeys.treatmentAnalytics(filters),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters = {}) =>
    queryOptions({
      queryFn: () => fetchUnclassifiedCalendarEvents(pageSize, page * pageSize, filters),
      queryKey: calendarKeys.unclassified(page, pageSize, filters),
    }),
};
