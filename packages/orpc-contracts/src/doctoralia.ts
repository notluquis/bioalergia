import { oc } from "@orpc/contract";
import { z } from "zod";

export const calendarAppointmentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(z.number().int().positive()).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const syncLogsResponseSchema = z.object({
  logs: z.array(
    z.strictObject({
      counts: z.record(z.string(), z.number()),
      endedAt: z.coerce.date().nullable(),
      errorMessage: z.string().nullable(),
      id: z.number(),
      startedAt: z.coerce.date(),
      status: z.string(),
      syncType: z.enum(["CALENDAR", "EMAIL"]),
      triggerSource: z.string().nullable(),
      triggerUserId: z.number().nullable(),
    }),
  ),
  status: z.literal("ok"),
});

export const emailNotificationsCalendarQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const calendarMergedQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const emailNotificationsListQuerySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const emailNotificationSchema = z.strictObject({
  appointmentDate: z.coerce.date().nullable(),
  appointmentDoctor: z.string().nullable(),
  appointmentService: z.string().nullable(),
  calendarAppointmentId: z.number().int().nullable(),
  clinicAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
  emailMessageId: z.string(),
  eventType: z.enum(["BOOKING", "MODIFICATION", "CANCELLATION"]),
  id: z.string(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  previousAppointmentDate: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
});

export const emailNotificationsCalendarResponseSchema = z.object({
  data: z.object({
    count: z.number(),
    notifications: z.array(emailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const doctoraliaImapListenerStateSchema = z.enum([
  "stopped",
  "missing_config",
  "connecting",
  "connected",
  "error",
]);

export const doctoraliaImapListenerSchema = z.object({
  enabled: z.boolean(),
  host: z.string().nullable(),
  lastConnectedAt: z.coerce.date().nullable(),
  lastErrorAt: z.coerce.date().nullable(),
  lastErrorMessage: z.string().nullable(),
  lastProcessedAt: z.coerce.date().nullable(),
  lastStartedAt: z.coerce.date().nullable(),
  mailbox: z.string().nullable(),
  reconnectDelayMs: z.number().int().nullable(),
  state: doctoraliaImapListenerStateSchema,
  user: z.string().nullable(),
});

export const emailNotificationsOverviewResponseSchema = z.object({
  data: z.object({
    imapHostConfigured: z.boolean(),
    imapMailbox: z.string(),
    imapPassConfigured: z.boolean(),
    imapReady: z.boolean(),
    imapUserConfigured: z.boolean(),
    listener: doctoraliaImapListenerSchema,
    senderFilter: z.string(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsListResponseSchema = z.object({
  data: z.object({
    notifications: z.array(emailNotificationSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsStatsResponseSchema = z.object({
  data: z.object({
    bookings: z.number(),
    cancellations: z.number(),
    modifications: z.number(),
    total: z.number(),
    withPhone: z.number(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsMonthlySummaryQuerySchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
});

export const emailNotificationsMonthlySummaryPeriodSchema = z.strictObject({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  bookings: z.number().int(),
  modifications: z.number().int(),
  cancellations: z.number().int(),
  total: z.number().int(),
  cancellationRate: z.number(),
});

export const emailNotificationsMonthlySummaryResponseSchema = z.object({
  data: z.array(emailNotificationsMonthlySummaryPeriodSchema),
  status: z.literal("ok"),
});

export const calendarAppointmentsMonthlySummaryQuerySchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
});

export const calendarAppointmentsMonthlySummaryPeriodSchema = z.strictObject({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  programmed: z.number().int(),
  cancelled: z.number().int(),
  attended: z.number().int(),
  total: z.number().int(),
  cancellationRate: z.number(),
});

export const calendarAppointmentsMonthlySummaryResponseSchema = z.object({
  data: z.array(calendarAppointmentsMonthlySummaryPeriodSchema),
  status: z.literal("ok"),
});

export const emailNotificationsIngestResponseSchema = z.object({
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

export const emailNotificationsPatientsQuerySchema = z.object({
  search: z.string().optional(),
});

export const emailPatientSchema = z.strictObject({
  lastAppointmentDate: z.coerce.date().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  totalBookings: z.number(),
});

export const emailNotificationsPatientsResponseSchema = z.object({
  data: z.object({
    patients: z.array(emailPatientSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const emailNotificationsPatientHistoryQuerySchema = z.object({
  patientName: z.string(),
  patientPhone: z.string().nullable().optional(),
});

export const emailNotificationsPatientHistoryResponseSchema = z.object({
  data: z.object({
    notifications: z.array(emailNotificationSchema),
  }),
  status: z.literal("ok"),
});

const calendarImportCountsSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});

export const calendarImportInputSchema = z.object({
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

export const calendarImportResponseSchema = z.object({
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

export const scraperCookiesStatusSchema = z.object({
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

export const updateScraperCookiesInputSchema = z.object({
  label: z.string().trim().min(1).max(64).optional(),
  cookieHeader: z.string().trim().min(1),
});

export const updateScraperCookiesResponseSchema = z.object({
  data: z.object({
    label: z.string(),
    count: z.number().int(),
    updatedAt: z.coerce.date(),
  }),
  status: z.literal("ok"),
});

export const scraperRunOverrideStatusSchema = z.object({
  data: z.object({
    active: z.boolean(),
    expiresAt: z.coerce.date().nullable(),
    requestedAt: z.coerce.date().nullable(),
    requestedByEmail: z.string().nullable(),
    requestedByUserId: z.number().int().nullable(),
  }),
  status: z.literal("ok"),
});

export const calendarSyncNowResponseSchema = z.object({
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

export const calendarAppointmentsSchema = z.object({
  data: z.object({
    appointments: z.array(
      z.strictObject({
        comments: z.string().nullable(),
        endAt: z.coerce.date(),
        externalId: z.number(),
        id: z.number(),
        patientExternalId: z.number(),
        schedule: z.strictObject({
          displayName: z.string(),
          externalId: z.number(),
        }),
        serviceName: z.string(),
        startAt: z.coerce.date(),
        status: z.number(),
        title: z.string(),
      }),
    ),
    count: z.number(),
    filters: z.object({
      from: z.string(),
      scheduleIds: z.array(z.number()),
      to: z.string(),
    }),
  }),
  status: z.literal("ok"),
});

export const mergedCalendarAppointmentSchema = z.strictObject({
  colorSchemaId: z.number().nullable(),
  comments: z.string().nullable(),
  duration: z.number(),
  endAt: z.coerce.date(),
  eventServices: z.object({ items: z.array(z.any()) }).nullable(),
  eventType: z.number(),
  externalId: z.number(),
  hasPatient: z.boolean(),
  id: z.number(),
  isPatientFirstAdminBooking: z.boolean(),
  isPatientFirstTime: z.boolean(),
  patientBirthDate: z.coerce.date().nullable(),
  patientExternalId: z.number(),
  patientReferenceId: z.string(),
  schedule: z.strictObject({
    displayName: z.string(),
    externalId: z.number(),
  }),
  scheduledBy: z.number(),
  serviceColorSchemaId: z.number().nullable(),
  serviceName: z.string(),
  startAt: z.coerce.date(),
  status: z.number(),
  title: z.string(),
});

export const mergedCalendarEntrySchema = z.strictObject({
  appointment: mergedCalendarAppointmentSchema,
  emails: z.strictObject({
    all: z.array(emailNotificationSchema),
    booking: emailNotificationSchema.nullable(),
    cancellation: emailNotificationSchema.nullable(),
    modifications: z.array(emailNotificationSchema),
  }),
});

export const calendarMergedResponseSchema = z.object({
  data: z.object({
    counts: z.object({
      appointments: z.number(),
      matchedEmails: z.number(),
      orphanEmails: z.number(),
    }),
    entries: z.array(mergedCalendarEntrySchema),
    orphanEmails: z.array(emailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const calendarBackfillBucketCountsSchema = z.object({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});

export const calendarBackfillStatusDataSchema = z.object({
  running: z.boolean(),
  cancelRequested: z.boolean(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  targetEndDate: z.string().nullable(),
  triggeredByUserId: z.number().int().nullable(),
  weeksTotal: z.number().int(),
  weeksProcessed: z.number().int(),
  weeksFailed: z.number().int(),
  schedules: calendarBackfillBucketCountsSchema,
  appointments: calendarBackfillBucketCountsSchema,
  workPeriods: calendarBackfillBucketCountsSchema,
  currentWindow: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .nullable(),
  lastError: z.string().nullable(),
  minEndDate: z.string(),
});

export const calendarBackfillStatusResponseSchema = z.object({
  data: calendarBackfillStatusDataSchema,
  status: z.literal("ok"),
});

export const calendarBackfillStartInputSchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const doctoraliaContract = {
  calendarAppointments: oc
    .route({ method: "GET", path: "/calendar/appointments" })
    .input(calendarAppointmentsQuerySchema)
    .output(calendarAppointmentsSchema),
  calendarMerged: oc
    .route({ method: "GET", path: "/calendar/merged" })
    .input(calendarMergedQuerySchema)
    .output(calendarMergedResponseSchema),
  importCalendarJson: oc
    .route({ method: "POST", path: "/calendar/import-json" })
    .input(calendarImportInputSchema)
    .output(calendarImportResponseSchema),
  emailNotificationsCalendar: oc
    .route({ method: "GET", path: "/email-notifications/calendar" })
    .input(emailNotificationsCalendarQuerySchema)
    .output(emailNotificationsCalendarResponseSchema),
  emailNotificationsOverview: oc
    .route({ method: "GET", path: "/email-notifications/overview" })
    .output(emailNotificationsOverviewResponseSchema),
  emailNotificationsList: oc
    .route({ method: "GET", path: "/email-notifications" })
    .input(emailNotificationsListQuerySchema)
    .output(emailNotificationsListResponseSchema),
  emailNotificationsStats: oc
    .route({ method: "GET", path: "/email-notifications/stats" })
    .output(emailNotificationsStatsResponseSchema),
  emailNotificationsPatients: oc
    .route({ method: "GET", path: "/email-notifications/patients" })
    .input(emailNotificationsPatientsQuerySchema)
    .output(emailNotificationsPatientsResponseSchema),
  emailNotificationsPatientHistory: oc
    .route({ method: "GET", path: "/email-notifications/patients/history" })
    .input(emailNotificationsPatientHistoryQuerySchema)
    .output(emailNotificationsPatientHistoryResponseSchema),
  emailNotificationsIngest: oc
    .route({ method: "POST", path: "/email-notifications/ingest" })
    .input(z.object({}))
    .output(emailNotificationsIngestResponseSchema),
  emailNotificationsMonthlySummary: oc
    .route({ method: "GET", path: "/email-notifications/monthly-summary" })
    .input(emailNotificationsMonthlySummaryQuerySchema)
    .output(emailNotificationsMonthlySummaryResponseSchema),
  calendarAppointmentsMonthlySummary: oc
    .route({ method: "GET", path: "/calendar-appointments/monthly-summary" })
    .input(calendarAppointmentsMonthlySummaryQuerySchema)
    .output(calendarAppointmentsMonthlySummaryResponseSchema),
  calendarBackfillStatus: oc
    .route({ method: "GET", path: "/calendar/backfill/status" })
    .output(calendarBackfillStatusResponseSchema),
  calendarBackfillStart: oc
    .route({ method: "POST", path: "/calendar/backfill/start" })
    .input(calendarBackfillStartInputSchema)
    .output(calendarBackfillStatusResponseSchema),
  calendarBackfillCancel: oc
    .route({ method: "POST", path: "/calendar/backfill/cancel" })
    .output(calendarBackfillStatusResponseSchema),
  syncLogs: oc.route({ method: "GET", path: "/sync/logs" }).output(syncLogsResponseSchema),
  scraperCookiesStatus: oc
    .route({ method: "GET", path: "/scraper/cookies/status" })
    .output(scraperCookiesStatusSchema),
  updateScraperCookies: oc
    .route({ method: "POST", path: "/scraper/cookies" })
    .input(updateScraperCookiesInputSchema)
    .output(updateScraperCookiesResponseSchema),
  scraperRunOverrideStatus: oc
    .route({ method: "GET", path: "/scraper/run-override/status" })
    .output(scraperRunOverrideStatusSchema),
  activateScraperRunOverride: oc
    .route({ method: "POST", path: "/scraper/run-override/activate" })
    .input(z.object({}))
    .output(scraperRunOverrideStatusSchema),
  clearScraperRunOverride: oc
    .route({ method: "POST", path: "/scraper/run-override/clear" })
    .input(z.object({}))
    .output(scraperRunOverrideStatusSchema),
  calendarSyncNow: oc
    .route({ method: "POST", path: "/calendar/sync/now" })
    .input(z.object({}))
    .output(calendarSyncNowResponseSchema),
};

export type DoctoraliaContract = typeof doctoraliaContract;
