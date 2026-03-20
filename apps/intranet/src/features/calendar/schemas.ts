import { z } from "zod";
import { zApiDateOnly, zDateString } from "@/lib/api-validate";

const zDate = z.coerce.date();
const zDateOnly = zApiDateOnly;
const zDateOnlyNullable = zDateOnly.nullable();
const zDateTime = z.iso.datetime({ offset: true });
const zEventDateTime = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === "") {
    return null;
  }
  return value;
}, z.union([zDateTime, zDateOnly]).nullable());

// Note: CATEGORY_CHOICES and TREATMENT_STAGE_CHOICES are fetched from
// /api/calendar/classification-options (single source of truth in parsers.ts)

export const classificationSchema = z.object({
  amountExpected: z.string().optional().nullable(),
  amountPaid: z.string().optional().nullable(),
  attended: z.boolean(),
  category: z.string().optional().nullable(),
  clinicalSeriesId: z.number().int().positive().optional().nullable(),
  dosageValue: z.string().optional().nullable(),
  dosageUnit: z.string().optional().nullable(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).optional().nullable(),
  seriesStageLabel: z.string().optional().nullable(),
  seriesStageNumber: z.number().int().min(0).optional().nullable(),
  testPatchFirstReading: z.boolean().optional(),
  testPatchSecondReading: z.boolean().optional(),
  testPatchThirdReading: z.boolean().optional(),
  testSubtypePatch: z.boolean().optional(),
  testSubtypeSkin: z.boolean().optional(),
  treatmentStage: z.string().optional().nullable(),
});

export const classificationArraySchema = z.object({
  entries: z.array(classificationSchema),
});

export type ClassificationEntry = z.infer<typeof classificationSchema>;
export type FormValues = z.infer<typeof classificationArraySchema>;

const TestMetadataSchema = z.strictObject({
  firstReading: z.boolean(),
  patchTest: z.boolean(),
  secondReading: z.boolean(),
  skinTest: z.boolean(),
  thirdReading: z.boolean(),
});

export const CalendarEventDetailSchema = z.strictObject({
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
  testMetadata: TestMetadataSchema.nullable().optional(),
  endDate: zDateOnlyNullable,
  endDateTime: zEventDateTime,
  endTimeZone: z.string().nullable(),
  eventCreatedAt: zEventDateTime,
  eventDate: zDateOnly,
  eventDateTime: zEventDateTime,
  eventId: z.string(),
  eventType: z.string().nullable(),
  eventUpdatedAt: zEventDateTime,
  hangoutLink: z.string().nullable(),
  isDomicilio: z.boolean().nullable().optional(),
  location: z.string().nullable(),
  patientName: z.string().nullable().optional(),
  patientRut: z.string().nullable().optional(),
  rawEvent: z.unknown(),
  startDate: zDateOnlyNullable,
  startDateTime: zEventDateTime,
  startTimeZone: z.string().nullable(),
  status: z.string().nullable(),
  summary: z.string().nullable(),
  transparency: z.string().nullable(),
  treatmentStage: z.string().nullable().optional(),
  visibility: z.string().nullable(),
});

export const CalendarDayEventsSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  date: zDateOnly,
  events: z.array(CalendarEventDetailSchema),
  total: z.number(),
});

export const CalendarFiltersSchema = z.strictObject({
  beneficiaryRut: z.string().optional(),
  calendarIds: z.array(z.string()),
  categories: z.array(z.string()),
  clinicalSeriesId: z.number().optional(),
  eventTypes: z.array(z.string()).optional(),
  from: zDateString,
  maxDays: z.number(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  search: z.string().optional(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).optional(),
  seriesStatus: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  to: zDateString,
});

export const CalendarTotalsSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  days: z.number(),
  events: z.number(),
});

export const CalendarDailyResponseSchema = z.strictObject({
  days: z.array(CalendarDayEventsSchema),
  filters: CalendarFiltersSchema,
  status: z.literal("ok"),
  totals: CalendarTotalsSchema,
});

export const CalendarDataSchema = z.strictObject({
  createdAt: zDate,
  eventCount: z.number(),
  googleId: z.string(),
  id: z.number(),
  name: z.string(),
  updatedAt: zDate,
});

