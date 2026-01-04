import { apiClient } from "@/lib/apiClient";

import type {
  CalendarDaily,
  CalendarData,
  CalendarEventClassificationPayload,
  CalendarFilters,
  CalendarSummary,
  CalendarSyncLog,
  CalendarUnclassifiedEvent,
} from "./types";

type CalendarSummaryResponse = CalendarSummary & { status: "ok" };

type CalendarDailyResponse = CalendarDaily & { status: "ok" };
type CalendarSyncResponse = {
  status: "accepted";
  message: string;
  logId: number;
};

function buildQuery(filters: CalendarFilters, options?: { includeMaxDays?: boolean }) {
  const query: Record<string, unknown> = {
    from: filters.from,
    to: filters.to,
  };

  if (filters.calendarIds?.length) {
    query.calendarId = filters.calendarIds;
  }

  if (filters.eventTypes?.length) {
    query.eventType = filters.eventTypes;
  }

  if (filters.categories.length) {
    query.category = filters.categories;
  }

  if (filters.search?.trim()) {
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
  if (response.status !== "accepted") {
    throw new Error("No se pudo iniciar la sincronización del calendario");
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

export type MissingFieldFilters = {
  missingCategory?: boolean;
  missingAmount?: boolean;
  missingAttended?: boolean;
  missingDosage?: boolean;
  missingTreatmentStage?: boolean;
  /** Filter mode: AND requires all conditions, OR matches any (default: OR) */
  filterMode?: "AND" | "OR";
};

export type UnclassifiedEventsResponse = {
  events: CalendarUnclassifiedEvent[];
  totalCount: number;
};

export async function fetchUnclassifiedCalendarEvents(
  limit = 50,
  offset = 0,
  filters?: MissingFieldFilters
): Promise<UnclassifiedEventsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (filters?.missingCategory) params.set("missingCategory", "true");
  if (filters?.missingAmount) params.set("missingAmount", "true");
  if (filters?.missingAttended) params.set("missingAttended", "true");
  if (filters?.missingDosage) params.set("missingDosage", "true");
  if (filters?.missingTreatmentStage) params.set("missingTreatmentStage", "true");
  if (filters?.filterMode) params.set("filterMode", filters.filterMode);

  const response = await apiClient.get<{
    status: "ok";
    events: CalendarUnclassifiedEvent[];
    totalCount: number;
  }>(`/api/calendar/events/unclassified?${params.toString()}`);
  if (response.status !== "ok") {
    throw new Error("No se pudo obtener la lista de eventos sin clasificar");
  }
  return { events: response.events, totalCount: response.totalCount };
}

export async function classifyCalendarEvent(payload: CalendarEventClassificationPayload): Promise<void> {
  const response = await apiClient.post<{ status: "ok" }>("/api/calendar/events/classify", payload);
  if (response.status !== "ok") {
    throw new Error("No se pudo actualizar la clasificación del evento");
  }
}

export async function fetchCalendars(): Promise<CalendarData[]> {
  const response = await apiClient.get<{ calendars: CalendarData[] }>("/api/calendar/calendars");
  return response.calendars;
}

export type FieldCounts = {
  category: number;
  dosage: number;
  treatmentStage: number;
  attended: number;
  amountExpected: number;
  amountPaid: number;
};

export type ReclassifyResult = {
  totalChecked: number;
  reclassified: number;
  message: string;
  fieldCounts: FieldCounts;
};

/** Response for async reclassify jobs */
export type ReclassifyJobResponse = {
  jobId: string;
  totalEvents: number;
};

/** Start reclassification job (returns immediately with jobId) */
export async function reclassifyCalendarEvents(): Promise<ReclassifyJobResponse> {
  const response = await apiClient.post<{
    status: "accepted";
    jobId: string;
    totalEvents: number;
  }>("/api/calendar/events/reclassify", {});
  if (response.status !== "accepted") {
    throw new Error("No se pudo iniciar la reclasificación");
  }
  return {
    jobId: response.jobId,
    totalEvents: response.totalEvents,
  };
}

/** Start reclassification of ALL events (returns immediately with jobId) */
export async function reclassifyAllCalendarEvents(): Promise<ReclassifyJobResponse> {
  const response = await apiClient.post<{
    status: "accepted";
    jobId: string;
    totalEvents: number;
  }>("/api/calendar/events/reclassify-all", {});
  if (response.status !== "accepted") {
    throw new Error("No se pudo iniciar la reclasificación total");
  }
  return {
    jobId: response.jobId,
    totalEvents: response.totalEvents,
  };
}

export type ClassificationOptions = {
  categories: readonly string[];
  treatmentStages: readonly string[];
};

export async function fetchClassificationOptions(): Promise<ClassificationOptions> {
  const response = await apiClient.get<{
    status: "ok";
    categories: readonly string[];
    treatmentStages: readonly string[];
  }>("/api/calendar/classification-options");
  if (response.status !== "ok") {
    throw new Error("No se pudo obtener las opciones de clasificación");
  }
  return {
    categories: response.categories,
    treatmentStages: response.treatmentStages,
  };
}
