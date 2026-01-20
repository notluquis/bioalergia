import { z } from "zod";

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

export interface CalendarDaily {
  days: CalendarDayEvents[];
  filters: {
    calendarIds: string[];
    categories: string[];
    eventTypes: string[];
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
  dosage?: null | string;
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
  description: null | string;
  dosage?: null | string;
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
    byMonth: CalendarAggregateByMonth[];
    byWeek: CalendarAggregateByWeek[];
    byWeekday: CalendarAggregateByWeekday[];
    byYear: CalendarAggregateByYear[];
  };
  available: {
    calendars: { calendarId: string; total: number }[];
    categories: { category: null | string; total: number }[];
    eventTypes: { eventType: null | string; total: number }[];
  };
  filters: {
    calendarIds: string[];
    categories: string[];
    eventTypes: string[];
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
  fetchedAt: null | string;
  endedAt: null | string;
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
  dosage: null | string;
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
  dosage: string;
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
  dosage: z.string().max(64).optional().nullable(),
  treatmentStage: z.string().max(64).optional().nullable(),
});
