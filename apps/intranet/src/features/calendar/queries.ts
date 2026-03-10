import { queryOptions } from "@tanstack/react-query";
import {
  fetchAutoLinkEventDteJobStatus,
  fetchCalendarDaily,
  fetchCalendarSummary,
  fetchCalendarSyncLogs,
  fetchCalendars,
  fetchClassificationOptions,
  fetchEventDteLinksByDay,
  fetchEventDteLinksOverview,
  fetchEventDteSuggestions,
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
  treatmentAnalytics: (
    filters: TreatmentAnalyticsFilters,
    granularity?: "day" | "week" | "month" | "all",
  ) => ["calendar", "treatment-analytics", filters, granularity ?? "all"] as const,
  unclassified: (page: number, pageSize: number, filters: MissingFieldFilters) =>
    ["calendar-unclassified", page, pageSize, filters] as const,
  list: ["calendars"] as const,
};

export const calendarDteLinkKeys = {
  all: ["calendar", "dte-link"] as const,
  autoLinkJob: (jobId: null | string) => ["calendar", "dte-link", "auto-link-job", jobId] as const,
  byDay: (date: string) => ["calendar", "dte-link", "by-day", date] as const,
  overview: (params: {
    page?: number;
    pageSize?: number;
    period: string;
    query?: string;
    status?: "all" | "linked" | "pending_issuance" | "unlinked";
  }) =>
    [
      "calendar",
      "dte-link",
      "overview",
      params.period,
      params.status ?? "all",
      params.page ?? 0,
      params.pageSize ?? 25,
      params.query ?? "",
    ] as const,
  suggestions: (calendarId: null | string | undefined, eventId: null | string | undefined) =>
    ["calendar", "dte-link", "suggestions", calendarId, eventId] as const,
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
    queryOptions({
      queryFn: () => fetchUnclassifiedCalendarEvents(pageSize, page * pageSize, filters),
      queryKey: calendarKeys.unclassified(page, pageSize, filters),
    }),
};

export const calendarDteLinkQueries = {
  autoLinkJob: (jobId: null | string) =>
    queryOptions({
      queryFn: () => fetchAutoLinkEventDteJobStatus(jobId ?? ""),
      queryKey: calendarDteLinkKeys.autoLinkJob(jobId),
      staleTime: 0,
    }),
  byDay: (date: string) =>
    queryOptions({
      queryFn: () => fetchEventDteLinksByDay(date),
      queryKey: calendarDteLinkKeys.byDay(date),
    }),
  overview: (params: {
    page?: number;
    pageSize?: number;
    period: string;
    query?: string;
    status?: "all" | "linked" | "pending_issuance" | "unlinked";
  }) =>
    queryOptions({
      queryFn: () => fetchEventDteLinksOverview(params),
      queryKey: calendarDteLinkKeys.overview(params),
    }),
  suggestions: (params: { calendarId: string; eventId: string; limit?: number }) =>
    queryOptions({
      queryFn: () => fetchEventDteSuggestions(params),
      queryKey: calendarDteLinkKeys.suggestions(params.calendarId, params.eventId),
    }),
};
