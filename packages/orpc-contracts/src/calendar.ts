import { oc } from "@orpc/contract";
import { z } from "zod";

export const calendarMissingClassificationFilterKeySchema = z.enum([
  "missingCategory",
  "missingAmountExpected",
  "missingAmountPaid",
  "missingAttended",
  "missingDosage",
  "missingTreatmentStage",
]);

export const calendarQueryInputSchema = z.object({
  beneficiaryRut: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  calendarIds: z.array(z.string()).optional(),
  clinicalSeriesId: z.number().int().positive().optional(),
  eventTypes: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  search: z.string().optional(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT", "MEDICAL_CONSULTATION"]).optional(),
  seriesStatus: z.enum(["PLANNED", "ACTIVE", "INACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  maxDays: z.coerce.number().positive().int().optional(),
});

export const calendarSyncLogsInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
});

export const calendarRebuildClinicalSeriesInputSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const calendarRebuildClinicalSeriesResponseSchema = z.object({
  deleted: z.number(),
  deduped: z.number(),
  from: z.string().nullable(),
  processed: z.number(),
  to: z.string().nullable(),
});

export const calendarUnclassifiedEventsInputSchema = z.object({
  filterMode: z.enum(["AND", "OR"]).default("OR").optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50).optional(),
  missing: z.array(calendarMissingClassificationFilterKeySchema).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const calendarReclassifyMissingInputSchema = z.object({
  filterMode: z.enum(["AND", "OR"]).optional(),
  missing: z.array(calendarMissingClassificationFilterKeySchema).optional(),
});

export const calendarReclassifyJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal("accepted"),
  totalEvents: z.number(),
});

export const calendarJobStatusInputSchema = z.object({
  jobId: z.string().min(1),
});

export const calendarSyncResponseSchema = z.object({
  status: z.literal("accepted"),
  message: z.string(),
  logId: z.number().int(),
});

export const calendarTestMetadataSchema = z.object({
  firstReading: z.boolean(),
  patchTest: z.boolean(),
  secondReading: z.boolean(),
  skinTest: z.boolean(),
  thirdReading: z.boolean(),
});

