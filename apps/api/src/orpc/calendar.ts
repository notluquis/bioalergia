import type { CalendarSyncLog } from "@finanzas/db";
import { db } from "@finanzas/db";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { googleCalendarConfig } from "../config";
import {
  getCalendarJobStatus,
  isMissingClassificationFilterKey,
  type MissingClassificationFilterKey,
  startReclassifyAllEventsJob,
  startReclassifyMissingFieldsJob,
  toTestMetadata,
} from "../lib/calendar-reclassify";
import {
  type CalendarEventFilters,
  getCalendarAggregates,
  getCalendarEventsByDate,
} from "../lib/google/google-calendar-queries";
import { logError } from "../lib/logger";
import {
  CATEGORY_CHOICES,
  isIgnoredEvent,
  PATCH_READING_CHOICES,
  TEST_SUBTYPE_CHOICES,
  TREATMENT_STAGE_CHOICES,
} from "../lib/parsers";
import { updateClassificationSchema } from "../lib/schemas";
import { configureSuperjson } from "../lib/superjson-config";
import {
  calendarSyncService,
  createCalendarSyncLogEntry,
  finalizeCalendarSyncLogEntry,
  listCalendarSyncLogs,
  listUnclassifiedCalendarEvents,
  loadSettings,
  updateCalendarEventClassification,
} from "../services/calendar";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

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

const syncLogSchema = z.object({
  id: z.number().int(),
  triggerSource: z.string().nullable(),
  triggerUserId: z.number().int().nullable(),
  triggerLabel: z.string().nullable(),
  status: z.string(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  fetchedAt: z.date().nullable(),
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  excluded: z.number().int(),
  errorMessage: z.string().nullable(),
  changeDetails: z.unknown().nullable(),
});

const calendarSummarySchema = z.object({
  id: z.number().int(),
  googleId: z.string(),
  name: z.string(),
  eventCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const classificationOptionsSchema = z.object({
  categories: z.array(z.string()),
  missingFilters: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
    }),
  ),
  patchReadings: z.array(z.string()),
  testSubtypes: z.array(z.string()),
  treatmentStages: z.array(z.string()),
});

const calendarQueryInputSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  calendarIds: z.array(z.string()).optional(),
  eventTypes: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  search: z.string().optional(),
  maxDays: z.coerce.number().positive().int().optional(),
});

const testMetadataSchema = z.object({
  firstReading: z.boolean(),
  patchTest: z.boolean(),
  secondReading: z.boolean(),
  skinTest: z.boolean(),
  thirdReading: z.boolean(),
});

