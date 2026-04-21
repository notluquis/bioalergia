import { z } from "zod";

export const DoctoraliaEventServiceSchema = z.strictObject({
  duration: z.number(),
  isDefault: z.boolean().optional(),
  price: z.number(),
  quantity: z.number(),
  serviceId: z.number(),
  serviceName: z.string(),
  voucherUsed: z.boolean().optional(),
});

export const DoctoraliaCalendarAppointmentSchema = z.strictObject({
  colorSchemaId: z.number().nullable(),
  comments: z.string().nullable(),
  duration: z.number(),
  endAt: z.coerce.date(),
  eventServices: z.object({ items: z.array(DoctoraliaEventServiceSchema) }).nullable(),
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

export const DoctoraliaCalendarAppointmentsResponseSchema = z.strictObject({
  data: z.strictObject({
    appointments: z.array(DoctoraliaCalendarAppointmentSchema),
    count: z.number(),
    filters: z.strictObject({
      from: z.string(),
      scheduleIds: z.array(z.number()),
      to: z.string(),
    }),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarBackfillBucketCountsSchema = z.strictObject({
  inserted: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});

export const DoctoraliaCalendarBackfillStatusDataSchema = z.strictObject({
  running: z.boolean(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  targetEndDate: z.string().nullable(),
  triggeredByUserId: z.number().int().nullable(),
  weeksTotal: z.number().int(),
  weeksProcessed: z.number().int(),
  weeksFailed: z.number().int(),
  schedules: DoctoraliaCalendarBackfillBucketCountsSchema,
  appointments: DoctoraliaCalendarBackfillBucketCountsSchema,
  workPeriods: DoctoraliaCalendarBackfillBucketCountsSchema,
  currentWindow: z
    .strictObject({
      from: z.string(),
      to: z.string(),
    })
    .nullable(),
  lastError: z.string().nullable(),
  minEndDate: z.string(),
});

export const DoctoraliaCalendarBackfillStatusResponseSchema = z.strictObject({
  data: DoctoraliaCalendarBackfillStatusDataSchema,
  status: z.literal("ok"),
});

export const DoctoraliaSyncLogSchema = z.strictObject({
  counts: z.record(z.string(), z.number()),
  endedAt: z.coerce.date().nullable(),
  errorMessage: z.string().nullable(),
  id: z.number(),
  startedAt: z.coerce.date(),
  status: z.string(),
  syncType: z.enum(["CALENDAR", "EMAIL"]),
  triggerSource: z.string().nullable(),
  triggerUserId: z.number().nullable(),
});

export const DoctoraliaSyncLogsResponseSchema = z.strictObject({
  logs: z.array(DoctoraliaSyncLogSchema),
  status: z.literal("ok"),
});

export const DoctoraliaEmailNotificationSchema = z.strictObject({
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

export const DoctoraliaEmailNotificationsCalendarResponseSchema = z.strictObject({
  data: z.strictObject({
    count: z.number(),
    notifications: z.array(DoctoraliaEmailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaMergedCalendarEntrySchema = z.strictObject({
  appointment: DoctoraliaCalendarAppointmentSchema,
  emails: z.strictObject({
    all: z.array(DoctoraliaEmailNotificationSchema),
    booking: DoctoraliaEmailNotificationSchema.nullable(),
    cancellation: DoctoraliaEmailNotificationSchema.nullable(),
    modifications: z.array(DoctoraliaEmailNotificationSchema),
  }),
});

export const DoctoraliaCalendarMergedResponseSchema = z.strictObject({
  data: z.strictObject({
    counts: z.strictObject({
      appointments: z.number(),
      matchedEmails: z.number(),
      orphanEmails: z.number(),
    }),
    entries: z.array(DoctoraliaMergedCalendarEntrySchema),
    orphanEmails: z.array(DoctoraliaEmailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailOverviewResponseSchema = z.strictObject({
  data: z.strictObject({
    imapHostConfigured: z.boolean(),
    imapMailbox: z.string(),
    imapPassConfigured: z.boolean(),
    imapReady: z.boolean(),
    imapUserConfigured: z.boolean(),
    listener: z.strictObject({
      enabled: z.boolean(),
      host: z.string().nullable(),
      lastConnectedAt: z.coerce.date().nullable(),
      lastErrorAt: z.coerce.date().nullable(),
      lastErrorMessage: z.string().nullable(),
      lastProcessedAt: z.coerce.date().nullable(),
      lastStartedAt: z.coerce.date().nullable(),
      mailbox: z.string().nullable(),
      reconnectDelayMs: z.number().nullable(),
      state: z.enum(["stopped", "missing_config", "connecting", "connected", "error"]),
      user: z.string().nullable(),
    }),
    senderFilter: z.string(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailNotificationsListResponseSchema = z.strictObject({
  data: z.strictObject({
    notifications: z.array(DoctoraliaEmailNotificationSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailStatsResponseSchema = z.strictObject({
  data: z.strictObject({
    bookings: z.number(),
    cancellations: z.number(),
    modifications: z.number(),
    total: z.number(),
    withPhone: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailMonthlySummaryPeriodSchema = z.strictObject({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  bookings: z.number().int(),
  modifications: z.number().int(),
  cancellations: z.number().int(),
  total: z.number().int(),
  cancellationRate: z.number(),
});

export const DoctoraliaEmailMonthlySummaryResponseSchema = z.strictObject({
  data: z.array(DoctoraliaEmailMonthlySummaryPeriodSchema),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarMonthlySummaryPeriodSchema = z.strictObject({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  programmed: z.number().int(),
  cancelled: z.number().int(),
  attended: z.number().int(),
  noShow: z.number().int(),
  total: z.number().int(),
  cancellationRate: z.number(),
});

export const DoctoraliaCalendarMonthlySummaryResponseSchema = z.strictObject({
  data: z.array(DoctoraliaCalendarMonthlySummaryPeriodSchema),
  status: z.literal("ok"),
});

export const DoctoraliaEmailIngestResponseSchema = z.strictObject({
  data: z.strictObject({
    alreadyProcessed: z.number(),
    checked: z.number(),
    failed: z.number(),
    saved: z.number(),
    skipped: z.number(),
  }),
  message: z.string(),
  status: z.enum(["ok", "error"]),
});

export const DoctoraliaEmailPatientSchema = z.strictObject({
  lastAppointmentDate: z.coerce.date().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string(),
  patientPhone: z.string().nullable(),
  totalBookings: z.number(),
});

export const DoctoraliaEmailPatientsResponseSchema = z.strictObject({
  data: z.strictObject({
    patients: z.array(DoctoraliaEmailPatientSchema),
    total: z.number(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaEmailPatientHistoryResponseSchema = z.strictObject({
  data: z.strictObject({
    notifications: z.array(DoctoraliaEmailNotificationSchema),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarAuthStartResponseSchema = z.strictObject({
  data: z.strictObject({
    authUrl: z.url(),
    redirectUri: z.url(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaCalendarAuthStatusResponseSchema = z.strictObject({
  data: z.strictObject({
    connected: z.boolean(),
    expiresAt: z.coerce.date().nullable(),
  }),
  status: z.literal("ok"),
});

export const DoctoraliaScraperCookiesStatusResponseSchema = z.strictObject({
  data: z.strictObject({
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

export const DoctoraliaUpdateScraperCookiesResponseSchema = z.strictObject({
  data: z.strictObject({
    label: z.string(),
    count: z.number().int(),
    updatedAt: z.coerce.date(),
  }),
  status: z.literal("ok"),
});
