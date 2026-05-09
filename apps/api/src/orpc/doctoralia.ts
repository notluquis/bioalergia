import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import {
  getDoctoraliaImapListenerStatus,
  runDoctoraliaImapIngestOnce,
} from "../lib/doctoralia/imap-idle.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { listDoctoraliaSyncLogs } from "../services/doctoralia.ts";
import {
  DOCTORALIA_BACKFILL_MIN_DATE,
  getDoctoraliaBackfillStatus,
  isDoctoraliaBackfillRunning,
  requestDoctoraliaBackfillCancel,
  startDoctoraliaBackfill,
} from "../services/doctoralia-backfill.ts";
import {
  clearDoctoraliaScraperForceRun,
  getDoctoraliaScraperForceRunStatus,
  requestDoctoraliaScraperForceRun,
} from "../services/doctoralia-scraper-run-control.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type DoctoraliaORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DoctoraliaORPCContext>();

const calendarAppointmentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(z.number().int().positive()).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const emailNotificationsCalendarQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const calendarMergedQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const calendarMergedResponseSchema = z.object({
  data: z.object({
    entries: z.array(z.unknown()),
    orphanEmails: z.array(z.unknown()),
    counts: z.object({
      appointments: z.number(),
      matchedEmails: z.number(),
      orphanEmails: z.number(),
    }),
  }),
  status: z.literal("ok"),
});

const emailNotificationsListQuerySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

const emailNotificationsCalendarResponseSchema = z.object({
  data: z.object({
    count: z.number(),
    notifications: z.array(z.unknown()),
  }),
  status: z.literal("ok"),
});

const emailNotificationsOverviewResponseSchema = z.object({
  data: z.object({
    imapHostConfigured: z.boolean(),
    imapMailbox: z.string(),
    imapPassConfigured: z.boolean(),
    imapReady: z.boolean(),
    imapUserConfigured: z.boolean(),
    listener: z.object({
      enabled: z.boolean(),
      host: z.string().nullable(),
      lastConnectedAt: z.string().nullable(),
      lastErrorAt: z.string().nullable(),
      lastErrorMessage: z.string().nullable(),
      lastProcessedAt: z.string().nullable(),
      lastStartedAt: z.string().nullable(),
      mailbox: z.string().nullable(),
      reconnectDelayMs: z.number().nullable(),
      state: z.enum(["stopped", "missing_config", "connecting", "connected", "error"]),
      user: z.string().nullable(),
    }),
    senderFilter: z.string(),
  }),
  status: z.literal("ok"),
});

const emailNotificationsListResponseSchema = z.object({
  data: z.object({
    notifications: z.array(z.unknown()),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

const emailNotificationsStatsResponseSchema = z.object({
  data: z.object({
    bookings: z.number(),
    cancellations: z.number(),
    modifications: z.number(),
    total: z.number(),
    withPhone: z.number(),
  }),
  status: z.literal("ok"),
});

const emailNotificationsMonthlySummaryQuerySchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
});

const emailNotificationsMonthlySummaryResponseSchema = z.object({
  data: z.array(
    z.strictObject({
      period: z.string().regex(/^\d{4}-\d{2}$/),
      bookings: z.number().int(),
      modifications: z.number().int(),
      cancellations: z.number().int(),
      total: z.number().int(),
      cancellationRate: z.number(),
    }),
  ),
  status: z.literal("ok"),
});

const calendarAppointmentsMonthlySummaryQuerySchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
});

const calendarAppointmentsMonthlySummaryResponseSchema = z.object({
  data: z.array(
    z.strictObject({
      period: z.string().regex(/^\d{4}-\d{2}$/),
      programmed: z.number().int(),
      cancelled: z.number().int(),
      attended: z.number().int(),
      total: z.number().int(),
      cancellationRate: z.number(),
    }),
  ),
  status: z.literal("ok"),
});

const emailNotificationsIngestResponseSchema = z.object({
  data: z.object({
    alreadyProcessed: z.number(),
    checked: z.number(),
    failed: z.number(),
    saved: z.number(),
    skipped: z.number(),
  }),
  message: z.string(),
  status: z.enum(["ok", "error"]),
});

const emailNotificationsPatientsQuerySchema = z.object({
  search: z.string().optional(),
});