const calendarEventDetailSchema = z.object({
  amountExpected: z.number().nullable().optional(),
  amountPaid: z.number().nullable().optional(),
  attended: z.boolean().nullable().optional(),
  calendarId: z.string(),
  category: z.string().nullable().optional(),
  clinicalSeriesId: z.number().nullable().optional(),
  colorId: z.string().nullable(),
  controlIncluded: z.boolean().nullable().optional(),
  description: z.string().nullable(),
  dosageValue: z.number().nullable().optional(),
  dosageUnit: z.string().nullable().optional(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable().optional(),
  seriesStageLabel: z.string().nullable().optional(),
  seriesStageNumber: z.number().nullable().optional(),
  testMetadata: testMetadataSchema.nullable().optional(),
  endDate: z.string().nullable(),
  endDateTime: z.string().nullable(),
  endTimeZone: z.string().nullable(),
  eventCreatedAt: z.string().nullable(),
  eventDate: z.string(),
  eventDateTime: z.string().nullable(),
  eventId: z.string(),
  eventType: z.string().nullable(),
  eventUpdatedAt: z.string().nullable(),
  hangoutLink: z.string().nullable(),
  isDomicilio: z.boolean().nullable().optional(),
  location: z.string().nullable(),
  rawEvent: z.unknown(),
  startDate: z.string().nullable(),
  startDateTime: z.string().nullable(),
  startTimeZone: z.string().nullable(),
  status: z.string().nullable(),
  summary: z.string().nullable(),
  transparency: z.string().nullable(),
  treatmentStage: z.string().nullable().optional(),
  visibility: z.string().nullable(),
});

const calendarDayEventsSchema = z.object({
  amountExpected: z.number(),
  amountPaid: z.number(),
  date: z.string(),
  events: z.array(calendarEventDetailSchema),
  total: z.number(),
});

const calendarFiltersOutputSchema = z.object({
  calendarIds: z.array(z.string()),
  categories: z.array(z.string()),
  eventTypes: z.array(z.string()).optional(),
  from: z.string(),
  maxDays: z.number(),
  search: z.string().optional(),
  to: z.string(),
});

const calendarTotalsSchema = z.object({
  amountExpected: z.number(),
  amountPaid: z.number(),
  days: z.number(),
  events: z.number(),
});

const calendarDailySchema = z.object({
  days: z.array(calendarDayEventsSchema),
  filters: calendarFiltersOutputSchema,
  totals: calendarTotalsSchema,
});

const calendarSummarySchemaWithAggregates = z.object({
  aggregates: z.object({
    byDate: z.array(
      z.object({
        amountExpected: z.number(),
        amountPaid: z.number(),
        date: z.string(),
        total: z.number(),
      }),
    ),
    byDateType: z.array(
      z.object({
        date: z.string(),
        eventType: z.string().nullable(),
        total: z.number(),
      }),
    ),
    byMonth: z.array(
      z.object({
        amountExpected: z.number(),
        amountPaid: z.number(),
        month: z.number(),
        total: z.number(),
        year: z.number(),
      }),
    ),
    byWeek: z.array(
      z.object({
        amountExpected: z.number(),
        amountPaid: z.number(),
        isoWeek: z.number(),
        isoYear: z.number(),
        total: z.number(),
      }),
    ),
    byWeekday: z.array(
      z.object({
        amountExpected: z.number(),
        amountPaid: z.number(),
        total: z.number(),
        weekday: z.number(),
      }),
    ),
    byYear: z.array(
      z.object({
        amountExpected: z.number(),
        amountPaid: z.number(),
        total: z.number(),
        year: z.number(),
      }),
    ),
  }),
  available: z.object({
    calendars: z.array(
      z.object({
        calendarId: z.string(),
        total: z.number(),
      }),
    ),
    eventTypes: z.array(
      z.object({
        eventType: z.string().nullable(),
        total: z.number(),
      }),
    ),
    categories: z.array(
      z.object({
        category: z.string().nullable(),
        total: z.number(),
      }),
    ),
  }),
  filters: calendarFiltersOutputSchema.omit({ maxDays: true }),
  totals: calendarTotalsSchema.extend({
    maxEventCount: z.number().optional(),
  }),
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

  const defaultMaxDays = Number(settings["calendar.dailyMaxDays"] ?? "31");
  const maxDays = input.maxDays ?? parsePositiveCappedInt(defaultMaxDays, 31, 120);

  const filters: CalendarEventFilters = {
    from: normalizedRange.from,
    to: normalizedRange.to,
    calendarIds: toOptionalFilter(calendarIds),
    eventTypes: toOptionalFilter(eventTypes),
    categories: toOptionalFilter(categories),
    search,
  };

  return {
    filters,
    applied: {
      from: normalizedRange.from,
      to: normalizedRange.to,
      calendarIds,
      eventTypes,
      categories,
      search,
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
  fallback?: { action: string; subject: string },
) {
  return authed.use(async ({ context, next }) => {
    const direct = await hasPermission(context.user.id, action, subject);
    const secondary = fallback
      ? await hasPermission(context.user.id, fallback.action, fallback.subject)
      : false;

    if (!direct && !secondary) {
      throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    }

    return next();
  });
}

const readAnyCalendar = authed.use(async ({ context, next }) => {
  const canReadSchedule = await hasPermission(context.user.id, "read", "CalendarSchedule");
  const canReadDaily = await hasPermission(context.user.id, "read", "CalendarDaily");
  const canReadEvents = await hasPermission(context.user.id, "read", "CalendarEvent");

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
  .output(classificationOptionsSchema)
  .handler(() => ({
    categories: [...CATEGORY_CHOICES],
    missingFilters: [...MISSING_CLASSIFICATION_FILTERS],
    patchReadings: [...PATCH_READING_CHOICES],
    testSubtypes: [...TEST_SUBTYPE_CHOICES],
    treatmentStages: [...TREATMENT_STAGE_CHOICES],
  }));

const syncLogsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
});

const missingClassificationFilterKeySchema = z.enum([
  "missingCategory",
  "missingAmountExpected",
  "missingAmountPaid",
  "missingAttended",
  "missingDosage",
  "missingTreatmentStage",
]);

const unclassifiedEventsInputSchema = z.object({
  filterMode: z.enum(["AND", "OR"]).default("OR").optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50).optional(),
  missing: z.array(missingClassificationFilterKeySchema).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

const reclassifyMissingInputSchema = z.object({
  filterMode: z.enum(["AND", "OR"]).optional(),
  missing: z.array(missingClassificationFilterKeySchema).optional(),
});

const reclassifyJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal("accepted"),
  totalEvents: z.number(),
});

const jobStatusInputSchema = z.object({
  jobId: z.string().min(1),
});

const jobStateSchema = z.object({
  error: z.string().nullable(),
  id: z.string(),
  message: z.string(),
  progress: z.number(),
  result: z.unknown(),
  status: z.enum(["completed", "failed", "pending", "running"]),
  total: z.number(),
  type: z.string(),
});

const unclassifiedCalendarEventSchema = z.object({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  attended: z.boolean().nullable(),
  calendarId: z.string(),
  category: z.string().nullable(),
  clinicalSeriesId: z.number().nullable().optional(),
  description: z.string().nullable(),
  dosageValue: z.number().nullable(),
  dosageUnit: z.string().nullable(),
  endDate: z.string().nullable(),
  endDateTime: z.string().nullable(),
  eventId: z.string(),
  eventType: z.string().nullable(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable().optional(),
  seriesStageLabel: z.string().nullable().optional(),
  seriesStageNumber: z.number().nullable().optional(),
  startDate: z.string().nullable(),
  startDateTime: z.string().nullable(),
  status: z.string().nullable(),
  summary: z.string().nullable(),
  testMetadata: testMetadataSchema.nullable(),
  treatmentStage: z.string().nullable(),
});

const unclassifiedEventsResponseSchema = z.object({
  events: z.array(unclassifiedCalendarEventSchema),
  totalCount: z.number(),
});

function toUniqueMissingFilters(values: MissingClassificationFilterKey[] | undefined) {
  if (!values?.length) {
    return undefined;
  }

  return [...new Set(values)].filter(isMissingClassificationFilterKey);
}

const listCalendars = authed
  .use(async ({ context, next }) => {
    const canReadSchedule = await hasPermission(context.user.id, "read", "CalendarSchedule");
    const canReadSettings = await hasPermission(context.user.id, "update", "CalendarSetting");
    const canReadEvents = await hasPermission(context.user.id, "read", "CalendarEvent");

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
  .output(z.array(calendarSummarySchema))
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
    const canReadSchedule = await hasPermission(context.user.id, "read", "CalendarSchedule");
    const canReadHeatmap = await hasPermission(context.user.id, "read", "CalendarHeatmap");
    const canReadEvents = await hasPermission(context.user.id, "read", "CalendarEvent");

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
  .input(calendarQueryInputSchema)
  .output(calendarSummarySchemaWithAggregates)
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
    const canReadDaily = await hasPermission(context.user.id, "read", "CalendarDaily");
    const canReadEvents = await hasPermission(context.user.id, "read", "CalendarEvent");

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
  .input(calendarQueryInputSchema)
  .output(calendarDailySchema)
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

const classifyEvent = requirePermission("CalendarEvent", "update")
  .route({
    method: "POST",
    path: "/events/classify",
    successStatus: 200,
    summary: "Actualiza clasificacion manual de un evento",
  })
  .input(updateClassificationSchema)
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
    const canSync = await hasPermission(context.user.id, "update", "CalendarSetting");
    const canManageEvents = await hasPermission(context.user.id, "update", "CalendarEvent");

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
  .output(
    z.object({
      status: z.literal("accepted"),
      message: z.string(),
      logId: z.number().int(),
    }),
  )
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
        });
      })
      .catch(async (error) => {
        await finalizeCalendarSyncLogEntry(logId, {
          status: "ERROR",
          errorMessage: error instanceof Error ? error.message : String(error),
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
    const canReadLogs = await hasPermission(context.user.id, "read", "CalendarSyncLog");
    const canReadSettings = await hasPermission(context.user.id, "update", "CalendarSetting");

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
  .input(syncLogsInputSchema)
  .output(z.array(syncLogSchema))
  .handler(async ({ input }) => {
    const logs = await listCalendarSyncLogs(input.limit ?? 50);

    return logs.map((log: CalendarSyncLog) => ({
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
    }));
  });

const unclassifiedEvents = requirePermission("CalendarEvent", "update")
  .route({
    method: "GET",
    path: "/events/unclassified",
    summary: "Lista eventos con clasificacion incompleta",
  })
  .input(unclassifiedEventsInputSchema)
  .output(unclassifiedEventsResponseSchema)
  .handler(async ({ input }) => {
    const selectedMissingFilters = new Set<MissingClassificationFilterKey>(
      toUniqueMissingFilters(input.missing),
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
      ]),
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
      selectedMissingFilters.size > 0 ? filters : undefined,
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
        startDate: row.startDate ?? null,
        startDateTime: row.startDateTime ?? null,
        endDate: row.endDate ?? null,
        endDateTime: row.endDateTime ?? null,
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
  .input(reclassifyMissingInputSchema)
  .output(reclassifyJobResponseSchema)
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
  .output(reclassifyJobResponseSchema)
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
  .input(jobStatusInputSchema)
  .output(z.object({ job: jobStateSchema }))
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
  summaryEvents,
  syncEvents: syncCalendarEvents,
  syncLogs: listSyncLogs,
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
  interceptors: [
    onError((error) => {
      logError("calendar.orpc.openapi", error, {});
    }),
  ],
});

const calendarOpenAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

let openAPISpecPromise: Promise<unknown> | null = null;

export async function getCalendarOpenAPISpec() {
  if (!openAPISpecPromise) {
    openAPISpecPromise = calendarOpenAPIGenerator.generate(calendarORPCRouter, {
      info: {
        title: "Bioalergia Calendar API",
        version: "1.0.0",
      },
    });
  }

  return openAPISpecPromise;
}

export type CalendarORPCRouter = typeof calendarORPCRouter;
