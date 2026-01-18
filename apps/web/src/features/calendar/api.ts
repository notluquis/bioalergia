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

export interface ClassificationOptions {
  categories: readonly string[];
  treatmentStages: readonly string[];
}

export interface FieldCounts {
  amountExpected: number;
  amountPaid: number;
  attended: number;
  category: number;
  dosage: number;
  treatmentStage: number;
}
export interface MissingFieldFilters {
  /** Filter mode: AND requires all conditions, OR matches any (default: OR) */
  filterMode?: "AND" | "OR";
  missingAmount?: boolean;
  missingAttended?: boolean;
  missingCategory?: boolean;
  missingDosage?: boolean;
  missingTreatmentStage?: boolean;
}

/** Response for async reclassify jobs */
export interface ReclassifyJobResponse {
  jobId: string;
  totalEvents: number;
}

export interface ReclassifyResult {
  fieldCounts: FieldCounts;
  message: string;
  reclassified: number;
  totalChecked: number;
}

export interface UnclassifiedEventsResponse {
  events: CalendarUnclassifiedEvent[];
  totalCount: number;
}

type CalendarDailyResponse = CalendarDaily & { status: "ok" };

type CalendarSummaryResponse = CalendarSummary & { status: "ok" };

interface CalendarSyncResponse {
  logId: number;
  message: string;
  status: "accepted";
}

export async function classifyCalendarEvent(payload: CalendarEventClassificationPayload): Promise<void> {
  await apiClient.post<{ status: "ok" }>("/api/calendar/events/classify", payload);
}

export async function fetchCalendarDaily(filters: CalendarFilters): Promise<CalendarDaily> {
  const response = await apiClient.get<CalendarDailyResponse>("/api/calendar/events/daily", {
    query: buildQuery(filters, { includeMaxDays: true }),
  });

  return {
    days: response.days,
    filters: response.filters,
    totals: response.totals,
  };
}

export async function fetchCalendars(): Promise<CalendarData[]> {
  const response = await apiClient.get<{ calendars: CalendarData[] }>("/api/calendar/calendars");
  return response.calendars;
}

export async function fetchCalendarSummary(filters: CalendarFilters): Promise<CalendarSummary> {
  const response = await apiClient.get<CalendarSummaryResponse>("/api/calendar/events/summary", {
    query: buildQuery(filters),
  });

  return {
    aggregates: response.aggregates,
    available: response.available,
    filters: response.filters,
    totals: response.totals,
  };
}

export async function fetchCalendarSyncLogs(limit = 50): Promise<CalendarSyncLog[]> {
  const response = await apiClient.get<{ logs: CalendarSyncLog[]; status: "ok" }>(
    `/api/calendar/events/sync/logs?limit=${limit}`
  );

  return response.logs;
}

export async function fetchClassificationOptions(): Promise<ClassificationOptions> {
  const response = await apiClient.get<{
    categories: readonly string[];
    status: "ok";
    treatmentStages: readonly string[];
  }>("/api/calendar/classification-options");

  return {
    categories: response.categories,
    treatmentStages: response.treatmentStages,
  };
}

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
    events: CalendarUnclassifiedEvent[];
    status: "ok";
    totalCount: number;
  }>(`/api/calendar/events/unclassified?${params.toString()}`);

  return { events: response.events, totalCount: response.totalCount };
}

/** Start reclassification of ALL events (returns immediately with jobId) */
export async function reclassifyAllCalendarEvents(): Promise<ReclassifyJobResponse> {
  const response = await apiClient.post<{
    jobId: string;
    status: "accepted";
    totalEvents: number;
  }>("/api/calendar/events/reclassify-all", {});

  return {
    jobId: response.jobId,
    totalEvents: response.totalEvents,
  };
}

/** Start reclassification job (returns immediately with jobId) */
export async function reclassifyCalendarEvents(): Promise<ReclassifyJobResponse> {
  const response = await apiClient.post<{
    jobId: string;
    status: "accepted";
    totalEvents: number;
  }>("/api/calendar/events/reclassify", {});

  return {
    jobId: response.jobId,
    totalEvents: response.totalEvents,
  };
}

export async function syncCalendarEvents(): Promise<CalendarSyncResponse> {
  const response = await apiClient.post<CalendarSyncResponse>("/api/calendar/events/sync", {});
  return response;
}

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

  if (filters.categories.length > 0) {
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