export const CalendarsResponseSchema = z.strictObject({
  calendars: z.array(CalendarDataSchema),
  status: z.literal("ok"),
});

const CalendarAggregateByDateSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  date: zDateOnly,
  total: z.number(),
});

const CalendarAggregateByMonthSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  month: z.number(),
  total: z.number(),
  year: z.number(),
});

const CalendarAggregateByWeekSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  isoWeek: z.number(),
  isoYear: z.number(),
  total: z.number(),
});

const CalendarAggregateByWeekdaySchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  total: z.number(),
  weekday: z.number(),
});

const CalendarAggregateByYearSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  total: z.number(),
  year: z.number(),
});

const CalendarAggregateByDateTypeSchema = z.strictObject({
  date: zDateOnly,
  eventType: z.string().nullable(),
  total: z.number(),
});

export const CalendarSummaryResponseSchema = z.strictObject({
  aggregates: z.strictObject({
    byDate: z.array(CalendarAggregateByDateSchema),
    byDateType: z.array(CalendarAggregateByDateTypeSchema),
    byMonth: z.array(CalendarAggregateByMonthSchema),
    byWeek: z.array(CalendarAggregateByWeekSchema),
    byWeekday: z.array(CalendarAggregateByWeekdaySchema),
    byYear: z.array(CalendarAggregateByYearSchema),
  }),
  available: z.strictObject({
    calendars: z.array(
      z.strictObject({
        calendarId: z.string(),
        total: z.number(),
      })
    ),
    eventTypes: z.array(
      z.strictObject({
        eventType: z.string().nullable(),
        total: z.number(),
      })
    ),
    categories: z.array(
      z.strictObject({
        category: z.string().nullable(),
        total: z.number(),
      })
    ),
  }),
  filters: z.strictObject({
    beneficiaryRut: z.string().optional(),
    calendarIds: z.array(z.string()),
    categories: z.array(z.string()),
    clinicalSeriesId: z.number().optional(),
    eventTypes: z.array(z.string()).optional(),
    from: zDateString,
    patientName: z.string().optional(),
    patientRut: z.string().optional(),
    search: z.string().optional(),
    seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).optional(),
    seriesStatus: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
    to: zDateString,
  }),
  status: z.literal("ok"),
  totals: CalendarTotalsSchema.extend({
    maxEventCount: z.number().optional(),
  }),
});

export const CalendarSyncLogSchema = z.strictObject({
  changeDetails: z
    .strictObject({
      excluded: z.array(z.string()).optional(),
      inserted: z.array(z.string()).optional(),
      updated: z
        .array(
          z.union([
            z.string(),
            z.strictObject({
              changes: z.array(z.string()),
              summary: z.string(),
            }),
          ])
        )
        .optional(),
    })
    .nullable(),
  errorMessage: z.string().nullable(),
  excluded: z.number(),
  fetchedAt: z.coerce.date().nullable(),
  finishedAt: z.coerce.date().nullable(),
  id: z.number(),
  inserted: z.number(),
  logEntries: z
    .array(
      z.strictObject({
        attributes: z.record(z.string(), z.unknown()).nullable().optional(),
        message: z.string().nullable(),
        severity: z.string(),
        tags: z.record(z.string(), z.unknown()).nullable().optional(),
        timestamp: z.coerce.date(),
      })
    )
    .optional(),
  skipped: z.number(),
  startedAt: z.coerce.date().nullable(),
  status: z.enum(["ERROR", "RUNNING", "SUCCESS"]),
  triggerLabel: z.string().nullable(),
  triggerSource: z.string(),
  triggerUserId: z.number().nullable(),
  updated: z.number(),
});

export const CalendarSyncLogsResponseSchema = z.strictObject({
  logs: z.array(CalendarSyncLogSchema),
  status: z.literal("ok"),
});

export const StatusOkSchema = z.strictObject({ status: z.literal("ok") });

export const CalendarSyncResponseSchema = z.strictObject({
  logId: z.number(),
  message: z.string(),
  status: z.literal("accepted"),
});

export const ClassificationOptionsSchema = z.strictObject({
  categories: z.array(z.string()),
  missingFilters: z.array(
    z.strictObject({
      key: z.string(),
      label: z.string(),
    })
  ),
  patchReadings: z.array(z.string()),
  testSubtypes: z.array(z.string()),
  treatmentStages: z.array(z.string()),
});

