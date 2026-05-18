/**
 * Calendar oRPC Module
 *
 * Provides 13 endpoints for calendar event classification, synchronization, and analytics.
 * All endpoints use Zenstack v3 ORM (NOT Prisma) for database access.
 *
 * ARCHITECTURE:
 * 1. Frontend → POST /api/orpc/calendar/rpc/events/classify
 *                  ↓ (SuperJSON handles Date/BigInt serialization)
 * 2. SuperJSONRPCHandler → unmarshals JSON to strongly-typed input
 *                          validates with Zod schema
 *                  ↓
 * 3. Permission middleware checks via hasPermission()
 *                  ↓
 * 4. Handler calls service layer (calendar.ts, clinical-series.ts, etc)
 *                  ↓
 * 5. Service uses db/authDb from @finanzas/db (Zenstack v3 ORM)
 *                  ↓
 * 6. Database returns typed results (Event[], CalendarSyncLog, etc)
 *                  ↓
 * 7. SuperJSONRPCHandler → serializes output with SuperJSON
 *                          adds OpenAPI envelope
 *                  ↓
 * 8. Frontend ← Response with full type safety
 *
 * CRITICAL: This module uses Zenstack v3 ORM, NOT Prisma.
 * - Import from @finanzas/db, NOT @prisma/client
 * - Models generated from zenstack/schema.zmodel, NOT prisma.schema
 * - Access control baked into schema via @allow/@deny
 *
 * For detailed architecture, see: docs/ORPC_ZENSTACK_ARCHITECTURE.md
 */

import { db } from "@finanzas/db";
import {
  calendarClassificationOptionsSchema,
  calendarDailySchema as contractCalendarDailySchema,
  calendarJobStateSchema,
  calendarJobStatusInputSchema as contractCalendarJobStatusInputSchema,
  calendarQueryInputSchema as contractCalendarQueryInputSchema,
  calendarRebuildClinicalSeriesInputSchema as contractCalendarRebuildClinicalSeriesInputSchema,
  calendarRebuildClinicalSeriesResponseSchema as contractCalendarRebuildClinicalSeriesResponseSchema,
  calendarReclassifyJobResponseSchema,
  calendarReclassifyMissingInputSchema as contractCalendarReclassifyMissingInputSchema,
  calendarSummaryItemSchema,
  calendarSummaryWithAggregatesSchema,
  calendarSyncLogSchema,
  calendarSyncLogsInputSchema as contractCalendarSyncLogsInputSchema,
  calendarSyncResponseSchema,
  calendarTreatmentAnalyticsInputSchema,
  calendarTreatmentAnalyticsResponseSchema,
  calendarUnclassifiedEventsInputSchema as contractCalendarUnclassifiedEventsInputSchema,
  calendarUnclassifiedEventsResponseSchema,
  calendarUpdateClassificationSchema,
} from "@finanzas/orpc-contracts/calendar";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { googleCalendarConfig } from "../lib/config.ts";
import {
  getCalendarJobStatus,
  isMissingClassificationFilterKey,
  type MissingClassificationFilterKey,
  startReclassifyAllEventsJob,
  startReclassifyMissingFieldsJob,
  toTestMetadata,
} from "../lib/calendar-reclassify.ts";
import {
  type CalendarEventFilters,
  getCalendarAggregates,
  getCalendarEventsByDate,
  getTreatmentAnalytics,
  type TreatmentAnalyticsFilters,
  type TreatmentAnalyticsGranularity,
} from "../lib/google/google-calendar-queries.ts";
import { logError } from "../lib/logger.ts";
import {
  CATEGORY_CHOICES,
  isIgnoredEvent,
  PATCH_READING_CHOICES,
  TEST_SUBTYPE_CHOICES,
  TREATMENT_STAGE_CHOICES,
} from "../lib/parsers.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  type CalendarSyncLogEntryPayload,
  calendarSyncService,
  createCalendarSyncLogEntry,
  finalizeCalendarSyncLogEntry,
  listCalendarSyncLogs,
  listUnclassifiedCalendarEvents,
  loadSettings,
  updateCalendarEventClassification,
} from "../services/calendar.ts";
import { rebuildClinicalSeries } from "../services/clinical-series/rebuild.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