export const calendarClassificationOptionsSchema = z.object({
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

export const calendarSummaryItemSchema = z.object({
  id: z.number().int(),
  googleId: z.string(),
  name: z.string(),
  eventCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const calendarEventDetailSchema = z.object({
  amountExpected: z.number().nullable().optional(),
  amountPaid: z.number().nullable().optional(),
  attended: z.boolean().nullable().optional(),
  beneficiaryName: z.string().nullable().optional(),
  beneficiaryRut: z.string().nullable().optional(),
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
  testMetadata: calendarTestMetadataSchema.nullable().optional(),
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
  patientName: z.string().nullable().optional(),
  patientRut: z.string().nullable().optional(),
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

export const calendarDayEventsSchema = z.object({
  amountExpected: z.number(),
  amountPaid: z.number(),
  date: z.string(),
  events: z.array(calendarEventDetailSchema),
  total: z.number(),
});

export const calendarFiltersOutputSchema = z.object({
  beneficiaryRut: z.string().optional(),
  calendarIds: z.array(z.string()),
  categories: z.array(z.string()),
  clinicalSeriesId: z.number().int().positive().optional(),
  eventTypes: z.array(z.string()).optional(),
  from: z.string(),
  maxDays: z.number(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  search: z.string().optional(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT", "MEDICAL_CONSULTATION"]).optional(),
  seriesStatus: z.enum(["PLANNED", "ACTIVE", "INACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  to: z.string(),
});

export const calendarTotalsSchema = z.object({
  amountExpected: z.number(),
  amountPaid: z.number(),
  days: z.number(),
  events: z.number(),
});

export const calendarDailySchema = z.object({
  days: z.array(calendarDayEventsSchema),
  filters: calendarFiltersOutputSchema,
  totals: calendarTotalsSchema,
});

export const calendarSummaryWithAggregatesSchema = z.object({
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

export const calendarTreatmentAnalyticsInputSchema = z.object({
  beneficiaryRut: z.string().optional(),
  calendarIds: z.array(z.string()).optional(),
  clinicalSeriesId: z.number().int().positive().optional(),
  from: z.string().optional(),
  granularity: z.enum(["day", "week", "month", "all"]).optional(),
  patientRut: z.string().optional(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT", "MEDICAL_CONSULTATION"]).optional(),
  seriesStatus: z.enum(["PLANNED", "ACTIVE", "INACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  to: z.string().optional(),
});

export const calendarTreatmentAnalyticsPeriodSchema = z.object({
  amountExpected: z.number(),
  amountPaid: z.number(),
  domicilioCount: z.number(),
  dosageMl: z.number(),
  events: z.number(),
  induccionCount: z.number(),
  mantencionCount: z.number(),
});

export const calendarTreatmentAnalyticsSchema = z.object({
  byDate: z
    .array(
      calendarTreatmentAnalyticsPeriodSchema.extend({
        date: z.string(),
      }),
    )
    .optional(),
  byMonth: z
    .array(
      calendarTreatmentAnalyticsPeriodSchema.extend({
        month: z.number(),
        year: z.number(),
      }),
    )
    .optional(),
  byWeek: z
    .array(
      calendarTreatmentAnalyticsPeriodSchema.extend({
        isoWeek: z.number(),
        isoYear: z.number(),
      }),
    )
    .optional(),
  totals: calendarTreatmentAnalyticsPeriodSchema,
});

export const calendarTreatmentAnalyticsResponseSchema = z.object({
  data: calendarTreatmentAnalyticsSchema,
  filters: z.object({
    calendarIds: z.array(z.string()).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export const calendarUpdateClassificationSchema = z.object({
  calendarId: z.string(),
  eventId: z.string(),
  category: z.string().nullable().optional(),
  amountExpected: z.number().nullable().optional(),
  amountPaid: z.number().nullable().optional(),
  attended: z.boolean().nullable().optional(),
  clinicalSeriesId: z.number().nullable().optional(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable().optional(),
  seriesStageLabel: z.string().nullable().optional(),
  seriesStageNumber: z.number().nullable().optional(),
  dosageValue: z.number().nullable().optional(),
  dosageUnit: z.string().nullable().optional(),
  treatmentStage: z.string().nullable().optional(),
  controlIncluded: z.boolean().nullable().optional(),
  isDomicilio: z.boolean().nullable().optional(),
  testMetadata: calendarTestMetadataSchema.nullable().optional(),
});

export const calendarSyncLogSchema = z.object({
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
  logEntries: z
    .array(
      z.object({
        message: z.string().nullable(),
        severity: z.string(),
        attributes: z.unknown().nullable(),
        tags: z.unknown().nullable(),
        timestamp: z.date(),
      }),
    )
    .optional(),
});

export const calendarJobStateSchema = z.object({
  error: z.string().nullable(),
  id: z.string(),
  message: z.string(),
  progress: z.number(),
  result: z.unknown(),
  status: z.enum(["cancelled", "completed", "failed", "pending", "running"]),
  total: z.number(),
  type: z.string(),
});

export const calendarUnclassifiedEventSchema = z.object({
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
  testMetadata: calendarTestMetadataSchema.nullable(),
  treatmentStage: z.string().nullable(),
});

export const calendarUnclassifiedEventsResponseSchema = z.object({
  events: z.array(calendarUnclassifiedEventSchema),
  totalCount: z.number(),
});

export const calendarContract = {
  classificationOptions: oc
    .route({ method: "GET", path: "/classification-options" })
    .output(calendarClassificationOptionsSchema),
  calendars: oc.route({ method: "GET", path: "/calendars" }).output(z.array(calendarSummaryItemSchema)),
  summaryEvents: oc
    .route({ method: "GET", path: "/events/summary" })
    .input(calendarQueryInputSchema)
    .output(calendarSummaryWithAggregatesSchema),
  dailyEvents: oc
    .route({ method: "GET", path: "/events/daily" })
    .input(calendarQueryInputSchema)
    .output(calendarDailySchema),
  treatmentAnalytics: oc
    .route({ method: "GET", path: "/events/treatment-analytics" })
    .input(calendarTreatmentAnalyticsInputSchema)
    .output(calendarTreatmentAnalyticsResponseSchema),
  classifyEvent: oc
    .route({ method: "POST", path: "/events/classify" })
    .input(calendarUpdateClassificationSchema)
    .output(z.object({ ok: z.literal(true) })),
  syncEvents: oc
    .route({ method: "POST", path: "/events/sync" })
    .output(calendarSyncResponseSchema),
  syncLogs: oc
    .route({ method: "GET", path: "/events/sync/logs" })
    .input(calendarSyncLogsInputSchema)
    .output(z.array(calendarSyncLogSchema)),
  rebuildClinicalSeries: oc
    .route({ method: "POST", path: "/series/rebuild" })
    .input(calendarRebuildClinicalSeriesInputSchema)
    .output(calendarRebuildClinicalSeriesResponseSchema),
  unclassifiedEvents: oc
    .route({ method: "GET", path: "/events/unclassified" })
    .input(calendarUnclassifiedEventsInputSchema)
    .output(calendarUnclassifiedEventsResponseSchema),
  reclassifyEvents: oc
    .route({ method: "POST", path: "/events/reclassify" })
    .input(calendarReclassifyMissingInputSchema)
    .output(calendarReclassifyJobResponseSchema),
  reclassifyAllEvents: oc
    .route({ method: "POST", path: "/events/reclassify-all" })
    .output(calendarReclassifyJobResponseSchema),
  jobStatus: oc
    .route({ method: "GET", path: "/events/job/{jobId}" })
    .input(calendarJobStatusInputSchema)
    .output(z.object({ job: calendarJobStateSchema })),
};

export type CalendarContract = typeof calendarContract;