export const CalendarUnclassifiedEventSchema = z.strictObject({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  attended: z.boolean().nullable(),
  calendarId: z.string(),
  category: z.string().nullable(),
  clinicalSeriesId: z.number().nullable().optional(),
  description: z.string().nullable(),
  dosageValue: z.number().nullable(),
  dosageUnit: z.string().nullable(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable().optional(),
  seriesStageLabel: z.string().nullable().optional(),
  seriesStageNumber: z.number().nullable().optional(),
  testMetadata: TestMetadataSchema.nullable(),
  endDate: zDateOnlyNullable,
  endDateTime: zEventDateTime,
  eventId: z.string(),
  eventType: z.string().nullable(),
  startDate: zDateOnlyNullable,
  startDateTime: zEventDateTime,
  status: z.string().nullable(),
  summary: z.string().nullable(),
  treatmentStage: z.string().nullable(),
});

export const UnclassifiedEventsResponseSchema = z.strictObject({
  events: z.array(CalendarUnclassifiedEventSchema),
  totalCount: z.number(),
});

export const ReclassifyJobResponseSchema = z.strictObject({
  jobId: z.string(),
  status: z.literal("accepted"),
  totalEvents: z.number(),
});

export const CalendarJobStatusSchema = z.strictObject({
  error: z.string().nullable(),
  id: z.string(),
  message: z.string(),
  progress: z.number(),
  result: z.unknown(),
  status: z.enum(["completed", "failed", "pending", "running"]),
  total: z.number(),
  type: z.string(),
});

export const CalendarJobStatusResponseSchema = z.strictObject({
  job: CalendarJobStatusSchema,
});

export const EventDteSuggestionSchema = z.strictObject({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  documentType: z.number(),
  dteSaleDetailId: z.string(),
  exemptAmount: z.number(),
  folio: z.string(),
  ivaAmount: z.number(),
  linkedEventsCount: z.number(),
  method: z.enum(["mixed", "name_exact", "name_fuzzy", "rut"]),
  netAmount: z.number(),
  reasons: z.array(z.string()),
  totalAmount: z.number(),
});

export const EventDteMatchSignalSchema = z.strictObject({
  code: z.string(),
  label: z.string(),
  value: z.string().nullable().optional(),
  weight: z.number(),
});

export const EventDteIdentityClaimsSchema = z.strictObject({
  amountHint: z.number().nullable(),
  beneficiaryName: z.string().nullable(),
  beneficiaryRut: z.string().nullable(),
  eventDate: z.string(),
  nameClaims: z.array(z.string()),
  patientName: z.string().nullable(),
  patientRut: z.string().nullable(),
  rutClaims: z.array(z.string()),
  sameDayOnly: z.boolean(),
  seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).nullable(),
});

export const EventDteCandidateSetSummarySchema = z.strictObject({
  consideredCount: z.number(),
  fallbackCount: z.number(),
  retrievedCount: z.number(),
  sameDayCount: z.number(),
});

export const EventDteHypothesisSchema = z.strictObject({
  amountDiff: z.number().nullable(),
  autoLinkEligible: z.boolean(),
  clientName: z.string(),
  clientRUT: z.string(),
  documentDate: z.string(),
  documents: z.array(EventDteSuggestionSchema).min(1).max(3),
  dteSaleDetailIds: z.array(z.string()).min(1).max(3),
  folios: z.array(z.string()).min(1).max(3),
  hypothesisId: z.string(),
  kind: z.enum(["bundle", "single"]),
  method: z.enum(["mixed", "name_exact", "name_fuzzy", "rut"]),
  policyKey: z.enum(["default_same_day", "same_day_unlinked_fallback", "skin_test_bundle"]),
  reasons: z.array(z.string()),
  score: z.number(),
  signals: z.array(EventDteMatchSignalSchema),
  totalAmount: z.number(),
});

export const ClinicalSeriesLinkedDocumentSchema = z.strictObject({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  dteSaleDetailId: z.string(),
  folio: z.string(),
  matchedBy: z.string(),
  totalAmount: z.number(),
});