/**
 * oRPC Context passed to all middleware and handlers.
 * Contains the Hono context to access request/response/auth data.
 */
type CalendarORPCContext = {
  hono: HonoContext;
};

const MISSING_CLASSIFICATION_FILTERS = [
  { key: "missingCategory", label: "Sin categoria" },
  { key: "missingAmountExpected", label: "Sin monto esperado" },
  { key: "missingAmountPaid", label: "Sin monto pagado" },
  { key: "missingAttended", label: "Sin asistencia" },
  { key: "missingDosage", label: "Sin dosis" },
  { key: "missingTreatmentStage", label: "Sin etapa" },
] as const;

function buildStructuredSyncLogEntries(params: {
  errorMessage?: string;
  excluded?: number;
  inserted?: number;
  source: string;
  status: "ERROR" | "SUCCESS";
  updated?: number;
}): CalendarSyncLogEntryPayload[] {
  const entries: CalendarSyncLogEntryPayload[] = [
    {
      attributes: {
        excluded: params.excluded ?? 0,
        inserted: params.inserted ?? 0,
        updated: params.updated ?? 0,
      },
      message:
        params.status === "SUCCESS"
          ? "Calendar sync completed"
          : "Calendar sync finished with error",
      severity: params.status === "SUCCESS" ? "info" : "error",
      tags: {
        service: "calendar-sync",
        source: params.source,
      },
      timestamp: new Date(),
    },
  ];

  if (params.errorMessage) {
    entries.push({
      attributes: {
        errorMessage: params.errorMessage,
      },
      message: params.errorMessage,
      severity: "error",
      tags: {
        service: "calendar-sync",
        source: params.source,
      },
      timestamp: new Date(),
    });
  }

  return entries;
}

