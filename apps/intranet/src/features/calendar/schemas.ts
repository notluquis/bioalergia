import { z } from "zod";

const zDate = z.coerce.date();
const zDateNullable = zDate.nullable();
const zDateNullableOptional = zDateNullable.optional();

// Note: CATEGORY_CHOICES and TREATMENT_STAGE_CHOICES are fetched from
// /api/calendar/classification-options (single source of truth in parsers.ts)

export const classificationSchema = z.object({
  amountExpected: z.string().optional().nullable(),
  amountPaid: z.string().optional().nullable(),
  attended: z.boolean(),
  category: z.string().optional().nullable(),
  dosageValue: z.string().optional().nullable(),
  dosageUnit: z.string().optional().nullable(),
  treatmentStage: z.string().optional().nullable(),
});

export const classificationArraySchema = z.object({
  entries: z.array(classificationSchema),
});

export type ClassificationEntry = z.infer<typeof classificationSchema>;
export type FormValues = z.infer<typeof classificationArraySchema>;

export const CalendarEventDetailSchema = z.strictObject({
  amountExpected: z.number().nullable().optional(),
  amountPaid: z.number().nullable().optional(),
  attended: z.boolean().nullable().optional(),
  calendarId: z.string(),
  category: z.string().nullable().optional(),
  colorId: z.string().nullable(),
  controlIncluded: z.boolean().nullable().optional(),
  description: z.string().nullable(),
  dosageValue: z.number().nullable().optional(),
  dosageUnit: z.string().nullable().optional(),
  endDate: zDateNullable,
  endDateTime: zDateNullable,
  endTimeZone: z.string().nullable(),
  eventCreatedAt: zDateNullable,
  eventDate: zDate,
  eventDateTime: zDateNullable,
  eventId: z.string(),
  eventType: z.string().nullable(),
  eventUpdatedAt: zDateNullable,
  hangoutLink: z.string().nullable(),
  isDomicilio: z.boolean().nullable().optional(),
  location: z.string().nullable(),
  rawEvent: z.unknown(),
  startDate: zDateNullable,
  startDateTime: zDateNullable,
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
  date: zDate,
  events: z.array(CalendarEventDetailSchema),
  total: z.number(),
});

export const CalendarFiltersSchema = z.strictObject({
  calendarIds: z.array(z.string()),
  categories: z.array(z.string()),
  eventTypes: z.array(z.string()).optional(),
  from: z.string(),
  maxDays: z.number(),
  search: z.string().optional(),
  to: z.string(),
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
});

const CalendarAggregateByDateSchema = z.strictObject({
  amountExpected: z.number(),
  amountPaid: z.number(),
  date: zDate,
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
  date: zDate,
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
      }),
    ),
    eventTypes: z.array(
      z.strictObject({
        eventType: z.string().nullable(),
        total: z.number(),
      }),
    ),
    categories: z.array(
      z.strictObject({
        category: z.string().nullable(),
        total: z.number(),
      }),
    ),
  }),
  filters: z.strictObject({
    calendarIds: z.array(z.string()),
    categories: z.array(z.string()),
    eventTypes: z.array(z.string()).optional(),
    from: z.string(),
    search: z.string().optional(),
    to: z.string(),
  }),
  status: z.literal("ok"),
  totals: CalendarTotalsSchema.extend({
    maxEventCount: z.number().optional(),
  }),
});

export const CalendarSyncLogSchema = z.object({
  changeDetails: z
    .object({
      excluded: z.array(z.string()).optional(),
      inserted: z.array(z.string()).optional(),
      updated: z
        .array(
          z.union([
            z.string(),
            z.object({
              changes: z.array(z.string()),
              summary: z.string(),
            }),
          ]),
        )
        .optional(),
    })
    .nullable()
    .optional(),
  errorMessage: z.string().nullable(),
  excluded: z.number(),
  fetchedAt: zDateNullableOptional,
  finishedAt: zDateNullableOptional,
  id: z.number(),
  inserted: z.number(),
  skipped: z.number(),
  startedAt: zDate,
  status: z.enum(["ERROR", "RUNNING", "SUCCESS"]),
  triggerLabel: z.string().nullable(),
  triggerSource: z.string(),
  triggerUserId: z.number().nullable(),
  updated: z.number(),
});

export const CalendarSyncLogsResponseSchema = z.object({
  logs: z.array(CalendarSyncLogSchema),
  status: z.literal("ok"),
});

export const StatusOkSchema = z.object({ status: z.literal("ok") });

export const CalendarSyncResponseSchema = z.object({
  logId: z.number(),
  message: z.string(),
  status: z.literal("accepted"),
});

export const ClassificationOptionsSchema = z.object({
  categories: z.array(z.string()),
  status: z.literal("ok"),
  treatmentStages: z.array(z.string()),
});

export const CalendarUnclassifiedEventSchema = z.strictObject({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  attended: z.boolean().nullable(),
  calendarId: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  dosageValue: z.number().nullable(),
  dosageUnit: z.string().nullable(),
  endDate: zDateNullable,
  endDateTime: zDateNullable,
  eventId: z.string(),
  eventType: z.string().nullable(),
  startDate: zDateNullable,
  startDateTime: zDateNullable,
  status: z.string().nullable(),
  summary: z.string().nullable(),
  treatmentStage: z.string().nullable(),
});

export const UnclassifiedEventsResponseSchema = z.strictObject({
  events: z.array(CalendarUnclassifiedEventSchema),
  status: z.literal("ok"),
  totalCount: z.number(),
});

export const ReclassifyJobResponseSchema = z.strictObject({
  jobId: z.string(),
  status: z.literal("accepted"),
  totalEvents: z.number(),
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
  date: z.string(),
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
    byDate: z.array(TreatmentAnalyticsByDateSchema),
    byMonth: z.array(TreatmentAnalyticsByMonthSchema),
    byWeek: z.array(TreatmentAnalyticsByWeekSchema),
    totals: TreatmentAnalyticsPeriodSchema,
  }),
  filters: z.strictObject({
    calendarIds: z.array(z.string()).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  status: z.literal("ok"),
});