export const ClinicalSeriesEventSchema = z.strictObject({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  calendarGoogleId: z.string(),
  eventDate: z.string(),
  eventId: z.number(),
  externalEventId: z.string(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable(),
  seriesStageLabel: z.string().nullable(),
  seriesStageNumber: z.number().nullable(),
  summary: z.string().nullable(),
});

export const ClinicalSeriesSnapshotSchema = z.strictObject({
  displayName: z.string().nullable(),
  eligibleDocumentDateFrom: z.string(),
  eligibleDocumentDateTo: z.string(),
  events: z.array(ClinicalSeriesEventSchema),
  id: z.number(),
  kind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]),
  linkedDocuments: z.array(ClinicalSeriesLinkedDocumentSchema),
  patientName: z.string().nullable(),
  patientRut: z.string().nullable(),
  remainingExpected: z.number(),
  remainingPaid: z.number(),
  status: z.enum(["ACTIVE", "CANCELLED", "COMPLETED"]),
  totalExpected: z.number(),
  totalLinkedAmount: z.number(),
  totalPaid: z.number(),
});

export const EventDteSuggestionResponseSchema = z.strictObject({
  data: z.strictObject({
    candidateSetSummary: EventDteCandidateSetSummarySchema,
    event: z
      .strictObject({
        amountExpected: z.number().nullable(),
        amountPaid: z.number().nullable(),
        calendarId: z.string(),
        description: z.string().nullable(),
        eventDate: z.string(),
        eventId: z.string(),
        summary: z.string().nullable(),
      })
      .nullable(),
    fallbackCandidates: z.array(EventDteSuggestionSchema),
    hypotheses: z.array(EventDteHypothesisSchema),
    identityClaims: EventDteIdentityClaimsSchema.nullable(),
    linked: z.unknown().nullable(),
    linkedDocuments: z.array(ClinicalSeriesLinkedDocumentSchema),
    series: ClinicalSeriesSnapshotSchema.nullable(),
  }),
  status: z.literal("success"),
});

export const EventDteByDayResponseSchema = z.strictObject({
  data: z.array(
    z.strictObject({
      calendarId: z.string(),
      clientName: z.string(),
      clientRUT: z.string(),
      confidenceScore: z.number(),
      dteSaleDetailId: z.string(),
      eventId: z.string(),
      folio: z.string(),
      matchedBy: z.string(),
      status: z.string(),
      totalAmount: z.number(),
    })
  ),
  status: z.literal("success"),
});

export const EventDteConfirmResponseSchema = z.strictObject({
  data: z.unknown().nullable(),
  status: z.literal("success"),
});

export const EventDteAutoLinkResponseSchema = z.strictObject({
  data: z.strictObject({
    date: z.string(),
    details: z.array(
      z.strictObject({
        eventId: z.string(),
        reason: z.string(),
      })
    ),
    linked: z.number(),
    skipped: z.number(),
    skippedByReason: z.array(
      z.strictObject({
        count: z.number(),
        reason: z.string(),
      })
    ),
    totalEvents: z.number(),
  }),
  status: z.literal("success"),
});

export const EventDteAutoLinkPeriodResponseSchema = z.strictObject({
  data: z.strictObject({
    daysProcessed: z.number(),
    details: z.array(
      z.strictObject({
        date: z.string(),
        linked: z.number(),
        skipped: z.number(),
        totalEvents: z.number(),
      })
    ),
    linked: z.number(),
    period: z.string(),
    skipped: z.number(),
    skippedByReason: z.array(
      z.strictObject({
        count: z.number(),
        reason: z.string(),
      })
    ),
    totalEvents: z.number(),
  }),
  status: z.literal("success"),
});

export const EventDteAutoLinkAllPeriodsResponseSchema = z.strictObject({
  data: z.strictObject({
    details: z.array(
      z.strictObject({
        daysProcessed: z.number(),
        linked: z.number(),
        period: z.string(),
        skipped: z.number(),
        totalEvents: z.number(),
      })
    ),
    linked: z.number(),
    periodsProcessed: z.number(),
    skipped: z.number(),
    skippedByReason: z.array(
      z.strictObject({
        count: z.number(),
        reason: z.string(),
      })
    ),
    totalEvents: z.number(),
  }),
  status: z.literal("success"),
});