const emailNotificationsPatientsResponseSchema = z.object({
  data: z.object({
    patients: z.array(z.unknown()),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

const emailNotificationsPatientHistoryQuerySchema = z.object({
  patientName: z.string(),
  patientPhone: z.string().nullable().optional(),
});

const emailNotificationsPatientHistoryResponseSchema = z.object({
  data: z.object({
    notifications: z.array(z.unknown()),
  }),
  status: z.literal("ok"),
});

const syncLogsResponseSchema = z.object({
  logs: z.array(
    z.object({
      id: z.number().int(),
      syncType: z.enum(["CALENDAR", "EMAIL"]),
      triggerSource: z.string().nullable(),
      triggerUserId: z.number().int().nullable(),
      status: z.string(),
      startedAt: z.coerce.date(),
      endedAt: z.coerce.date().nullable(),
      counts: z.record(z.string(), z.number()),
      errorMessage: z.string().nullable(),
    }),
  ),
  status: z.literal("ok"),
});

const calendarAppointmentsSchema = z.object({
  data: z.object({
    appointments: z.array(z.unknown()),
    count: z.number(),
    filters: z.object({
      from: z.string(),
      scheduleIds: z.array(z.number()),
      to: z.string(),
    }),
  }),
  status: z.literal("ok"),
});

const calendarImportCountsSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});

const calendarImportInputSchema = z.object({
  entries: z
    .array(
      z.object({
        ts: z.string().optional(),
        src: z.string().optional(),
        data: z.object({
          schedules: z.record(z.string(), z.any()),
          appointments: z.array(z.any()),
          workperiods: z.array(z.any()),
        }),
      }),
    )
    .min(1)
    .max(50),
});

const calendarImportResponseSchema = z.object({
  data: z.object({
    entriesProcessed: z.number().int(),
    summary: z.object({
      schedules: calendarImportCountsSchema,
      appointments: calendarImportCountsSchema,
      workPeriods: calendarImportCountsSchema,
    }),
    errors: z.array(z.string()),
  }),
  status: z.literal("ok"),
});

const backfillBucketCountsSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});

const calendarBackfillStatusDataSchema = z.object({
  running: z.boolean(),
  cancelRequested: z.boolean(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  targetEndDate: z.string().nullable(),
  triggeredByUserId: z.number().int().nullable(),
  weeksTotal: z.number().int(),
  weeksProcessed: z.number().int(),
  weeksFailed: z.number().int(),
  schedules: backfillBucketCountsSchema,
  appointments: backfillBucketCountsSchema,
  workPeriods: backfillBucketCountsSchema,
  currentWindow: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .nullable(),
  lastError: z.string().nullable(),
  minEndDate: z.string(),
});

const calendarBackfillStatusResponseSchema = z.object({
  data: calendarBackfillStatusDataSchema,
  status: z.literal("ok"),
});

const calendarBackfillStartInputSchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const scraperCookiesStatusSchema = z.object({
  data: z.object({
    exists: z.boolean(),
    label: z.string().nullable(),
    count: z.number().int(),
    updatedAt: z.coerce.date().nullable(),
    lastUsedAt: z.coerce.date().nullable(),
    updatedByUserId: z.number().int().nullable(),
    updatedByEmail: z.string().nullable(),
  }),
  status: z.literal("ok"),
});

const updateScraperCookiesInputSchema = z.object({
  label: z.string().trim().min(1).max(64).optional(),
  cookieHeader: z.string().trim().min(1),
});

const updateScraperCookiesResponseSchema = z.object({
  data: z.object({
    label: z.string(),
    count: z.number().int(),
    updatedAt: z.coerce.date(),
  }),
  status: z.literal("ok"),
});

const scraperRunOverrideStatusSchema = z.object({
  data: z.object({
    active: z.boolean(),
    expiresAt: z.coerce.date().nullable(),
    requestedAt: z.coerce.date().nullable(),
    requestedByEmail: z.string().nullable(),
    requestedByUserId: z.number().int().nullable(),
  }),
  status: z.literal("ok"),
});

const calendarSyncNowResponseSchema = z.object({
  status: z.enum(["ok", "skip", "error"]),
  message: z.string(),
  data: z
    .object({
      alertsFetched: z.number().int(),
      pendingAlertsFetched: z.number().int(),
      appointmentsInserted: z.number().int(),
      appointmentsUpdated: z.number().int(),
    })
    .nullable(),
});

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

const canReadDoctoraliaCalendar = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "DoctoraliaCalendarAppointment");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const canManageDoctoraliaCalendar = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "DoctoraliaCalendarAppointment");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Sin permisos" });
  }
  return next();
});

