import { z } from "zod";

export const calendarSearchSchema = z.object({
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  date: z.string().optional().catch(undefined),
  search: z.string().optional().catch(undefined),
  maxDays: z.coerce.number().optional().catch(undefined),
  calendarId: z.array(z.string()).optional().catch(undefined),
  category: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    })
    .catch([]),
  page: z.coerce.number().optional().catch(undefined),
});

export type CalendarSearchParams = z.infer<typeof calendarSearchSchema>;

export interface CalendarAggregateByDate {
  amountExpected: number;
  amountPaid: number;
  date: string;
  total: number;
}

export interface CalendarAggregateByMonth {
  amountExpected: number;
  amountPaid: number;
  month: number;
  total: number;
  year: number;
}

export interface CalendarAggregateByWeek {
  amountExpected: number;
  amountPaid: number;
  isoWeek: number;
  isoYear: number;
  total: number;
}

export interface CalendarAggregateByWeekday {
  amountExpected: number;
  amountPaid: number;
  total: number;
  weekday: number;
}

export interface CalendarAggregateByYear {
  amountExpected: number;
  amountPaid: number;
  total: number;
  year: number;
}

export interface CalendarAggregateByDateType {
  date: string;
  eventType: null | string;
  total: number;
}

export interface CalendarDaily {
  days: CalendarDayEvents[];
  filters: {
    calendarIds: string[];
    categories: string[];
    eventTypes?: string[];
    from: string;
    maxDays: number;
    search?: string;
    to: string;
  };
  totals: {
    amountExpected: number;
    amountPaid: number;
    days: number;
    events: number;
  };
}

export interface CalendarData {
  createdAt: string;
  eventCount: number;
  googleId: string;
  id: number;
  name: string;
  updatedAt: string;
}

export interface CalendarDayEvents {
  amountExpected: number;
  amountPaid: number;
  date: string;
  events: CalendarEventDetail[];
  total: number;
}

export interface CalendarEventClassificationPayload {
  amountExpected?: null | number;
  amountPaid?: null | number;
  attended?: boolean | null;
  calendarId: string;
  category?: null | string;
  controlIncluded?: boolean | null;
  dosageValue?: null | number;
  dosageUnit?: null | string;
  eventId: string;
  treatmentStage?: null | string;
}

export interface CalendarEventDetail {
  amountExpected?: null | number;
  amountPaid?: null | number;
  attended?: boolean | null;
  calendarId: string;
  category?: null | string;
  colorId: null | string;
  controlIncluded?: boolean | null;
  description: null | string;
  dosageValue?: null | number;
  dosageUnit?: null | string;
  endDate: null | string;
  endDateTime: null | string;
  endTimeZone: null | string;
  eventCreatedAt: null | string;
  eventDate: string;
  eventDateTime: null | string;
  eventId: string;
  eventType: null | string;
  eventUpdatedAt: null | string;
  hangoutLink: null | string;
  isDomicilio?: boolean | null;
  location: null | string;
  rawEvent: unknown;
  startDate: null | string;
  startDateTime: null | string;
  startTimeZone: null | string;
  status: null | string;
  summary: null | string;
  transparency: null | string;
  treatmentStage?: null | string;
  visibility: null | string;
}

export interface CalendarFilters {
  calendarIds?: string[];
  categories: string[];
  eventTypes?: string[];
  from: string;
  maxDays: number;
  search?: string;
  to: string;
}

export interface CalendarSummary {
  aggregates: {
    byDate: CalendarAggregateByDate[];
    byDateType: CalendarAggregateByDateType[];
    byMonth: CalendarAggregateByMonth[];
    byWeek: CalendarAggregateByWeek[];
    byWeekday: CalendarAggregateByWeekday[];
    byYear: CalendarAggregateByYear[];
  };
  available: {
    calendars: { calendarId: string; total: number }[];
    categories: { category: null | string; total: number }[];
  };
  filters: {
    calendarIds: string[];
    categories: string[];
    eventTypes?: string[];
    from: string;
    search?: string;
    to: string;
  };
  totals: {
    amountExpected: number;
    amountPaid: number;
    days: number;
    events: number;
    maxEventCount?: number;
  };
}

export interface CalendarSyncLog {
  changeDetails?: null | {
    excluded?: string[];
    inserted?: string[];
    updated?: (string | { changes: string[]; summary: string })[];
  };
  errorMessage: null | string;
  excluded: number;
  fetchedAt?: null | string;
  finishedAt?: null | string;
  id: number;
  inserted: number;
  skipped: number;
  startedAt: string;
  status: "ERROR" | "RUNNING" | "SUCCESS";
  triggerLabel: null | string;
  triggerSource: string;
  triggerUserId: null | number;
  updated: number;
}

export interface CalendarSyncStep {
  details: Record<string, unknown>;
  durationMs: number;
  id: "exclude" | "fetch" | "snapshot" | "upsert";
  label: string;
}

export interface CalendarUnclassifiedEvent {
  amountExpected: null | number;
  amountPaid: null | number;
  attended: boolean | null;
  calendarId: string;
  category: null | string;
  description: null | string;
  dosageValue: null | number;
  dosageUnit: null | string;
  endDate: null | string;
  endDateTime: null | string;
  eventId: string;
  eventType: null | string;
  startDate: null | string;
  startDateTime: null | string;
  status: null | string;
  summary: null | string;
  treatmentStage: null | string;
}

export interface ClassificationFormValues {
  amountExpected: string;
  amountPaid: string;
  attended: boolean;
  category: string;
  dosageValue: string;
  dosageUnit: string;
  treatmentStage: string;
}

export const calendarClassificationSchema = z.object({
  amountExpected: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const parsed = Number.parseInt(value.replaceAll(/\D/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }),
  amountPaid: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const parsed = Number.parseInt(value.replaceAll(/\D/g, ""), 10);
      return Number.isNaN(parsed) ? null : parsed;
    }),
  attended: z.boolean().optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  dosageValue: z.coerce.number().optional().nullable(),
  dosageUnit: z.string().max(20).optional().nullable(),
  treatmentStage: z.string().max(64).optional().nullable(),
});

export interface TreatmentAnalyticsFilters {
  calendarIds?: string[];
  from?: string;
  to?: string;
}

export interface TreatmentAnalyticsPeriodData {
  amountExpected: number;
  amountPaid: number;
  domicilioCount: number;
  dosageMl: number;
  events: number;
  induccionCount: number;
  mantencionCount: number;
}

export interface TreatmentAnalyticsByDate extends TreatmentAnalyticsPeriodData {
  date: string;
}

export interface TreatmentAnalyticsByWeek extends TreatmentAnalyticsPeriodData {
  isoWeek: number;
  isoYear: number;
}

export interface TreatmentAnalyticsByMonth extends TreatmentAnalyticsPeriodData {
  month: number;
  year: number;
}

export interface TreatmentAnalytics {
  byDate: TreatmentAnalyticsByDate[];
  byMonth: TreatmentAnalyticsByMonth[];
  byWeek: TreatmentAnalyticsByWeek[];
  totals: TreatmentAnalyticsPeriodData;
}