export const EventDteAutoLinkAllPeriodsStartResponseSchema = z.strictObject({
  data: z.strictObject({
    jobId: z.string(),
    periodConcurrency: z.number(),
    totalPeriods: z.number(),
  }),
  status: z.literal("accepted"),
});

export const EventDteAutoLinkAllPeriodsJobStatusResponseSchema = z.strictObject({
  data: z.strictObject({
    error: z.string().nullable(),
    id: z.string(),
    message: z.string(),
    progress: z.number(),
    result: z.unknown(),
    status: z.enum(["completed", "failed", "pending", "running"]),
    total: z.number(),
    type: z.string(),
  }),
  status: z.literal("success"),
});

export const EventDteOverviewResponseSchema = z.strictObject({
  data: z.strictObject({
    items: z.array(
      z.strictObject({
        amountExpected: z.number().nullable(),
        amountPaid: z.number().nullable(),
        calendarId: z.string(),
        clinicalSeriesId: z.number().nullable(),
        confidenceScore: z.number().nullable(),
        displayName: z.string().nullable(),
        eventDate: z.string(),
        eventTime: z.string().nullable(),
        eventId: z.string(),
        lastAutoLinkSkip: z
          .strictObject({
            attemptedAt: z.string(),
            reason: z.string(),
          })
          .nullable(),
        linkStatus: z.enum(["linked", "pending_issuance", "unlinked"]),
        linked: z.boolean(),
        linkedClientName: z.string().nullable(),
        linkedClientRUT: z.string().nullable(),
        linkedDocuments: z.array(
          z.strictObject({
            clientName: z.string(),
            clientRUT: z.string(),
            confidenceScore: z.number(),
            dteSaleDetailId: z.string(),
            folio: z.string(),
            matchedBy: z.string(),
            totalAmount: z.number(),
          })
        ),
        linkedDteSaleDetailId: z.string().nullable(),
        linkedFolio: z.string().nullable(),
        linkedMatchedBy: z.string().nullable(),
        linkedTotalAmount: z.number().nullable(),
        seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).nullable(),
        summary: z.string().nullable(),
        topHypothesis: EventDteHypothesisSchema.nullable(),
      })
    ),
    page: z.number(),
    pageSize: z.number(),
    period: z.string(),
    stats: z.strictObject({
      avgLinkedScore: z.number(),
      dueEvents: z.number(),
      linkRate: z.number(),
      linkedEvents: z.number(),
      pendingIssuanceEvents: z.number(),
      totalEvents: z.number(),
      unlinkedEvents: z.number(),
      withPerfectScore: z.number(),
    }),
    totalCount: z.number(),
    totalPages: z.number(),
  }),
  status: z.literal("success"),
});

const TreatmentAnalyticsPeriodSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  domicilioCount: z.number(),
  dosageMl: z.number(),
  events: z.number(),
  induccionCount: z.number(),
  mantencionCount: z.number(),
});

const TreatmentAnalyticsByDateSchema = TreatmentAnalyticsPeriodSchema.extend({
  date: zApiDateOnly,
});

const TreatmentAnalyticsByWeekSchema = TreatmentAnalyticsPeriodSchema.extend({
  isoWeek: z.number(),
  isoYear: z.number(),
});

const TreatmentAnalyticsByMonthSchema = TreatmentAnalyticsPeriodSchema.extend({
  month: z.number(),
  year: z.number(),
});

export const TreatmentAnalyticsResponseSchema = z.strictObject({
  data: z.strictObject({
    byDate: z.array(TreatmentAnalyticsByDateSchema).optional(),
    byMonth: z.array(TreatmentAnalyticsByMonthSchema).optional(),
    byWeek: z.array(TreatmentAnalyticsByWeekSchema).optional(),
    totals: TreatmentAnalyticsPeriodSchema,
  }),
  filters: z.strictObject({
    beneficiaryRut: z.string().optional(),
    calendarIds: z.array(z.string()).optional(),
    clinicalSeriesId: z.number().optional(),
    from: zDateString.optional(),
    patientRut: z.string().optional(),
    seriesKind: z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]).optional(),
    seriesStatus: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
    to: zDateString.optional(),
  }),
  status: z.literal("ok"),
});

export const RebuildClinicalSeriesResponseSchema = z.strictObject({
  from: z.string().nullable(),
  processed: z.number(),
  to: z.string().nullable(),
});
