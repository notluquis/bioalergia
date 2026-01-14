import { queryOptions } from "@tanstack/react-query";

import {
  fetchCalendarDaily,
  fetchCalendarSummary,
  fetchCalendarSyncLogs,
  fetchClassificationOptions,
  fetchUnclassifiedCalendarEvents,
  type MissingFieldFilters,
} from "./api";
import type { CalendarFilters } from "./types";
import { normalizeFilters } from "./utils/filters";

export const calendarSyncKeys = {
  all: ["calendar-sync"] as const,
  logs: (limit: number) => ["calendar-sync", "logs", limit] as const,
};

export const calendarKeys = {
  all: ["calendar"] as const,
  summary: (filters: CalendarFilters) => ["calendar", "summary", normalizeFilters(filters)] as const,
  daily: (filters: CalendarFilters) => ["calendar", "daily", normalizeFilters(filters)] as const,
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters) =>
    ["calendar-unclassified", page, pageSize, filters] as const,
  options: ["classification-options"] as const,
};

export const calendarSyncQueries = {
  logs: (limit = 50) =>
    queryOptions({
      queryKey: calendarSyncKeys.logs(limit),
      queryFn: () => fetchCalendarSyncLogs(limit),
      staleTime: 60 * 1000,
    }),
};

export const calendarQueries = {
  summary: (filters: CalendarFilters) =>
    queryOptions({
      queryKey: calendarKeys.summary(filters),
      queryFn: () => fetchCalendarSummary(normalizeFilters(filters)),
    }),
  daily: (filters: CalendarFilters) =>
    queryOptions({
      queryKey: calendarKeys.daily(filters),
      queryFn: () => fetchCalendarDaily(normalizeFilters(filters)),
    }),
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters = {}) =>
    queryOptions({
      queryKey: calendarKeys.unclassified(page, pageSize, filters),
      queryFn: () => fetchUnclassifiedCalendarEvents(pageSize, page * pageSize, filters),
    }),
  options: () =>
    queryOptions({
      queryKey: calendarKeys.options,
      queryFn: fetchClassificationOptions,
      staleTime: 1000 * 60 * 60, // 1 hour
    }),
};
