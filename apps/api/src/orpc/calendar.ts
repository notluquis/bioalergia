import type { CalendarSyncLog } from "@finanzas/db";
import { db } from "@finanzas/db";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import {
  CATEGORY_CHOICES,
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

function sanitizeOptionalSelectionValue(value: null | string | undefined): null | string {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
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

const calendarORPCRouterBase = {
  classificationOptions,
  calendars: listCalendars,
  classifyEvent,
  syncEvents: syncCalendarEvents,
  syncLogs: listSyncLogs,
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
