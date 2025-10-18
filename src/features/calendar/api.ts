import { apiClient } from "../../lib/apiClient";
import type {
  CalendarFilters,
  CalendarSummary,
  CalendarDaily,
  CalendarSyncLog,
  CalendarUnclassifiedEvent,
  CalendarEventClassificationPayload,
} from "./types";

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
  logId: number;
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

  if (filters.categories.length) {
    query.category = filters.categories;
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

export async function fetchCalendarSyncLogs(limit = 50): Promise<CalendarSyncLog[]> {
  const response = await apiClient.get<{ status: "ok"; logs: CalendarSyncLog[] }>(
    `/api/calendar/events/sync/logs?limit=${limit}`
  );
  if (response.status !== "ok") {
    throw new Error("No se pudo obtener el historial de sincronizaciones");
  }
  return response.logs;
}

export async function fetchUnclassifiedCalendarEvents(limit = 50): Promise<CalendarUnclassifiedEvent[]> {
  const response = await apiClient.get<{ status: "ok"; events: CalendarUnclassifiedEvent[] }>(
    `/api/calendar/events/unclassified?limit=${limit}`
  );
  if (response.status !== "ok") {
    throw new Error("No se pudo obtener la lista de eventos sin clasificar");
  }
  return response.events;
}

export async function classifyCalendarEvent(payload: CalendarEventClassificationPayload): Promise<void> {
  const response = await apiClient.post<{ status: "ok" }>("/api/calendar/events/classify", payload);
  if (response.status !== "ok") {
    throw new Error("No se pudo actualizar la clasificación del evento");
  }
}
