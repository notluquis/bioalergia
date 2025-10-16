export type CalendarFilters = {
  from: string;
  to: string;
  calendarIds: string[];
  eventTypes: string[];
  search: string;
  maxDays: number;
};

export type CalendarAggregateByYear = {
  year: number;
  total: number;
};

export type CalendarAggregateByMonth = {
  year: number;
  month: number;
  total: number;
};

export type CalendarAggregateByWeek = {
  isoYear: number;
  isoWeek: number;
  total: number;
};

export type CalendarAggregateByWeekday = {
  weekday: number;
  total: number;
};

export type CalendarAggregateByDate = {
  date: string;
  total: number;
};

export type CalendarSummary = {
  filters: {
    from: string;
    to: string;
    calendarIds: string[];
    eventTypes: string[];
    search?: string;
  };
  totals: {
    events: number;
    days: number;
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
};

export type CalendarDayEvents = {
  date: string;
  total: number;
  events: CalendarEventDetail[];
};

export type CalendarDaily = {
  filters: {
    from: string;
    to: string;
    calendarIds: string[];
    eventTypes: string[];
    search?: string;
    maxDays: number;
  };
  totals: {
    days: number;
    events: number;
  };
  days: CalendarDayEvents[];
};
