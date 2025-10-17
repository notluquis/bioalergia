import { apiClient } from "../../lib/apiClient";
import type { CalendarFilters, CalendarSummary, CalendarDaily } from "./types";

type CalendarSummaryResponse = CalendarSummary & { status: "ok" };

type CalendarDailyResponse = CalendarDaily & { status: "ok" };
type CalendarSyncResponse = {
  status: "ok";
  fetchedAt: string;
  events: number;
  inserted: number;
  updated: number;
  skipped: number;
  excluded: number;
};

function buildQuery(filters: CalendarFilters, options?: { includeMaxDays?: boolean }) {
  const query: Record<string, unknown> = {
    from: filters.from,
    to: filters.to,
  };

  if (filters.calendarIds.length) {
    query.calendarId = filters.calendarIds;
  }

  if (filters.eventTypes.length) {
    query.eventType = filters.eventTypes;
  }

  if (filters.search.trim()) {
    query.search = filters.search.trim();
  }

  if (options?.includeMaxDays) {
    query.maxDays = filters.maxDays;
  }

  return query;
}

export async function fetchCalendarSummary(filters: CalendarFilters): Promise<CalendarSummary> {
  const response = await apiClient.get<CalendarSummaryResponse>("/api/calendar/events/summary", {
    query: buildQuery(filters),
  });

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el resumen de calendario");
  }

  return {
    filters: response.filters,
    totals: response.totals,
    aggregates: response.aggregates,
    available: response.available,
  };
}

export async function fetchCalendarDaily(filters: CalendarFilters): Promise<CalendarDaily> {
  const response = await apiClient.get<CalendarDailyResponse>("/api/calendar/events/daily", {
    query: buildQuery(filters, { includeMaxDays: true }),
  });

  if (response.status !== "ok") {
    throw new Error("No se pudo obtener los eventos diarios");
  }

  return {
    filters: response.filters,
    totals: response.totals,
    days: response.days,
  };
}

export async function syncCalendarEvents(): Promise<CalendarSyncResponse> {
  const response = await apiClient.post<CalendarSyncResponse>("/api/calendar/events/sync", {});
  if (response.status !== "ok") {
    throw new Error("No se pudo sincronizar el calendario");
  }
  return response;
}
