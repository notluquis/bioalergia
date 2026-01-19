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
  daily: (filters: CalendarFilters) => ["calendar", "daily", normalizeFilters(filters)] as const,
  options: ["classification-options"] as const,
  summary: (filters: CalendarFilters) =>
    ["calendar", "summary", normalizeFilters(filters)] as const,
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters) =>
    ["calendar-unclassified", page, pageSize, filters] as const,
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
      queryFn: () => import("./api").then((m) => m.fetchCalendars()),
      queryKey: ["calendars"], // Using legacy key to match existing or I should align keys
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
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters = {}) =>
    queryOptions({
      queryFn: () => fetchUnclassifiedCalendarEvents(pageSize, page * pageSize, filters),
      queryKey: calendarKeys.unclassified(page, pageSize, filters),
    }),
};
