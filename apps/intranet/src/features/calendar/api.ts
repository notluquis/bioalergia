import { apiClient } from "@/lib/api-client";
import { calendarORPCClient, toCalendarApiError } from "./orpc";
import {
  CalendarDailyResponseSchema,
  CalendarSummaryResponseSchema,
  CalendarSyncLogsResponseSchema,
  CalendarSyncResponseSchema,
  CalendarsResponseSchema,
  ClassificationOptionsSchema,
  EventDteAutoLinkAllPeriodsJobStatusResponseSchema,
  EventDteAutoLinkAllPeriodsResponseSchema,
  EventDteAutoLinkAllPeriodsStartResponseSchema,
  EventDteAutoLinkPeriodResponseSchema,
  EventDteAutoLinkResponseSchema,
  EventDteByDayResponseSchema,
  EventDteConfirmResponseSchema,
  EventDteOverviewResponseSchema,
  EventDteSuggestionResponseSchema,
  ReclassifyJobResponseSchema,
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

interface CalendarSyncResponse {
  logId: number;
  message: string;
  status: "accepted";
}

function normalizeCalendarORPCFilters(filters: CalendarFilters) {
  return {
    calendarIds: filters.calendarIds ?? [],
    categories: filters.categories,
    eventTypes: filters.eventTypes,
    from: filters.from,
    maxDays: filters.maxDays,
    search: filters.search,
    to: filters.to,
  };
}

export async function classifyCalendarEvent(
  payload: CalendarEventClassificationPayload,
): Promise<void> {
  try {
    await calendarORPCClient.classifyEvent(payload);
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function fetchCalendarDaily(filters: CalendarFilters): Promise<CalendarDaily> {
  try {
    const response = CalendarDailyResponseSchema.parse({
      status: "ok",
      ...(await calendarORPCClient.dailyEvents(normalizeCalendarORPCFilters(filters))),
    });

    return {
      days: response.days.map((day) => ({
        ...day,
        date: new Date(`${day.date}T00:00:00`),
      })),
      filters: response.filters,
      totals: response.totals,
    };
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function fetchCalendars(): Promise<CalendarData[]> {
  try {
    const calendars = await calendarORPCClient.calendars();
    return CalendarsResponseSchema.parse({ calendars, status: "ok" }).calendars;
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function fetchCalendarSummary(filters: CalendarFilters): Promise<CalendarSummary> {
  try {
    const response = CalendarSummaryResponseSchema.parse({
      status: "ok",
      ...(await calendarORPCClient.summaryEvents(normalizeCalendarORPCFilters(filters))),
    });

    return {
      aggregates: response.aggregates,
      available: response.available,
      filters: response.filters,
      totals: response.totals,
    };
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function fetchCalendarSyncLogs(limit = 50): Promise<CalendarSyncLog[]> {
  try {
    const logs = await calendarORPCClient.syncLogs({ limit });
    return CalendarSyncLogsResponseSchema.parse({ logs, status: "ok" }).logs;
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function fetchClassificationOptions(): Promise<ClassificationOptions> {
  try {
    return ClassificationOptionsSchema.parse(await calendarORPCClient.classificationOptions());
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function fetchUnclassifiedCalendarEvents(
  limit = 50,
  offset = 0,
  filters?: MissingFieldFilters,
): Promise<UnclassifiedEventsResponse> {
  try {
    const response = await calendarORPCClient.unclassifiedEvents({
      filterMode: filters?.filterMode,
      limit,
      missing: filters?.missing ? [...new Set(filters.missing)] : undefined,
      offset,
    });

    const parsed = UnclassifiedEventsResponseSchema.parse({
      status: "ok",
      ...response,
    });

    return { events: parsed.events, totalCount: parsed.totalCount };
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

/** Start reclassification of ALL events (returns immediately with jobId) */
export async function reclassifyAllCalendarEvents(): Promise<ReclassifyJobResponse> {
  try {
    const response = ReclassifyJobResponseSchema.parse(
      await calendarORPCClient.reclassifyAllEvents(),
    );
    return { jobId: response.jobId, totalEvents: response.totalEvents };
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

/** Start reclassification job for all pending events (returns immediately with jobId) */
export async function reclassifyCalendarEvents(
  filters?: MissingFieldFilters,
): Promise<ReclassifyJobResponse> {
  try {
    const response = ReclassifyJobResponseSchema.parse(
      await calendarORPCClient.reclassifyEvents(
        filters
          ? {
              filterMode: filters.filterMode,
              missing: filters.missing ? [...new Set(filters.missing)] : undefined,
            }
          : undefined,
      ),
    );

    return {
      jobId: response.jobId,
      totalEvents: response.totalEvents,
    };
  } catch (error) {
    throw toCalendarApiError(error);
  }
}

export async function syncCalendarEvents(): Promise<CalendarSyncResponse> {
  try {
    return CalendarSyncResponseSchema.parse(await calendarORPCClient.syncEvents());
  } catch (error) {
    throw toCalendarApiError(error);
  }
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

export async function startAutoLinkEventDteAllPeriodsJob(payload?: {
  minScore?: number;
  periodConcurrency?: number;
}): Promise<{ jobId: string; periodConcurrency: number; totalPeriods: number }> {
  const response = await apiClient.post<{
    data: {
      jobId: string;
      periodConcurrency: number;
      totalPeriods: number;
    };
    status: "accepted";
  }>("/api/dte-analytics/event-links/auto-link-all-periods/start", payload ?? {}, {
    responseSchema: EventDteAutoLinkAllPeriodsStartResponseSchema,
  });
  return response.data;
}

export interface EventDteAutoLinkJobStatus {
  error: null | string;
  id: string;
  message: string;
  progress: number;
  result: unknown;
  status: "completed" | "failed" | "pending" | "running";
  total: number;
  type: string;
}

export async function fetchAutoLinkEventDteJobStatus(
  jobId: string,
): Promise<EventDteAutoLinkJobStatus> {
  const response = await apiClient.get<{ data: EventDteAutoLinkJobStatus; status: "success" }>(
    `/api/dte-analytics/event-links/jobs/${jobId}`,
    { responseSchema: EventDteAutoLinkAllPeriodsJobStatusResponseSchema },
  );
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
