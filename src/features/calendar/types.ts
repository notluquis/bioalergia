export type CalendarFilters = {
  from: string;
  to: string;
  calendarIds: string[];
  eventTypes: string[];
  categories: string[];
  search: string;
  maxDays: number;
};

export type CalendarAggregateByYear = {
  year: number;
  total: number;
  amountExpected: number;
  amountPaid: number;
};

export type CalendarAggregateByMonth = {
  year: number;
  month: number;
  total: number;
  amountExpected: number;
  amountPaid: number;
};

export type CalendarAggregateByWeek = {
  isoYear: number;
  isoWeek: number;
  total: number;
  amountExpected: number;
  amountPaid: number;
};

export type CalendarAggregateByWeekday = {
  weekday: number;
  total: number;
  amountExpected: number;
  amountPaid: number;
};

export type CalendarAggregateByDate = {
  date: string;
  total: number;
  amountExpected: number;
  amountPaid: number;
};

export type CalendarSummary = {
  filters: {
    from: string;
    to: string;
    calendarIds: string[];
    eventTypes: string[];
    categories: string[];
    search?: string;
  };
  totals: {
    events: number;
    days: number;
    amountExpected: number;
    amountPaid: number;
  };
  aggregates: {
    byYear: CalendarAggregateByYear[];
    byMonth: CalendarAggregateByMonth[];
    byWeek: CalendarAggregateByWeek[];
    byWeekday: CalendarAggregateByWeekday[];
    byDate: CalendarAggregateByDate[];
  };
  available: {
    calendars: Array<{ calendarId: string; total: number }>;
    eventTypes: Array<{ eventType: string | null; total: number }>;
    categories: Array<{ category: string | null; total: number }>;
  };
};

export type CalendarEventDetail = {
  calendarId: string;
  eventId: string;
  status: string | null;
  eventType: string | null;
  summary: string | null;
  description: string | null;
  startDate: string | null;
  startDateTime: string | null;
  startTimeZone: string | null;
  endDate: string | null;
  endDateTime: string | null;
  endTimeZone: string | null;
  colorId: string | null;
  location: string | null;
  transparency: string | null;
  visibility: string | null;
  hangoutLink: string | null;
  eventDate: string;
  eventDateTime: string | null;
  eventCreatedAt: string | null;
  eventUpdatedAt: string | null;
  rawEvent: unknown | null;
  category?: string | null;
  amountExpected?: number | null;
  amountPaid?: number | null;
  attended?: boolean | null;
  dosage?: string | null;
  treatmentStage?: string | null;
};

export type CalendarDayEvents = {
  date: string;
  total: number;
  events: CalendarEventDetail[];
  amountExpected: number;
  amountPaid: number;
};

export type CalendarDaily = {
  filters: {
    from: string;
    to: string;
    calendarIds: string[];
    eventTypes: string[];
    categories: string[];
    search?: string;
    maxDays: number;
  };
  totals: {
    days: number;
    events: number;
    amountExpected: number;
    amountPaid: number;
  };
  days: CalendarDayEvents[];
};

export type CalendarSyncLog = {
  id: number;
  triggerSource: string;
  triggerUserId: number | null;
  triggerLabel: string | null;
  status: "SUCCESS" | "ERROR";
  startedAt: string;
  finishedAt: string | null;
  fetchedAt: string | null;
  inserted: number;
  updated: number;
  skipped: number;
  excluded: number;
  errorMessage: string | null;
};

export type CalendarSyncStep = {
  id: "fetch" | "upsert" | "exclude" | "snapshot";
  label: string;
  durationMs: number;
  details: Record<string, unknown>;
};

export type CalendarUnclassifiedEvent = {
  calendarId: string;
  eventId: string;
  status: string | null;
  eventType: string | null;
  summary: string | null;
  description: string | null;
  startDate: string | null;
  startDateTime: string | null;
  endDate: string | null;
  endDateTime: string | null;
  category: string | null;
  amountExpected: number | null;
  amountPaid: number | null;
  attended: boolean | null;
  dosage: string | null;
  treatmentStage: string | null;
};

export type CalendarEventClassificationPayload = {
  calendarId: string;
  eventId: string;
  category?: string | null;
  amountExpected?: number | null;
  amountPaid?: number | null;
  attended?: boolean | null;
  dosage?: string | null;
  treatmentStage?: string | null;
};
