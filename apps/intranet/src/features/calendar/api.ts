import { apiClient } from "@/lib/api-client";
import {
  CalendarDailyResponseSchema,
  CalendarSummaryResponseSchema,
  CalendarSyncLogsResponseSchema,
  CalendarSyncResponseSchema,
  CalendarsResponseSchema,
  ClassificationOptionsSchema,
  EventDteAutoLinkAllPeriodsResponseSchema,
  EventDteAutoLinkPeriodResponseSchema,
  EventDteAutoLinkResponseSchema,
  EventDteByDayResponseSchema,
  EventDteConfirmResponseSchema,
  EventDteOverviewResponseSchema,
  EventDteSuggestionResponseSchema,
  ReclassifyJobResponseSchema,
  StatusOkSchema,
  TreatmentAnalyticsResponseSchema,
  UnclassifiedEventsResponseSchema,
} from "./schemas";
import type {
  CalendarDaily,
  CalendarData,
  CalendarEventClassificationPayload,
  CalendarFilters,
  CalendarSummary,
  CalendarSyncLog,
  CalendarUnclassifiedEvent,
  EventDteConfirmedLink,
  EventDteOverviewResponseData,
  EventDteSuggestion,
  TreatmentAnalytics,
  TreatmentAnalyticsFilters,
} from "./types";

export interface ClassificationOptions {
  categories: readonly string[];
  missingFilters: readonly { key: string; label: string }[];
  patchReadings: readonly string[];
  testSubtypes: readonly string[];
  treatmentStages: readonly string[];
}