const doctoraliaORPCRouterBase = {
  calendarAppointments: canReadDoctoraliaCalendar
    .route({ method: "GET", path: "/calendar/appointments" })
    .input(calendarAppointmentsQuerySchema)
    .output(calendarAppointmentsSchema)
    .handler(async ({ input }: { input: z.input<typeof calendarAppointmentsQuerySchema> }) => {
      const autoSyncEnabled = process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC === "true";
      if (autoSyncEnabled) {
        const staleThresholdMs = Number(
          process.env.DOCTORALIA_CALENDAR_APPOINTMENTS_REFRESH_MS || "120000",
        );
        const { runDoctoraliaCalendarAutoSync } = await import(
          "../lib/doctoralia/doctoralia-calendar-scheduler.ts"
        );
        const { getSetting } = await import("../services/settings.ts");
        const lastSuccessAtRaw = await getSetting("doctoralia:calendar:lastSuccessAt");
        const lastSuccessAt = lastSuccessAtRaw ? new Date(lastSuccessAtRaw).getTime() : 0;
        const shouldRefresh =
          !Number.isFinite(lastSuccessAt) ||
          lastSuccessAt <= 0 ||
          Date.now() - lastSuccessAt > staleThresholdMs;

        if (shouldRefresh) {
          void Promise.all([runDoctoraliaCalendarAutoSync({
            trigger: "read-stale",
          })]);
        }
      }

      const fromDate = new Date(`${input.from}T00:00:00.000Z`);
      const toDateExclusive = new Date(`${input.to}T23:59:59.999Z`);

      const appointments = await db.doctoraliaCalendarAppointment.findMany({
        where: {
          isBlock: false,
          ...(input.scheduleIds && input.scheduleIds.length > 0
            ? {
                schedule: {
                  externalId: {
                    in: input.scheduleIds,
                  },
                },
              }
            : {}),
          startAt: {
            gte: fromDate,
            lte: toDateExclusive,
          },
        },
        orderBy: [{ startAt: "asc" }],
        select: {
          colorSchemaId: true,
          comments: true,
          duration: true,
          endAt: true,
          eventServices: true,
          eventType: true,
          externalId: true,
          hasPatient: true,
          id: true,
          isPatientFirstAdminBooking: true,
          isPatientFirstTime: true,
          patientBirthDate: true,
          patientExternalId: true,
          patientReferenceId: true,
          schedule: {
            select: {
              displayName: true,
              externalId: true,
            },
          },
          scheduledBy: true,
          serviceColorSchemaId: true,
          serviceName: true,
          startAt: true,
          status: true,
          title: true,
        },
      });

      return {
        data: {
          appointments,
          count: appointments.length,
          filters: {
            from: input.from,
            scheduleIds: input.scheduleIds ?? [],
            to: input.to,
          },
        },
        status: "ok",
      };
    }),

  importCalendarJson: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/calendar/import-json" })
    .input(calendarImportInputSchema)
    .output(calendarImportResponseSchema)
    .handler(async ({ context, input }) => {
      const { doctoraliaCalendarSyncService } = await import(
        "../services/doctoralia-calendar.ts"
      );

      const entries = input.entries as Array<{
        ts?: string;
        src?: string;
        data: import("../lib/doctoralia/doctoralia-calendar-types.ts").DoctoraliaCalendarResponse;
      }>;

      const result = await doctoraliaCalendarSyncService.importFromJsonEntries(entries);

      logEvent("doctoralia.calendar.import.json", {
        userId: context.user.id,
        entriesProcessed: result.entriesProcessed,
        schedulesInserted: result.summary.schedules.inserted,
        schedulesUpdated: result.summary.schedules.updated,
        appointmentsInserted: result.summary.appointments.inserted,
        appointmentsUpdated: result.summary.appointments.updated,
        workPeriodsInserted: result.summary.workPeriods.inserted,
        workPeriodsUpdated: result.summary.workPeriods.updated,
        errorCount: result.errors.length,
      });

      return {
        data: result,
        status: "ok" as const,
      };
    }),

  calendarBackfillStatus: canManageDoctoraliaCalendar
    .route({ method: "GET", path: "/calendar/backfill/status" })
    .output(calendarBackfillStatusResponseSchema)
    .handler(async () => ({
      data: {
        ...getDoctoraliaBackfillStatus(),
        minEndDate: DOCTORALIA_BACKFILL_MIN_DATE,
      },
      status: "ok" as const,
    })),

  calendarBackfillStart: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/calendar/backfill/start" })
    .input(calendarBackfillStartInputSchema)
    .output(calendarBackfillStatusResponseSchema)
    .handler(async ({ context, input }) => {
      if (isDoctoraliaBackfillRunning()) {
        throw new ORPCError("CONFLICT", {
          message: "Ya hay un backfill de Doctoralia en curso.",
        });
      }

      try {
        startDoctoraliaBackfill({
          endDate: input.endDate,
          startDate: input.startDate,
          triggeredByUserId: context.user.id,
        });
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "No se pudo iniciar el backfill",
        });
      }

      logEvent("doctoralia.backfill.request", {
        userId: context.user.id,
        endDate: input.endDate,
      });

      return {
        data: {
          ...getDoctoraliaBackfillStatus(),
          minEndDate: DOCTORALIA_BACKFILL_MIN_DATE,
        },
        status: "ok" as const,
      };
    }),

  calendarBackfillCancel: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/calendar/backfill/cancel" })
    .output(calendarBackfillStatusResponseSchema)
    .handler(async ({ context }) => {
      try {
        requestDoctoraliaBackfillCancel({ requestedByUserId: context.user.id });
      } catch (error) {
        throw new ORPCError("CONFLICT", {
          message: error instanceof Error ? error.message : "No se pudo cancelar el backfill",
        });
      }

      return {
        data: {
          ...getDoctoraliaBackfillStatus(),
          minEndDate: DOCTORALIA_BACKFILL_MIN_DATE,
        },
        status: "ok" as const,
      };
    }),

  syncLogs: authed
    .route({ method: "GET", path: "/sync/logs" })
    .output(syncLogsResponseSchema)
    .handler(async () => ({
      logs: (await listDoctoraliaSyncLogs(50)).map((log) => ({
        id: log.id,
        syncType: log.syncType,
        triggerSource: log.triggerSource,
        triggerUserId: log.triggerUserId,
        status: log.status,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        counts: (log.counts && typeof log.counts === "object"
          ? (log.counts as Record<string, number>)
          : {}),
        errorMessage: log.errorMessage,
      })),
      status: "ok",
    })),

  emailNotificationsCalendar: authed
    .route({ method: "GET", path: "/email-notifications/calendar" })
    .input(emailNotificationsCalendarQuerySchema)
    .output(emailNotificationsCalendarResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof emailNotificationsCalendarQuerySchema> }) => {
      const fromDate = new Date(`${input.from}T00:00:00.000Z`);
      const toDate = new Date(`${input.to}T23:59:59.999Z`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notifications = await (db.$qb as any)
        .selectFrom("DoctoraliaEmailNotification")
        .selectAll()
        .where("appointmentDate", ">=", fromDate)
        .where("appointmentDate", "<=", toDate)
        .orderBy("appointmentDate", "asc")
        .execute();

      return {
        data: { count: notifications.length, notifications },
        status: "ok",
      };
    }),

  calendarMerged: canReadDoctoraliaCalendar
    .route({ method: "GET", path: "/calendar/merged" })
    .input(calendarMergedQuerySchema)
    .output(calendarMergedResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof calendarMergedQuerySchema> }) => {
      const fromDate = new Date(`${input.from}T00:00:00.000Z`);
      const toDate = new Date(`${input.to}T23:59:59.999Z`);

      const [appointments, emails] = await Promise.all([
        db.doctoraliaCalendarAppointment.findMany({
          where: {
            isBlock: false,
            startAt: { gte: fromDate, lte: toDate },
          },
          orderBy: [{ startAt: "asc" }],
          select: {
            colorSchemaId: true,
            comments: true,
            duration: true,
            endAt: true,
            eventServices: true,
            eventType: true,
            externalId: true,
            hasPatient: true,
            id: true,
            isPatientFirstAdminBooking: true,
            isPatientFirstTime: true,
            patientBirthDate: true,
            patientExternalId: true,
            patientReferenceId: true,
            schedule: { select: { displayName: true, externalId: true } },
            scheduledBy: true,
            serviceColorSchemaId: true,
            serviceName: true,
            startAt: true,
            status: true,
            title: true,
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (db.$qb as any)
          .selectFrom("DoctoraliaEmailNotification")
          .selectAll()
          .where("appointmentDate", ">=", fromDate)
          .where("appointmentDate", "<=", toDate)
          .orderBy("appointmentDate", "asc")
          .execute() as Promise<
          Array<{
            id: string;
            appointmentDate: Date | null;
            appointmentDoctor: string | null;
            appointmentService: string | null;
            calendarAppointmentId: number | null;
            clinicAddress: string | null;
            createdAt: Date;
            emailMessageId: string;
            eventType: "BOOKING" | "MODIFICATION" | "CANCELLATION";
            patientEmail: string | null;
            patientName: string;
            patientPhone: string | null;
            previousAppointmentDate: Date | null;
            updatedAt: Date;
          }>
        >,
      ]);

      const emailsByAppointmentId = new Map<number, typeof emails>();
      const fuzzyBuckets = new Map<string, typeof emails>();
      for (const email of emails) {
        if (email.calendarAppointmentId != null) {
          const bucket = emailsByAppointmentId.get(email.calendarAppointmentId) ?? [];
          bucket.push(email);
          emailsByAppointmentId.set(email.calendarAppointmentId, bucket);
          continue;
        }
        if (!email.appointmentDate) continue;
        const key = mergeKey(email.patientName, email.appointmentDate);
        const bucket = fuzzyBuckets.get(key) ?? [];
        bucket.push(email);
        fuzzyBuckets.set(key, bucket);
      }

      const usedEmailIds = new Set<string>();
      const entries = appointments.map((appointment) => {
        const direct = emailsByAppointmentId.get(appointment.id) ?? [];
        const fuzzy = fuzzyBuckets.get(mergeKey(appointment.title, appointment.startAt)) ?? [];
        const matched = [...direct, ...fuzzy];
        for (const email of matched) {
          usedEmailIds.add(email.id);
        }
        const booking = matched.find((e) => e.eventType === "BOOKING") ?? null;
        const cancellation = matched.find((e) => e.eventType === "CANCELLATION") ?? null;
        const modifications = matched.filter((e) => e.eventType === "MODIFICATION");
        return {
          appointment,
          emails: {
            all: matched,
            booking,
            cancellation,
            modifications,
          },
        };
      });

      const orphanEmails = emails.filter((email) => !usedEmailIds.has(email.id));
      const matchedEmailCount = emails.length - orphanEmails.length;

      return {
        data: {
          counts: {
            appointments: appointments.length,
            matchedEmails: matchedEmailCount,
            orphanEmails: orphanEmails.length,
          },
          entries,
          orphanEmails,
        },
        status: "ok" as const,
      };
    }),

  emailNotificationsOverview: authed
    .route({ method: "GET", path: "/email-notifications/overview" })
    .output(emailNotificationsOverviewResponseSchema)
    .handler(async () => {
      const imapHostConfigured = Boolean(process.env.DOCTORALIA_IMAP_HOST);
      const imapUserConfigured = Boolean(process.env.DOCTORALIA_IMAP_USER);
      const imapPassConfigured = Boolean(process.env.DOCTORALIA_IMAP_PASS);
      const listener = {
        ...getDoctoraliaImapListenerStatus(),
        enabled: process.env.ENABLE_DOCTORALIA_IMAP === "true",
      };

      return {
        data: {
          imapHostConfigured,
          imapMailbox: process.env.DOCTORALIA_IMAP_MAILBOX ?? "INBOX",
          imapPassConfigured,
          imapReady: imapHostConfigured && imapUserConfigured && imapPassConfigured,
          imapUserConfigured,
          listener,
          senderFilter: process.env.DOCTORALIA_EMAIL_SENDER_FILTER ?? "doctoralia",
        },
        status: "ok",
      };
    }),

  emailNotificationsList: authed
    .route({ method: "GET", path: "/email-notifications" })
    .input(emailNotificationsListQuerySchema)
    .output(emailNotificationsListResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof emailNotificationsListQuerySchema> }) => {
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      const baseQuery = db.$qb.selectFrom("DoctoraliaEmailNotification");
      const [notifications, countRow] = await Promise.all([
        baseQuery.selectAll().orderBy("createdAt", "desc").limit(limit).offset(offset).execute(),
        baseQuery.select((eb) => eb.fn.count("id").as("count")).executeTakeFirst(),
      ]);

      return {
        data: {
          notifications,
          total: Number(countRow?.count ?? 0),
        },
        status: "ok",
      };
    }),

  emailNotificationsStats: authed
    .route({ method: "GET", path: "/email-notifications/stats" })
    .output(emailNotificationsStatsResponseSchema)
    .handler(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (db.$qb as any)
        .selectFrom("DoctoraliaEmailNotification")
        .select(["eventType", "patientPhone"])
        .execute() as Array<{
        eventType: "BOOKING" | "CANCELLATION" | "MODIFICATION";
        patientPhone: string | null;
      }>;

      return {
        data: {
          bookings: rows.filter((row) => row.eventType === "BOOKING").length,
          cancellations: rows.filter((row) => row.eventType === "CANCELLATION").length,
          modifications: rows.filter((row) => row.eventType === "MODIFICATION").length,
          total: rows.length,
          withPhone: rows.filter((row) => Boolean(row.patientPhone)).length,
        },
        status: "ok",
      };
    }),

  emailNotificationsPatients: authed
    .route({ method: "GET", path: "/email-notifications/patients" })
    .input(emailNotificationsPatientsQuerySchema)
    .output(emailNotificationsPatientsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof emailNotificationsPatientsQuerySchema> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (db.$qb as any)
        .selectFrom("DoctoraliaEmailNotification")
        .select(["id", "patientName", "patientPhone", "patientEmail", "appointmentDate"]);

      if (input.search) {
        query = query.where("patientName", "ilike", `%${input.search}%`);
      }

      const rows = await query.orderBy("appointmentDate", "desc").execute() as Array<{
        id: string;
        patientName: string;
        patientPhone: string | null;
        patientEmail: string | null;
        appointmentDate: string | null;
      }>;

      // Group by patient identity (name + phone) in JS
      const patientMap = new Map<string, {
        patientName: string;
        patientPhone: string | null;
        patientEmail: string | null;
        totalBookings: number;
        lastAppointmentDate: Date | null;
      }>();

      for (const row of rows) {
        const key = `${row.patientName}|||${row.patientPhone ?? ""}`;
        const apptDate = row.appointmentDate ? new Date(row.appointmentDate) : null;
        const existing = patientMap.get(key);

        if (!existing) {
          patientMap.set(key, {
            patientName: row.patientName,
            patientPhone: row.patientPhone,
            patientEmail: row.patientEmail,
            totalBookings: 1,
            lastAppointmentDate: apptDate,
          });
        } else {
          existing.totalBookings++;
          if (apptDate && (!existing.lastAppointmentDate || apptDate > existing.lastAppointmentDate)) {
            existing.lastAppointmentDate = apptDate;
          }
        }
      }

      const patients = Array.from(patientMap.values()).sort((a, b) => {
        if (!a.lastAppointmentDate) return 1;
        if (!b.lastAppointmentDate) return -1;
        return b.lastAppointmentDate.getTime() - a.lastAppointmentDate.getTime();
      });

      return {
        data: { patients, total: patients.length },
        status: "ok",
      };
    }),

  emailNotificationsPatientHistory: authed
    .route({ method: "GET", path: "/email-notifications/patients/history" })
    .input(emailNotificationsPatientHistoryQuerySchema)
    .output(emailNotificationsPatientHistoryResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof emailNotificationsPatientHistoryQuerySchema> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (db.$qb as any)
        .selectFrom("DoctoraliaEmailNotification")
        .selectAll()
        .where("patientName", "=", input.patientName);

      if (input.patientPhone) {
        query = query.where("patientPhone", "=", input.patientPhone);
      }

      const notifications = await query.orderBy("appointmentDate", "desc").execute();

      return {
        data: { notifications },
        status: "ok",
      };
    }),

  emailNotificationsMonthlySummary: authed
    .route({ method: "GET", path: "/email-notifications/monthly-summary" })
    .input(emailNotificationsMonthlySummaryQuerySchema)
    .output(emailNotificationsMonthlySummaryResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof emailNotificationsMonthlySummaryQuerySchema> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (db.$qb as any)
        .selectFrom("DoctoraliaEmailNotification")
        .select(["eventType", "appointmentDate"])
        .where("appointmentDate", "is not", null);

      if (input.year !== undefined) {
        const yearStart = new Date(Date.UTC(input.year, 0, 1));
        const nextYearStart = new Date(Date.UTC(input.year + 1, 0, 1));
        query = query.where("appointmentDate", ">=", yearStart).where("appointmentDate", "<", nextYearStart);
      }

      const rows = (await query.execute()) as Array<{
        eventType: "BOOKING" | "CANCELLATION" | "MODIFICATION";
        appointmentDate: Date | string;
      }>;

      const buckets = new Map<string, { bookings: number; modifications: number; cancellations: number }>();
      for (const row of rows) {
        const date = row.appointmentDate instanceof Date ? row.appointmentDate : new Date(row.appointmentDate);
        if (Number.isNaN(date.getTime())) continue;
        const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        let bucket = buckets.get(period);
        if (!bucket) {
          bucket = { bookings: 0, modifications: 0, cancellations: 0 };
          buckets.set(period, bucket);
        }
        if (row.eventType === "BOOKING") bucket.bookings++;
        else if (row.eventType === "MODIFICATION") bucket.modifications++;
        else if (row.eventType === "CANCELLATION") bucket.cancellations++;
      }

      const data = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, counts]) => {
          const total = counts.bookings + counts.modifications + counts.cancellations;
          const cancellationRate = counts.bookings > 0 ? counts.cancellations / counts.bookings : 0;
          return {
            period,
            bookings: counts.bookings,
            modifications: counts.modifications,
            cancellations: counts.cancellations,
            total,
            cancellationRate,
          };
        });

      return { data, status: "ok" as const };
    }),

  calendarAppointmentsMonthlySummary: authed
    .route({ method: "GET", path: "/calendar-appointments/monthly-summary" })
    .input(calendarAppointmentsMonthlySummaryQuerySchema)
    .output(calendarAppointmentsMonthlySummaryResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof calendarAppointmentsMonthlySummaryQuerySchema> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (db.$qb as any)
        .selectFrom("DoctoraliaCalendarAppointment")
        .select(["status", "startAt"]);

      if (input.year !== undefined) {
        const yearStart = new Date(Date.UTC(input.year, 0, 1));
        const nextYearStart = new Date(Date.UTC(input.year + 1, 0, 1));
        query = query.where("startAt", ">=", yearStart).where("startAt", "<", nextYearStart);
      }

      const rows = (await query.execute()) as Array<{
        status: number;
        startAt: Date | string;
      }>;

      const buckets = new Map<
        string,
        { programmed: number; cancelled: number; attended: number }
      >();
      for (const row of rows) {
        const date = row.startAt instanceof Date ? row.startAt : new Date(row.startAt);
        if (Number.isNaN(date.getTime())) continue;
        const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        let bucket = buckets.get(period);
        if (!bucket) {
          bucket = { programmed: 0, cancelled: 0, attended: 0 };
          buckets.set(period, bucket);
        }
        if (row.status === 0) bucket.programmed++;
        else if (row.status === 2 || row.status === 3) bucket.cancelled++;
        else if (row.status === 4 || row.status === 6) bucket.attended++;
      }

      const data = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, counts]) => {
          const total = counts.programmed + counts.cancelled + counts.attended;
          const cancellationRate = total > 0 ? counts.cancelled / total : 0;
          return {
            period,
            programmed: counts.programmed,
            cancelled: counts.cancelled,
            attended: counts.attended,
            total,
            cancellationRate,
          };
        });

      return { data, status: "ok" as const };
    }),

  emailNotificationsIngest: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/email-notifications/ingest" })
    .input(z.object({}))
    .output(emailNotificationsIngestResponseSchema)
    .handler(async () => {
      try {
        const result = await runDoctoraliaImapIngestOnce();
        return {
          data: result,
          message: `Ingesta completada. Revisados: ${result.checked}, guardados: ${result.saved}, ya existentes: ${result.alreadyProcessed}, omitidos: ${result.skipped}, fallidos: ${result.failed}`,
          status: "ok" as const,
        };
      } catch (error) {
        return {
          data: {
            alreadyProcessed: 0,
            checked: 0,
            failed: 0,
            saved: 0,
            skipped: 0,
          },
          message: error instanceof Error ? error.message : "La ingesta de Doctoralia falló.",
          status: "error" as const,
        };
      }
    }),

  scraperCookiesStatus: canManageDoctoraliaCalendar
    .route({ method: "GET", path: "/scraper/cookies/status" })
    .output(scraperCookiesStatusSchema)
    .handler(async () => {
      const store = await db.doctoraliaCookieStore.findUnique({
        where: { label: "default" },
        select: {
          id: true,
          label: true,
          cookiesJson: true,
          updatedAt: true,
          lastUsedAt: true,
          updatedByUserId: true,
          updatedBy: { select: { loginEmail: true, person: { select: { email: true } } } },
        },
      });

      if (!store) {
        return {
          data: {
            exists: false,
            label: null,
            count: 0,
            updatedAt: null,
            lastUsedAt: null,
            updatedByUserId: null,
            updatedByEmail: null,
          },
          status: "ok" as const,
        };
      }

      const cookies = Array.isArray(store.cookiesJson)
        ? (store.cookiesJson as unknown[])
        : [];

      return {
        data: {
          exists: true,
          label: store.label,
          count: cookies.length,
          updatedAt: store.updatedAt,
          lastUsedAt: store.lastUsedAt,
          updatedByUserId: store.updatedByUserId,
          updatedByEmail:
            store.updatedBy?.loginEmail ?? store.updatedBy?.person?.email ?? null,
        },
        status: "ok" as const,
      };
    }),

  updateScraperCookies: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/scraper/cookies" })
    .input(updateScraperCookiesInputSchema)
    .output(updateScraperCookiesResponseSchema)
    .handler(async ({ context, input }) => {
      const cookies = parseCookieHeader(input.cookieHeader);
      if (cookies.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No se pudo parsear ninguna cookie válida del header recibido.",
        });
      }

      const label = input.label ?? "default";
      const now = new Date();

      const store = await db.doctoraliaCookieStore.upsert({
        where: { label },
        create: {
          label,
          cookiesJson: cookies,
          updatedByUserId: context.user.id,
        },
        update: {
          cookiesJson: cookies,
          updatedByUserId: context.user.id,
          updatedAt: now,
        },
      });

      logEvent("doctoralia.scraper.cookies.update", {
        userId: context.user.id,
        source: "panel",
        label: store.label,
        count: cookies.length,
      });

      return {
        data: {
          label: store.label,
          count: cookies.length,
          updatedAt: store.updatedAt,
        },
        status: "ok" as const,
      };
    }),

  scraperRunOverrideStatus: canManageDoctoraliaCalendar
    .route({ method: "GET", path: "/scraper/run-override/status" })
    .output(scraperRunOverrideStatusSchema)
    .handler(async () => ({
      data: await getDoctoraliaScraperForceRunStatus(),
      status: "ok" as const,
    })),

  activateScraperRunOverride: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/scraper/run-override/activate" })
    .input(z.object({}))
    .output(scraperRunOverrideStatusSchema)
    .handler(async ({ context }) => {
      const data = await requestDoctoraliaScraperForceRun({
        requestedByUserId: context.user.id,
      });

      logEvent("doctoralia.scraper.run_override.activate", {
        active: data.active,
        expiresAt: data.expiresAt,
        requestedByUserId: context.user.id,
      });

      return {
        data,
        status: "ok" as const,
      };
    }),

  clearScraperRunOverride: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/scraper/run-override/clear" })
    .input(z.object({}))
    .output(scraperRunOverrideStatusSchema)
    .handler(async ({ context }) => {
      const data = await clearDoctoraliaScraperForceRun();

      logEvent("doctoralia.scraper.run_override.clear", {
        clearedByUserId: context.user.id,
      });

      return {
        data,
        status: "ok" as const,
      };
    }),

  calendarSyncNow: canManageDoctoraliaCalendar
    .route({ method: "POST", path: "/calendar/sync/now" })
    .input(z.object({}))
    .output(calendarSyncNowResponseSchema)
    .handler(async ({ context }) => {
      if (process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC !== "true") {
        return {
          status: "skip" as const,
          message: "La sincronización de calendario no está habilitada en este entorno.",
          data: null,
        };
      }

      const { hasCalendarApiToken } = await import(
        "../lib/doctoralia/doctoralia-calendar-client.ts"
      );
      const hasToken = await hasCalendarApiToken();
      if (!hasToken) {
        return {
          status: "skip" as const,
          message: "No hay token de API de Doctoralia configurado.",
          data: null,
        };
      }

      try {
        const { doctoraliaCalendarSyncService } = await import(
          "../services/doctoralia-calendar.ts"
        );
        const result = await doctoraliaCalendarSyncService.syncFromAlerts(
          3,
          "manual-ui",
          context.user.id,
        );

        logEvent("doctoralia.calendar.sync.manual", {
          userId: context.user.id,
          alertsFetched: result.alertsFetched,
          pendingAlertsFetched: result.pendingAlertsFetched,
          appointmentsInserted: result.appointments.inserted,
          appointmentsUpdated: result.appointments.updated,
        });

        return {
          status: "ok" as const,
          message: `Sincronización completada. Alertas: ${result.alertsFetched} (${result.pendingAlertsFetched} pendientes). Citas: +${result.appointments.inserted} / ~${result.appointments.updated}.`,
          data: {
            alertsFetched: result.alertsFetched,
            pendingAlertsFetched: result.pendingAlertsFetched,
            appointmentsInserted: result.appointments.inserted,
            appointmentsUpdated: result.appointments.updated,
          },
        };
      } catch (error) {
        return {
          status: "error" as const,
          message: error instanceof Error ? error.message : "Error desconocido al sincronizar.",
          data: null,
        };
      }
    }),
};

function normalizePatientName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dra?\.?|dr\.?|sra?\.?|sr\.?|srta\.?)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeKey(name: string, when: Date): string {
  const minute = Math.floor(when.getTime() / 60_000);
  return `${normalizePatientName(name)}|${minute}`;
}

function parseCookieHeader(header: string): Array<{ name: string; value: string }> {
  const raw = header.trim();
  if (!raw) return [];
  const parts = raw.split(/;\s*/);
  const cookies: Array<{ name: string; value: string }> = [];
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name) continue;
    cookies.push({ name, value });
  }
  return cookies;
}

export const doctoraliaORPCRouter = base
  .prefix("/api/orpc/doctoralia")
  .tag("Doctoralia")
  .router(doctoraliaORPCRouterBase);

export const doctoraliaORPCHandler = new SuperJSONRPCHandler(doctoraliaORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.doctoralia",
      });
    }),
  ],
});

export const doctoraliaOpenAPIHandler = new OpenAPIHandler(doctoraliaORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Doctoralia oRPC",
          description: "Contratos oRPC/OpenAPI para catálogo, reservas y sync de Doctoralia.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.doctoralia",
      });
    }),
  ],
});

export type DoctoraliaORPCRouter = typeof doctoraliaORPCRouter;
