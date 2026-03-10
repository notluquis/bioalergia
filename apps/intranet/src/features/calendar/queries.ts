import { queryOptions } from "@tanstack/react-query";
import {
  fetchCalendarDaily,
  fetchCalendarSummary,
  fetchTreatmentAnalytics,
  type MissingFieldFilters,
} from "./api";
import { calendarORPCUtils } from "./orpc";
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
  treatmentAnalytics: (
    filters: TreatmentAnalyticsFilters,
    granularity?: "day" | "week" | "month" | "all",
  ) => ["calendar", "treatment-analytics", filters, granularity ?? "all"] as const,
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters) =>
    ["calendar-unclassified", page, pageSize, filters] as const,
  list: ["calendars"] as const,
};

export const calendarSyncQueries = {
  logs: (limit = 50) =>
    calendarORPCUtils.syncLogs.queryOptions({
      input: { limit },
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
    calendarORPCUtils.calendars.queryOptions({
      queryKey: calendarKeys.list,
    }),
  options: () =>
    calendarORPCUtils.classificationOptions.queryOptions({
      queryKey: calendarKeys.options,
      staleTime: 1000 * 60 * 60, // 1 hour
    }),
  summary: (filters: CalendarFilters) =>
    queryOptions({
      queryFn: () => fetchCalendarSummary(normalizeFilters(filters)),
      queryKey: calendarKeys.summary(filters),
    }),
  treatmentAnalytics: (
    filters: TreatmentAnalyticsFilters,
    granularity?: "day" | "week" | "month" | "all",
  ) =>
    queryOptions({
      queryFn: () => fetchTreatmentAnalytics(filters, granularity),
      queryKey: calendarKeys.treatmentAnalytics(filters, granularity),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters = {}) =>
    calendarORPCUtils.unclassifiedEvents.queryOptions({
      input: {
        filterMode: filters.filterMode,
        limit: pageSize,
        missing: filters.missing ? [...new Set(filters.missing)] : undefined,
        offset: page * pageSize,
      },
      queryKey: calendarKeys.unclassified(page, pageSize, filters),
    }),
};