export interface FieldCounts {
  amountExpected: number;
  amountPaid: number;
  attended: number;
  category: number;
  dosageValue: number;
  dosageUnit: number;
  treatmentStage: number;
}
export interface MissingFieldFilters {
  /** Filter mode: AND requires all conditions, OR matches any (default: OR) */
  filterMode?: "AND" | "OR";
  missing?: string[];
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

export async function classifyCalendarEvent(
  payload: CalendarEventClassificationPayload,
): Promise<void> {
  await apiClient.post<{ status: "ok" }>("/api/calendar/events/classify", payload, {
    responseSchema: StatusOkSchema,
  });
}

export async function fetchCalendarDaily(filters: CalendarFilters): Promise<CalendarDaily> {
  const response = await apiClient.get<CalendarDailyResponse>("/api/calendar/events/daily", {
    query: buildQuery(filters, { includeMaxDays: true }),
    responseSchema: CalendarDailyResponseSchema,
  });

  return {
    days: response.days,
    filters: response.filters,
    totals: response.totals,
  };
}

export async function fetchCalendars(): Promise<CalendarData[]> {
  const response = await apiClient.get<{ calendars: CalendarData[] }>("/api/calendar/calendars", {
    responseSchema: CalendarsResponseSchema,
  });
  return response.calendars;
}

export async function fetchCalendarSummary(filters: CalendarFilters): Promise<CalendarSummary> {
  const response = await apiClient.get<CalendarSummaryResponse>("/api/calendar/events/summary", {
    query: buildQuery(filters),
    responseSchema: CalendarSummaryResponseSchema,
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
    `/api/calendar/events/sync/logs?limit=${limit}`,
    { responseSchema: CalendarSyncLogsResponseSchema },
  );

  return response.logs;
}

export async function fetchClassificationOptions(): Promise<ClassificationOptions> {
  const response = await apiClient.get<{
    categories: readonly string[];
    missingFilters: readonly { key: string; label: string }[];
    patchReadings: readonly string[];
    status: "ok";
    testSubtypes: readonly string[];
    treatmentStages: readonly string[];
  }>("/api/calendar/classification-options", { responseSchema: ClassificationOptionsSchema });

  return {
    categories: response.categories,
    missingFilters: response.missingFilters,
    patchReadings: response.patchReadings,
    testSubtypes: response.testSubtypes,
    treatmentStages: response.treatmentStages,
  };
}

export async function fetchUnclassifiedCalendarEvents(
  limit = 50,
  offset = 0,
  filters?: MissingFieldFilters,
): Promise<UnclassifiedEventsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (filters?.missing?.length) {
    const uniqueMissing = [...new Set(filters.missing)];
    for (const key of uniqueMissing) {
      params.append("missing", key);
    }
  }
  if (filters?.filterMode) {
    params.set("filterMode", filters.filterMode);
  }

  const response = await apiClient.get<{
    events: CalendarUnclassifiedEvent[];
    status: "ok";
    totalCount: number;
  }>(`/api/calendar/events/unclassified?${params.toString()}`, {
    responseSchema: UnclassifiedEventsResponseSchema,
  });

  return { events: response.events, totalCount: response.totalCount };
}

/** Start reclassification of ALL events (returns immediately with jobId) */
export async function reclassifyAllCalendarEvents(): Promise<ReclassifyJobResponse> {
  const response = await apiClient.post<{
    jobId: string;
    status: "accepted";
    totalEvents: number;
  }>("/api/calendar/events/reclassify-all", {}, { responseSchema: ReclassifyJobResponseSchema });

  return {
    jobId: response.jobId,
    totalEvents: response.totalEvents,
  };
}

/** Start reclassification job for all pending events (returns immediately with jobId) */
export async function reclassifyCalendarEvents(): Promise<ReclassifyJobResponse> {
  const response = await apiClient.post<{
    jobId: string;
    status: "accepted";
    totalEvents: number;
  }>("/api/calendar/events/reclassify", {}, { responseSchema: ReclassifyJobResponseSchema });

  return {
    jobId: response.jobId,
    totalEvents: response.totalEvents,
  };
}

export async function syncCalendarEvents(): Promise<CalendarSyncResponse> {
  const response = await apiClient.post<CalendarSyncResponse>(
    "/api/calendar/events/sync",
    {},
    { responseSchema: CalendarSyncResponseSchema },
  );
  return response;
}

export async function fetchTreatmentAnalytics(
  filters: TreatmentAnalyticsFilters,
  granularity?: "day" | "week" | "month" | "all",
): Promise<TreatmentAnalytics> {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  // Use singular 'calendarId' to match backend expectation
  if (filters.calendarIds?.length) {
    // Send as multiple calendarId params (backend expects singular param name)
    for (const id of filters.calendarIds) {
      params.append("calendarId", id);
    }
  }
  if (granularity) {
    params.set("granularity", granularity);
  }

  const response = await apiClient.get<{
    data: TreatmentAnalytics;
    filters: TreatmentAnalyticsFilters;
    status: "ok";
  }>(`/api/calendar/events/treatment-analytics?${params.toString()}`, {
    responseSchema: TreatmentAnalyticsResponseSchema,
  });

  return response.data;
}

export async function fetchEventDteLinksByDay(date: string): Promise<EventDteConfirmedLink[]> {
  const response = await apiClient.get<{ data: EventDteConfirmedLink[]; status: "success" }>(
    "/api/dte-analytics/event-links/by-day",
    {
      query: { date },
      responseSchema: EventDteByDayResponseSchema,
    },
  );
  return response.data;
}

export async function fetchEventDteSuggestions(params: {
  calendarId: string;
  eventId: string;
  limit?: number;
}): Promise<{
  event: null | {
    amountExpected: null | number;
    amountPaid: null | number;
    calendarId: string;
    description: null | string;
    eventDate: string;
    eventId: string;
    hints: { nameHints: string[]; rutHints: string[] };
    summary: null | string;
  };
  linked: unknown;
  suggestions: EventDteSuggestion[];
}> {
  const response = await apiClient.get<{
    data: {
      event: null | {
        amountExpected: null | number;
        amountPaid: null | number;
        calendarId: string;
        description: null | string;
        eventDate: string;
        eventId: string;
        hints: { nameHints: string[]; rutHints: string[] };
        summary: null | string;
      };
      linked: unknown;
      suggestions: EventDteSuggestion[];
    };
    status: "success";
  }>("/api/dte-analytics/event-links/suggestions", {
    query: params,
    responseSchema: EventDteSuggestionResponseSchema,
  });

  return response.data;
}

export async function confirmEventDteLink(payload: {
  calendarId: string;
  confidenceScore?: number;
  dteSaleDetailId: string;
  eventId: string;
  matchedBy?: "manual" | "mixed" | "name_exact" | "name_fuzzy" | "rut";
  matchedName?: null | string;
  matchedRUT?: null | string;
}): Promise<void> {
  await apiClient.post("/api/dte-analytics/event-links/confirm", payload, {
    responseSchema: EventDteConfirmResponseSchema,
  });
}

export async function unlinkEventDteLink(payload: {
  calendarId: string;
  eventId: string;
}): Promise<void> {
  await apiClient.post("/api/dte-analytics/event-links/unlink", payload, {
    responseSchema: EventDteConfirmResponseSchema,
  });
}

export async function autoLinkEventDteByDay(payload: { date: string; minScore?: number }): Promise<{
  date: string;
  details: Array<{ eventId: string; reason: string }>;
  linked: number;
  skipped: number;
  skippedByReason: Array<{ count: number; reason: string }>;
  totalEvents: number;
}> {
  const response = await apiClient.post<{
    data: {
      date: string;
      details: Array<{ eventId: string; reason: string }>;
      linked: number;
      skipped: number;
      skippedByReason: Array<{ count: number; reason: string }>;
      totalEvents: number;
    };
    status: "success";
  }>("/api/dte-analytics/event-links/auto-link-day", payload, {
    responseSchema: EventDteAutoLinkResponseSchema,
  });
  return response.data;
}

export async function autoLinkEventDteByPeriod(payload: {
  minScore?: number;
  period: string;
}): Promise<{
  daysProcessed: number;
  details: Array<{ date: string; linked: number; skipped: number; totalEvents: number }>;
  linked: number;
  period: string;
  skipped: number;
  skippedByReason: Array<{ count: number; reason: string }>;
  totalEvents: number;
}> {
  const response = await apiClient.post<{
    data: {
      daysProcessed: number;
      details: Array<{ date: string; linked: number; skipped: number; totalEvents: number }>;
      linked: number;
      period: string;
      skipped: number;
      skippedByReason: Array<{ count: number; reason: string }>;
      totalEvents: number;
    };
    status: "success";
  }>("/api/dte-analytics/event-links/auto-link-period", payload, {
    responseSchema: EventDteAutoLinkPeriodResponseSchema,
  });
  return response.data;
}

export async function autoLinkEventDteByAllPeriods(payload?: { minScore?: number }): Promise<{
  details: Array<{
    daysProcessed: number;
    linked: number;
    period: string;
    skipped: number;
    totalEvents: number;
  }>;
  linked: number;
  periodsProcessed: number;
  skipped: number;
  skippedByReason: Array<{ count: number; reason: string }>;
  totalEvents: number;
}> {
  const response = await apiClient.post<{
    data: {
      details: Array<{
        daysProcessed: number;
        linked: number;
        period: string;
        skipped: number;
        totalEvents: number;
      }>;
      linked: number;
      periodsProcessed: number;
      skipped: number;
      skippedByReason: Array<{ count: number; reason: string }>;
      totalEvents: number;
    };
    status: "success";
  }>("/api/dte-analytics/event-links/auto-link-all-periods", payload ?? {}, {
    responseSchema: EventDteAutoLinkAllPeriodsResponseSchema,
  });
  return response.data;
}

export async function fetchEventDteLinksOverview(params: {
  page?: number;
  pageSize?: number;
  period: string;
  query?: string;
  status?: "all" | "linked" | "pending_issuance" | "unlinked";
}): Promise<EventDteOverviewResponseData> {
  const response = await apiClient.get<{ data: EventDteOverviewResponseData; status: "success" }>(
    "/api/dte-analytics/event-links/overview",
    {
      query: params,
      responseSchema: EventDteOverviewResponseSchema,
    },
  );

  return response.data;
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