const calendarQueryInputSchema = z.object({
  beneficiaryRut: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  calendarIds: z.array(z.string()).optional(),
  clinicalSeriesId: z.coerce.number().int().positive().optional(),
  eventTypes: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  search: z.string().optional(),
  seriesKind: z
    .enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT", "MEDICAL_CONSULTATION"])
    .optional(),
  seriesStatus: z.enum(["PLANNED", "ACTIVE", "INACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  maxDays: z.coerce.number().positive().int().optional(),
});

function sanitizeOptionalSelectionValue(value: null | string | undefined): null | string {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function parsePositiveCappedInt(value: number, fallback: number, cap: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(value), cap);
}

function toOptionalFilter<T>(values: T[]) {
  return values.length > 0 ? values : undefined;
}

function normalizeDateRange(from: string, to: string) {
  if (from <= to) {
    return { from, to };
  }

  return { from, to: from };
}

function toDateOnlyString(value: Date | null | undefined): null | string {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function toDateTimeString(value: Date | null | undefined): null | string {
  if (!value) {
    return null;
  }

  return value.toISOString();
}

function getDefaultTreatmentAnalyticsRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function buildCalendarFiltersFromInput(input: z.infer<typeof calendarQueryInputSchema>) {
  const settings = await loadSettings();
  const configStart =
    settings["calendar.syncStart"]?.trim() || googleCalendarConfig?.syncStartDate || "2000-01-01";

  const lookaheadRaw = Number(settings["calendar.syncLookaheadDays"] ?? "365");
  const lookaheadDays = parsePositiveCappedInt(lookaheadRaw, 365, 1095);
  const defaultEnd = new Date(Date.now() + lookaheadDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const normalizedRange = normalizeDateRange(input.from ?? configStart, input.to ?? defaultEnd);

  const calendarIds = input.calendarIds ?? [];
  const eventTypes = input.eventTypes ?? [];
  const categories = input.categories ?? [];
  const search = input.search?.trim() || undefined;
  const patientName = input.patientName?.trim() || undefined;
  const patientRut = input.patientRut?.trim() || undefined;
  const beneficiaryRut = input.beneficiaryRut?.trim() || undefined;

  const defaultMaxDays = Number(settings["calendar.dailyMaxDays"] ?? "31");
  const maxDays = input.maxDays ?? parsePositiveCappedInt(defaultMaxDays, 31, 120);

  const filters: CalendarEventFilters = {
    beneficiaryRut,
    from: normalizedRange.from,
    to: normalizedRange.to,
    calendarIds: toOptionalFilter(calendarIds),
    clinicalSeriesId: input.clinicalSeriesId,
    eventTypes: toOptionalFilter(eventTypes),
    categories: toOptionalFilter(categories),
    patientName,
    patientRut,
    search,
    seriesKind: input.seriesKind,
    seriesStatus: input.seriesStatus,
  };

  return {
    filters,
    applied: {
      beneficiaryRut,
      from: normalizedRange.from,
      to: normalizedRange.to,
      calendarIds,
      clinicalSeriesId: input.clinicalSeriesId,
      eventTypes,
      categories,
      patientName,
      patientRut,
      search,
      seriesKind: input.seriesKind,
      seriesStatus: input.seriesStatus,
    },
    maxDays,
  };
}

const base = os.$context<CalendarORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

function requirePermission(
  subject: string,
  action: string,
  fallback?: { action: string; subject: string }
) {
  return authed.use(async ({ context, next }) => {
    const direct = await hasPermission(context.user, action, subject);
    const secondary = fallback
      ? await hasPermission(context.user, fallback.action, fallback.subject)
      : false;

    if (!direct && !secondary) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  });
}

const readAnyCalendar = authed.use(async ({ context, next }) => {
  const canReadSchedule = await hasPermission(context.user, "read", "CalendarSchedule");
  const canReadDaily = await hasPermission(context.user, "read", "CalendarDaily");
  const canReadEvents = await hasPermission(context.user, "read", "CalendarEvent");

  if (!canReadSchedule && !canReadDaily && !canReadEvents) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const classificationOptions = readAnyCalendar
  .route({
    method: "GET",
    path: "/classification-options",
    summary: "Lista opciones de clasificacion del calendario",
  })
  .output(calendarClassificationOptionsSchema)
  .handler(() => ({
    categories: [...CATEGORY_CHOICES],
    missingFilters: [...MISSING_CLASSIFICATION_FILTERS],
    patchReadings: [...PATCH_READING_CHOICES],
    testSubtypes: [...TEST_SUBTYPE_CHOICES],
    treatmentStages: [...TREATMENT_STAGE_CHOICES],
  }));

function toUniqueMissingFilters(values: MissingClassificationFilterKey[] | undefined) {
  if (!values?.length) {
    return undefined;
  }

  return [...new Set(values)].filter(isMissingClassificationFilterKey);
}

const listCalendars = authed
  .use(async ({ context, next }) => {
    const canReadSchedule = await hasPermission(context.user, "read", "CalendarSchedule");
    const canReadSettings = await hasPermission(context.user, "update", "CalendarSetting");
    const canReadEvents = await hasPermission(context.user, "read", "CalendarEvent");

    if (!canReadSchedule && !canReadSettings && !canReadEvents) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  })
  .route({
    method: "GET",
    path: "/calendars",
    summary: "Lista calendarios sincronizados",
  })
  .output(z.array(calendarSummaryItemSchema))
  .handler(async () => {
    const calendars = await db.calendar.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    return calendars.map((calendar) => ({
      id: calendar.id,
      googleId: calendar.googleId,
      name: calendar.name ?? "Sin nombre",
      eventCount: calendar._count.events,
      createdAt: calendar.createdAt,
      updatedAt: calendar.updatedAt,
    }));
  });

const summaryEvents = authed
  .use(async ({ context, next }) => {
    const canReadSchedule = await hasPermission(context.user, "read", "CalendarSchedule");
    const canReadHeatmap = await hasPermission(context.user, "read", "CalendarHeatmap");
    const canReadEvents = await hasPermission(context.user, "read", "CalendarEvent");

    if (!canReadSchedule && !canReadHeatmap && !canReadEvents) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  })
  .route({
    method: "GET",
    path: "/events/summary",
    summary: "Resumen agregado de eventos calendario",
  })
  .input(contractCalendarQueryInputSchema)
  .output(calendarSummaryWithAggregatesSchema)
  .handler(async ({ input }) => {
    const { filters, applied } = await buildCalendarFiltersFromInput(input);
    const aggregates = await getCalendarAggregates(filters);

    return {
      filters: applied,
      totals: aggregates.totals,
      aggregates: aggregates.aggregates,
      available: aggregates.available,
    };
  });

const dailyEvents = authed
  .use(async ({ context, next }) => {
    const canReadDaily = await hasPermission(context.user, "read", "CalendarDaily");
    const canReadEvents = await hasPermission(context.user, "read", "CalendarEvent");

    if (!canReadDaily && !canReadEvents) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  })
  .route({
    method: "GET",
    path: "/events/daily",
    summary: "Eventos agrupados por dia",
  })
  .input(contractCalendarQueryInputSchema)
  .output(contractCalendarDailySchema)
  .handler(async ({ input }) => {
    const { filters, applied, maxDays } = await buildCalendarFiltersFromInput(input);
    const events = await getCalendarEventsByDate(filters, { maxDays });

    return {
      filters: {
        ...applied,
        maxDays,
      },
      totals: events.totals,
      days: events.days,
    };
  });

const treatmentAnalytics = requirePermission("CalendarEvent", "read")
  .route({
    method: "GET",
    path: "/events/treatment-analytics",
    summary: "Analytics de tratamientos subcutaneos",
  })
  .input(calendarTreatmentAnalyticsInputSchema)
  .output(calendarTreatmentAnalyticsResponseSchema)
  .handler(async ({ input }) => {
    const defaults = getDefaultTreatmentAnalyticsRange();
    const filters: TreatmentAnalyticsFilters = {
      beneficiaryRut: input.beneficiaryRut?.trim() || undefined,
      from: input.from ?? defaults.from,
      to: input.to ?? defaults.to,
      calendarIds: toOptionalFilter(input.calendarIds ?? []),
      clinicalSeriesId: input.clinicalSeriesId,
      patientRut: input.patientRut?.trim() || undefined,
      seriesKind: input.seriesKind,
      seriesStatus: input.seriesStatus,
    };

    const granularity = (input.granularity ?? "all") as TreatmentAnalyticsGranularity;
    const data = await getTreatmentAnalytics(filters, { granularity });

    return {
      data,
      filters,
    };
  });

const classifyEvent = requirePermission("CalendarEvent", "update")
  .route({
    method: "POST",
    path: "/events/classify",
    successStatus: 200,
    summary: "Actualiza clasificacion manual de un evento",
  })
  .input(calendarUpdateClassificationSchema)
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input }) => {
    await updateCalendarEventClassification(input.calendarId, input.eventId, {
      clinicalSeriesId: input.clinicalSeriesId ?? undefined,
      category: sanitizeOptionalSelectionValue(input.category),
      amountExpected: input.amountExpected ?? null,
      amountPaid: input.amountPaid ?? null,
      attended: input.attended ?? null,
      seriesStageKind: input.seriesStageKind ?? null,
      seriesStageLabel: sanitizeOptionalSelectionValue(input.seriesStageLabel),
      seriesStageNumber: input.seriesStageNumber ?? null,
      dosageValue: input.dosageValue ?? null,
      dosageUnit: sanitizeOptionalSelectionValue(input.dosageUnit),
      treatmentStage: sanitizeOptionalSelectionValue(input.treatmentStage),
      controlIncluded: input.controlIncluded ?? null,
      isDomicilio: input.isDomicilio ?? null,
      testMetadata: input.testMetadata ?? null,
    });

    return { ok: true as const };
  });

const syncCalendarEvents = authed
  .use(async ({ context, next }) => {
    const canSync = await hasPermission(context.user, "update", "CalendarSetting");
    const canManageEvents = await hasPermission(context.user, "update", "CalendarEvent");

    if (!canSync && !canManageEvents) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  })
  .route({
    method: "POST",
    path: "/events/sync",
    successStatus: 202,
    summary: "Inicia sincronizacion manual en segundo plano",
  })
  .output(calendarSyncResponseSchema)
  .handler(async ({ context }) => {
    const logId = await createCalendarSyncLogEntry({
      triggerSource: "manual",
      triggerUserId: context.user.id,
      triggerLabel: context.user.email,
    });

    calendarSyncService
      .syncAll()
      .then(async (result) => {
        await finalizeCalendarSyncLogEntry(logId, {
          status: "SUCCESS",
          fetchedAt: new Date(),
          inserted: result.inserted,
          updated: result.updated,
          skipped: 0,
          excluded: result.deleted,
          changeDetails: {
            inserted: result.details.inserted,
            updated: result.details.updated,
            excluded: result.details.deleted,
          },
          logEntries: buildStructuredSyncLogEntries({
            excluded: result.deleted,
            inserted: result.inserted,
            source: "manual",
            status: "SUCCESS",
            updated: result.updated,
          }),
        });
      })
      .catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        await finalizeCalendarSyncLogEntry(logId, {
          status: "ERROR",
          errorMessage: message,
          logEntries: buildStructuredSyncLogEntries({
            errorMessage: message,
            source: "manual",
            status: "ERROR",
          }),
        });
      });

    return {
      status: "accepted" as const,
      message: "Sincronizacion iniciada en segundo plano",
      logId,
    };
  });

const listSyncLogs = authed
  .use(async ({ context, next }) => {
    const canReadLogs = await hasPermission(context.user, "read", "CalendarSyncLog");
    const canReadSettings = await hasPermission(context.user, "update", "CalendarSetting");

    if (!canReadLogs && !canReadSettings) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  })
  .route({
    method: "GET",
    path: "/events/sync/logs",
    summary: "Lista logs recientes de sincronizacion",
  })
  .input(contractCalendarSyncLogsInputSchema)
  .output(z.array(calendarSyncLogSchema))
  .handler(async ({ input }) => {
    const logs = await listCalendarSyncLogs(input.limit ?? 50);

    return logs.map((log) => ({
      id: Number(log.id),
      triggerSource: log.triggerSource,
      triggerUserId: log.triggerUserId != null ? Number(log.triggerUserId) : null,
      triggerLabel: log.triggerLabel ?? null,
      status: log.status,
      startedAt: log.startedAt ?? null,
      finishedAt: log.endedAt ?? null,
      fetchedAt: log.fetchedAt ?? null,
      inserted: Number(log.inserted ?? 0),
      updated: Number(log.updated ?? 0),
      skipped: Number(log.skipped ?? 0),
      excluded: Number(log.excluded ?? 0),
      errorMessage: log.errorMessage ?? null,
      changeDetails: log.changeDetails ?? null,
      logEntries: log.logEntries.map((entry: (typeof log.logEntries)[number]) => ({
        message: entry.message,
        severity: entry.severity,
        attributes: entry.attributes,
        tags: entry.tags,
        timestamp: entry.timestamp,
      })),
    }));
  });

const rebuildClinicalSeriesRoute = requirePermission("CalendarEvent", "update")
  .route({
    method: "POST",
    path: "/series/rebuild",
    summary: "Reagrupar series clinicas para tests y tratamientos subcutaneos",
  })
  .input(contractCalendarRebuildClinicalSeriesInputSchema)
  .output(contractCalendarRebuildClinicalSeriesResponseSchema)
  .handler(async ({ input }) => rebuildClinicalSeries(input));

const unclassifiedEvents = requirePermission("CalendarEvent", "update")
  .route({
    method: "GET",
    path: "/events/unclassified",
    summary: "Lista eventos con clasificacion incompleta",
  })
  .input(contractCalendarUnclassifiedEventsInputSchema)
  .output(calendarUnclassifiedEventsResponseSchema)
  .handler(async ({ input }) => {
    const selectedMissingFilters = new Set<MissingClassificationFilterKey>(
      toUniqueMissingFilters(input.missing)
    );

    const mappedFilters = Object.fromEntries(
      [
        ["missingAmountExpected", "amountExpected"],
        ["missingAmountPaid", "amountPaid"],
        ["missingAttended", "attended"],
        ["missingCategory", "category"],
        ["missingDosage", "dosageValue"],
        ["missingTreatmentStage", "treatmentStage"],
      ].map(([queryKey, serviceKey]) => [
        serviceKey,
        selectedMissingFilters.has(queryKey as MissingClassificationFilterKey),
      ])
    ) as {
      amountExpected: boolean;
      amountPaid: boolean;
      attended: boolean;
      category: boolean;
      dosageValue: boolean;
      treatmentStage: boolean;
    };

    const filters = {
      ...mappedFilters,
      filterMode: input.filterMode ?? "OR",
    };

    const { events: rows, totalCount } = await listUnclassifiedCalendarEvents(
      input.limit ?? 50,
      input.offset ?? 0,
      selectedMissingFilters.size > 0 ? filters : undefined
    );

    const filteredRows = rows.filter((row) => !isIgnoredEvent(row.summary));

    return {
      totalCount,
      events: filteredRows.map((row) => ({
        calendarId: row.calendar.googleId,
        eventId: row.externalEventId,
        status: row.eventStatus ?? null,
        eventType: row.eventType ?? null,
        summary: row.summary ?? null,
        description: row.description ?? null,
        startDate: toDateOnlyString(row.startDate),
        startDateTime: toDateTimeString(row.startDateTime),
        endDate: toDateOnlyString(row.endDate),
        endDateTime: toDateTimeString(row.endDateTime),
        category: row.category ?? null,
        clinicalSeriesId: row.clinicalSeriesId ?? null,
        amountExpected: row.amountExpected ?? null,
        amountPaid: row.amountPaid ?? null,
        attended: row.attended ?? null,
        dosageValue: row.dosageValue ?? null,
        dosageUnit: row.dosageUnit ?? null,
        seriesStageKind: row.seriesStageKind ?? null,
        seriesStageLabel: row.seriesStageLabel ?? null,
        seriesStageNumber: row.seriesStageNumber ?? null,
        testMetadata: toTestMetadata(row.testMetadata),
        treatmentStage: row.treatmentStage ?? null,
      })),
    };
  });

const reclassifyEvents = requirePermission("CalendarEvent", "update")
  .route({
    method: "POST",
    path: "/events/reclassify",
    successStatus: 202,
    summary: "Inicia reclasificacion de eventos pendientes",
  })
  .input(contractCalendarReclassifyMissingInputSchema)
  .output(calendarReclassifyJobResponseSchema)
  .handler(async ({ input }) => {
    const result = await startReclassifyMissingFieldsJob({
      filterMode: input.filterMode,
      missing: toUniqueMissingFilters(input.missing),
    });

    return {
      status: "accepted" as const,
      ...result,
    };
  });

const reclassifyAllEvents = requirePermission("CalendarEvent", "update")
  .route({
    method: "POST",
    path: "/events/reclassify-all",
    successStatus: 202,
    summary: "Inicia reclasificacion completa de eventos",
  })
  .output(calendarReclassifyJobResponseSchema)
  .handler(async () => {
    const result = await startReclassifyAllEventsJob();

    return {
      status: "accepted" as const,
      ...result,
    };
  });

const jobStatus = requirePermission("CalendarEvent", "update")
  .route({
    method: "GET",
    path: "/events/job/{jobId}",
    summary: "Consulta estado de job de calendario",
  })
  .input(contractCalendarJobStatusInputSchema)
  .output(z.object({ job: calendarJobStateSchema }))
  .handler(async ({ input }) => {
    const job = await getCalendarJobStatus(input.jobId);

    if (!job) {
      throw new ORPCError("NOT_FOUND", { message: "Job not found or expired" });
    }

    return {
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        total: job.total,
        message: job.message,
        result: job.result,
        error: job.error,
      },
    };
  });

const calendarORPCRouterBase = {
  dailyEvents,
  classificationOptions,
  calendars: listCalendars,
  classifyEvent,
  jobStatus,
  reclassifyAllEvents,
  reclassifyEvents,
  rebuildClinicalSeries: rebuildClinicalSeriesRoute,
  summaryEvents,
  syncEvents: syncCalendarEvents,
  syncLogs: listSyncLogs,
  treatmentAnalytics,
  unclassifiedEvents,
};

export const calendarORPCRouter = base
  .prefix("/api/orpc/calendar")
  .tag("Calendar")
  .router(calendarORPCRouterBase);

export const calendarORPCHandler = new SuperJSONRPCHandler(calendarORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("calendar.orpc.rpc", error, {});
    }),
  ],
});

export const calendarOpenAPIHandler = new OpenAPIHandler(calendarORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Calendar API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Calendar API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("calendar.orpc.openapi", error, {});
    }),
  ],
});

export type CalendarORPCRouter = typeof calendarORPCRouter;
