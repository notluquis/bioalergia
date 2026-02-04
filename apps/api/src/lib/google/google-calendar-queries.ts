import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { sql } from "kysely";
import { googleCalendarConfig } from "../../config";

dayjs.extend(utc);
dayjs.extend(timezone);
const DEFAULT_TIMEZONE = "America/Santiago";
const TIMEZONE = googleCalendarConfig?.timeZone ?? DEFAULT_TIMEZONE;
const DATE_ONLY_FORMAT = "YYYY-MM-DD";
const EVENT_DATE_SQL = sql<string>`
  COALESCE(
    e.start_date,
    (e.start_date_time AT TIME ZONE ${TIMEZONE})::date
  )
`;

const formatDateOnly = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  if (value instanceof Date) {
    // Date-only values from Postgres can arrive as Date at UTC midnight.
    // Format in UTC to avoid shifting the calendar day.
    return dayjs.utc(value).format(DATE_ONLY_FORMAT);
  }
  if (value.includes("T")) {
    // Datetime string: convert to calendar date in the configured timezone.
    return dayjs(value).tz(TIMEZONE).format(DATE_ONLY_FORMAT);
  }
  // Date-only string (YYYY-MM-DD)
  return value;
};

export type CalendarEventFilters = {
  from?: string;
  to?: string;
  calendarIds?: string[];
  eventTypes?: string[];
  categories?: string[];
  search?: string;
  dates?: string[];
};

export type CalendarAggregates = {
  byYear: Array<{
    year: number;
    total: number;
    amountExpected: number;
    amountPaid: number;
  }>;
  byMonth: Array<{
    year: number;
    month: number;
    total: number;
    amountExpected: number;
    amountPaid: number;
  }>;
  byWeek: Array<{
    isoYear: number;
    isoWeek: number;
    total: number;
    amountExpected: number;
    amountPaid: number;
  }>;
  byWeekday: Array<{
    weekday: number;
    total: number;
    amountExpected: number;
    amountPaid: number;
  }>;
  byDate: Array<{
    date: string;
    total: number;
    amountExpected: number;
    amountPaid: number;
  }>;
  byDateType: Array<{
    date: string;
    eventType: string | null;
    total: number;
  }>;
};

export type CalendarAvailableFilters = {
  calendars: Array<{ calendarId: string; total: number }>;
  eventTypes: Array<{ eventType: string | null; total: number }>;
  categories: Array<{ category: string | null; total: number }>;
};

export type CalendarAggregateResult = {
  totals: {
    events: number;
    days: number;
    amountExpected: number;
    amountPaid: number;
    maxEventCount: number;
  };
  aggregates: CalendarAggregates;
  available: CalendarAvailableFilters;
};

const EVENT_DATE_EXPR = sql`coalesce(e.start_date_time, e.start_date)`;
const EVENT_DATE_ONLY = sql<string>`DATE(${EVENT_DATE_EXPR})`;
const EVENT_YEAR = sql<number>`extract(year from ${EVENT_DATE_EXPR})`;
const EVENT_MONTH = sql<number>`extract(month from ${EVENT_DATE_EXPR})`;
const EVENT_ISO_YEAR = sql<number>`extract(isoyear from ${EVENT_DATE_EXPR})`;
const EVENT_ISO_WEEK = sql<number>`extract(week from ${EVENT_DATE_EXPR})`;
const EVENT_WEEKDAY = sql<number>`extract(dow from ${EVENT_DATE_EXPR})`;

type TotalRow = {
  events: number | string;
  days: number | string;
  amountExpected: number | string;
  amountPaid: number | string;
};

type MonthRow = {
  year: number | string;
  month: number | string;
  total: number | string;
  amountExpected: number | string;
  amountPaid: number | string;
};

type WeekRow = {
  isoYear: number | string;
  isoWeek: number | string;
  total: number | string;
  amountExpected: number | string;
  amountPaid: number | string;
};

type DateRow = {
  date: string | Date;
  total: number | string;
  amountExpected: number | string;
  amountPaid: number | string;
};

type DateTypeRow = {
  date: string | Date;
  eventType: string | null;
  total: number | string;
};

type WeekdayRow = {
  weekday: number | string;
  total: number | string;
  amountExpected: number | string;
  amountPaid: number | string;
};

type CalendarRow = { calendarId: string; total: number | string };
type EventTypeRow = { eventType: string | null; total: number | string };
type CategoryRow = { category: string | null; total: number | string };

const buildEventBaseQuery = () =>
  db.$qb.selectFrom("Event as e").leftJoin("Calendar as c", "e.calendarId", "c.id");

type EventBaseQuery = ReturnType<typeof buildEventBaseQuery>;

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);

function buildByYearFromMonths(months: MonthRow[]) {
  const totalsByYear = new Map<
    number,
    { total: number; amountExpected: number; amountPaid: number }
  >();

  for (const month of months) {
    const year = Number(month.year);
    const current = totalsByYear.get(year) ?? { total: 0, amountExpected: 0, amountPaid: 0 };
    totalsByYear.set(year, {
      total: current.total + toNumber(month.total),
      amountExpected: current.amountExpected + toNumber(month.amountExpected),
      amountPaid: current.amountPaid + toNumber(month.amountPaid),
    });
  }

  return Array.from(totalsByYear.entries())
    .map(([year, totals]) => ({ year, ...totals }))
    .sort((a, b) => b.year - a.year);
}

function buildMaxEventCount(rows: DateRow[]) {
  return rows.reduce((max, row) => Math.max(max, toNumber(row.total)), 0);
}

function applyDateRangeFilters(
  query: EventBaseQuery,
  filters: CalendarEventFilters,
): EventBaseQuery {
  let q = query;

  if (filters.from && dayjs(filters.from).isValid()) {
    const fromDate = dayjs(filters.from).startOf("day").toISOString();
    q = q.where(sql`coalesce(e.start_date_time, e.start_date)`, ">=", fromDate);
  }

  if (filters.to && dayjs(filters.to).isValid()) {
    const toDate = dayjs(filters.to).endOf("day").toISOString();
    q = q.where(sql`coalesce(e.start_date_time, e.start_date)`, "<=", toDate);
  }

  return q;
}

function getTotals(query: EventBaseQuery) {
  return query
    .select([
      sql<number>`count(e.id)`.as("events"),
      sql<number>`count(distinct ${EVENT_DATE_ONLY})`.as("days"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
    ])
    .executeTakeFirst();
}

function getByMonth(query: EventBaseQuery) {
  return query
    .select([
      EVENT_YEAR.as("year"),
      EVENT_MONTH.as("month"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
    ])
    .groupBy([EVENT_YEAR, EVENT_MONTH])
    .orderBy(EVENT_YEAR, "desc")
    .orderBy(EVENT_MONTH, "desc")
    .execute();
}

function getByWeek(query: EventBaseQuery) {
  return query
    .select([
      EVENT_ISO_YEAR.as("isoYear"),
      EVENT_ISO_WEEK.as("isoWeek"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
    ])
    .groupBy([EVENT_ISO_YEAR, EVENT_ISO_WEEK])
    .orderBy(EVENT_ISO_YEAR, "desc")
    .orderBy(EVENT_ISO_WEEK, "desc")
    .execute();
}

function getByDate(query: EventBaseQuery) {
  return query
    .select([
      EVENT_DATE_ONLY.as("date"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
    ])
    .groupBy(EVENT_DATE_ONLY)
    .orderBy(EVENT_DATE_ONLY, "desc")
    .execute();
}

function getByDateType(query: EventBaseQuery) {
  return query
    .select([
      EVENT_DATE_ONLY.as("date"),
      "e.eventType as eventType",
      sql<number>`count(e.id)`.as("total"),
    ])
    .groupBy([EVENT_DATE_ONLY, "e.eventType"])
    .orderBy(EVENT_DATE_ONLY, "desc")
    .execute();
}

function getByWeekday(query: EventBaseQuery) {
  return query
    .select([
      EVENT_WEEKDAY.as("weekday"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
    ])
    .groupBy(EVENT_WEEKDAY)
    .orderBy("total", "desc")
    .execute();
}

async function getAvailableFilters(
  filters: CalendarEventFilters,
): Promise<CalendarAvailableFilters> {
  const dateRangeQuery = buildEventBaseQuery();

  const scopedQuery = applyDateRangeFilters(dateRangeQuery, filters);

  const [availCalendars, availEventTypes, availCategories] = await Promise.all([
    scopedQuery
      .select(["c.googleId as calendarId", sql<number>`count(e.id)`.as("total")])
      .groupBy("c.googleId")
      .orderBy("total", "desc")
      .execute(),
    scopedQuery
      .select(["e.eventType as eventType", sql<number>`count(e.id)`.as("total")])
      .groupBy("e.eventType")
      .orderBy("total", "desc")
      .execute(),
    scopedQuery
      .select(["e.category", sql<number>`count(e.id)`.as("total")])
      .groupBy("e.category")
      .orderBy("total", "desc")
      .execute(),
  ]);

  return {
    calendars: (availCalendars as unknown as CalendarRow[]).map((row) => ({
      calendarId: String(row.calendarId),
      total: toNumber(row.total),
    })),
    eventTypes: (availEventTypes as unknown as EventTypeRow[]).map((row) => ({
      eventType: row.eventType,
      total: toNumber(row.total),
    })),
    categories: (availCategories as unknown as CategoryRow[]).map((row) => ({
      category: row.category,
      total: toNumber(row.total),
    })),
  };
}

export type CalendarEventDetail = {
  calendarId: string;
  eventId: string;
  status: string | null;
  eventType: string | null;
  category: string | null;
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
  amountExpected?: number | null;
  amountPaid?: number | null;
  attended?: boolean | null;
  dosageValue?: number | null;
  dosageUnit?: string | null;
  treatmentStage?: string | null;
  controlIncluded?: boolean | null;
  isDomicilio?: boolean | null;
};

export type CalendarEventsByDate = {
  date: string;
  total: number;
  events: CalendarEventDetail[];
  amountExpected: number;
  amountPaid: number;
};

export type CalendarEventsByDateResult = {
  days: CalendarEventsByDate[];
  totals: {
    days: number;
    events: number;
    amountExpected: number;
    amountPaid: number;
  };
};

// Helper: Apply filters to a Kysely query
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy query builder
function applyFilters(query: EventBaseQuery, filters: CalendarEventFilters): EventBaseQuery {
  let q = query;

  if (filters.from) {
    // Use startOf('day') to get 00:00:00 UTC for date comparisons
    const fromDate = dayjs(filters.from).isValid()
      ? dayjs(filters.from).startOf("day").toISOString()
      : null;

    if (fromDate) {
      // Use coalesce to handle both all-day and timed events
      q = q.where(sql`coalesce(e.start_date_time, e.start_date)`, ">=", fromDate);
    }
  }
  if (filters.to) {
    // Use endOf('day') to get 23:59:59.999 UTC for date comparisons
    const toDate = dayjs(filters.to).isValid()
      ? dayjs(filters.to).endOf("day").toISOString()
      : null;

    if (toDate) {
      // Use coalesce to handle both all-day and timed events
      q = q.where(sql`coalesce(e.start_date_time, e.start_date)`, "<=", toDate);
    }
  }

  // Implementation note: The caller should handle joining if needed.
  // Here we just add where clauses assuming table aliases 'e' (Event) and 'c' (Calendar)

  if (filters.calendarIds && filters.calendarIds.length > 0) {
    q = q.where("c.googleId", "in", filters.calendarIds);
  }

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    q = q.where("e.eventType", "in", filters.eventTypes);
  }

  if (filters.categories && filters.categories.length > 0) {
    const hasNull =
      filters.categories.includes("null") ||
      filters.categories.includes("Uncategorized") ||
      filters.categories.includes("__NULL_CATEGORY__");
    const validCategories = filters.categories.filter(
      (c) => c !== "null" && c !== "Uncategorized" && c !== "__NULL_CATEGORY__",
    );

    if (hasNull && validCategories.length > 0) {
      q = q.where((eb) =>
        eb.or([eb("e.category", "in", validCategories), eb("e.category", "is", null)]),
      );
    } else if (hasNull) {
      q = q.where("e.category", "is", null);
    } else {
      q = q.where("e.category", "in", validCategories);
    }
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    q = q.where((eb) =>
      eb.or([eb("e.summary", "ilike", term), eb("e.description", "ilike", term)]),
    );
  }

  if (filters.dates && filters.dates.length > 0) {
    // Cast date to string for comparison or strictly compare dates
    // "startDate" is Timestamp/Date.
    // Simplest is to cast to date
    q = q.where(EVENT_DATE_SQL, "in", filters.dates);
  }

  return q;
}

export async function getCalendarAggregates(
  filters: CalendarEventFilters,
): Promise<CalendarAggregateResult> {
  const filteredQuery = applyFilters(buildEventBaseQuery(), filters);

  const [totals, byMonth, byWeek, byDate, byDateType, byWeekday, available] = await Promise.all([
    getTotals(filteredQuery),
    getByMonth(filteredQuery),
    getByWeek(filteredQuery),
    getByDate(filteredQuery),
    getByDateType(filteredQuery),
    getByWeekday(filteredQuery),
    getAvailableFilters(filters),
  ]);

  const maxEventCount = buildMaxEventCount(byDate as unknown as DateRow[]);

  return {
    totals: {
      events: toNumber((totals as unknown as TotalRow)?.events),
      days: toNumber((totals as unknown as TotalRow)?.days),
      amountExpected: toNumber((totals as unknown as TotalRow)?.amountExpected),
      amountPaid: toNumber((totals as unknown as TotalRow)?.amountPaid),
      maxEventCount,
    },
    aggregates: {
      byYear: buildByYearFromMonths(byMonth as unknown as MonthRow[]),
      byMonth: (byMonth as unknown as MonthRow[]).map((r) => ({
        year: toNumber(r.year),
        month: toNumber(r.month),
        total: toNumber(r.total),
        amountExpected: toNumber(r.amountExpected),
        amountPaid: toNumber(r.amountPaid),
      })),
      byWeek: (byWeek as unknown as WeekRow[]).map((r) => ({
        isoYear: toNumber(r.isoYear),
        isoWeek: toNumber(r.isoWeek),
        total: toNumber(r.total),
        amountExpected: toNumber(r.amountExpected),
        amountPaid: toNumber(r.amountPaid),
      })),
      byWeekday: (byWeekday as unknown as WeekdayRow[]).map((r) => ({
        weekday: toNumber(r.weekday),
        total: toNumber(r.total),
        amountExpected: toNumber(r.amountExpected),
        amountPaid: toNumber(r.amountPaid),
      })),
      byDate: (byDate as unknown as DateRow[]).map((r) => ({
        date: formatDateOnly(r.date as string | Date),
        total: toNumber(r.total),
        amountExpected: toNumber(r.amountExpected),
        amountPaid: toNumber(r.amountPaid),
      })),
      byDateType: (byDateType as unknown as DateTypeRow[]).map((r) => ({
        date: formatDateOnly(r.date as string | Date),
        eventType: r.eventType,
        total: toNumber(r.total),
      })),
    },
    available,
  };
}

// Just add byYear query logic inside the function body
// (Self-correction during write)

export async function getCalendarEventsByDate(
  filters: CalendarEventFilters,
  options: { maxDays?: number } = {},
): Promise<CalendarEventsByDateResult> {
  const filteredQuery = applyFilters(buildEventBaseQuery(), filters);

  const maxDays = options.maxDays || 31;

  // 1. Get dates with events
  const dates = await filteredQuery
    .select(EVENT_DATE_SQL.as("date"))
    .distinct()
    .orderBy("date", "desc")
    .limit(maxDays)
    .execute();

  type DateOnlyRow = { date: string | Date };
  const targetDates = (dates as unknown as DateOnlyRow[]).map((d: DateOnlyRow) =>
    formatDateOnly(d.date),
  );

  if (targetDates.length === 0) {
    return {
      days: [],
      totals: { days: 0, events: 0, amountExpected: 0, amountPaid: 0 },
    };
  }

  // 2. Get events for those dates
  // Apply filters WITHOUT from/to dates, since we'll use the specific targetDates
  const filtersWithoutDates = {
    ...filters,
    from: undefined,
    to: undefined,
  };

  let eventsQuery = applyFilters(buildEventBaseQuery(), filtersWithoutDates);

  // Filter by the exact dates we found (top N dates with events)
  eventsQuery = eventsQuery.where(EVENT_DATE_SQL, "in", targetDates);

  const events = await eventsQuery
    .select([
      "c.googleId as calendarId",
      "e.externalEventId as eventId",
      "e.eventStatus as status", // Map 'eventStatus' model field to 'status' alias

      "e.eventType as eventType",
      "e.category",
      "e.summary",
      "e.description",
      "e.startDate as startDate",
      "e.startDateTime as startDateTime",
      "e.startTimeZone as startTimeZone",
      "e.endDate as endDate",
      "e.endDateTime as endDateTime",
      "e.endTimeZone as endTimeZone",
      "e.colorId as colorId",
      "e.location",
      "e.transparency",
      "e.visibility",
      "e.hangoutLink as hangoutLink",
      "e.eventCreatedAt as eventCreatedAt",
      "e.eventUpdatedAt as eventUpdatedAt",
      "e.amountExpected as amountExpected",
      "e.amountPaid as amountPaid",
      "e.attended",
      "e.dosageValue as dosageValue",
      "e.dosageUnit as dosageUnit",
      "e.treatmentStage as treatmentStage",
      "e.controlIncluded as controlIncluded",
      EVENT_DATE_SQL.as("eventDateString"), // helper for grouping: use raw SQL names
    ])
    .orderBy("e.startDateTime", "desc")
    .execute();

  // Group by date
  const grouped: Record<string, CalendarEventsByDate> = {};

  // Initialize with target dates to match order
  targetDates.forEach((date) => {
    grouped[date as string] = {
      date: formatDateOnly(date),
      total: 0,
      events: [],
      amountExpected: 0,
      amountPaid: 0,
    };
  });

  let totalEvents = 0;
  let totalAmountExpected = 0;
  let totalAmountPaid = 0;

  type EventRow = {
    calendarId: string;
    eventId: string;
    status: string | null;
    eventType: string | null;
    category: string | null;
    summary: string | null;
    description: string | null;
    startDate: string | Date | null;
    startDateTime: string | Date | null;
    startTimeZone: string | null;
    endDate: string | Date | null;
    endDateTime: string | Date | null;
    endTimeZone: string | null;
    colorId: string | null;
    location: string | null;
    transparency: string | null;
    visibility: string | null;
    hangoutLink: string | null;
    eventDateString: string | Date;
    eventCreatedAt: string | Date | null;
    eventUpdatedAt: string | Date | null;
    amountExpected: number | string | null;
    amountPaid: number | string | null;
    attended: boolean | null;
    dosageValue: number | null;
    dosageUnit: string | null;
    treatmentStage: string | null;
    controlIncluded: boolean | null;
    isDomicilio: boolean | null;
  };

  (events as unknown as EventRow[]).forEach((ev: EventRow) => {
    // Normalize date to YYYY-MM-DD format to match targetDates
    const dateKey = formatDateOnly(ev.eventDateString as string | Date);

    if (!grouped[dateKey]) {
      console.warn(
        `[getCalendarEventsByDate] Event date ${dateKey} not in targetDates:`,
        targetDates,
      );
      return;
    }

    const toIsoString = (value: string | Date | null | undefined) =>
      value ? new Date(value).toISOString() : null;

    const detail: CalendarEventDetail = {
      calendarId: ev.calendarId,
      eventId: ev.eventId,
      status: ev.status,
      eventType: ev.eventType,
      category: ev.category,
      summary: ev.summary,
      description: ev.description,
      startDate: toIsoString(ev.startDate),
      startDateTime: toIsoString(ev.startDateTime),
      startTimeZone: ev.startTimeZone,
      endDate: toIsoString(ev.endDate),
      endDateTime: toIsoString(ev.endDateTime),
      endTimeZone: ev.endTimeZone,
      colorId: ev.colorId,
      location: ev.location,
      transparency: ev.transparency,
      visibility: ev.visibility,
      hangoutLink: ev.hangoutLink,
      eventDate: dateKey,
      eventDateTime: ev.startDateTime
        ? toIsoString(ev.startDateTime)
        : dayjs.tz(dateKey, TIMEZONE).toISOString(),
      eventCreatedAt: toIsoString(ev.eventCreatedAt),
      eventUpdatedAt: toIsoString(ev.eventUpdatedAt),
      rawEvent: null, // we don't select raw json to save bandwidth
      amountExpected: Number(ev.amountExpected || 0),
      amountPaid: Number(ev.amountPaid || 0),
      attended: ev.attended,
      dosageValue: ev.dosageValue,
      dosageUnit: ev.dosageUnit,
      treatmentStage: ev.treatmentStage,
      controlIncluded: ev.controlIncluded,
      isDomicilio: ev.isDomicilio,
    };

    grouped[dateKey].events.push(detail);
    grouped[dateKey].total++;
    grouped[dateKey].amountExpected += Number(ev.amountExpected || 0);
    grouped[dateKey].amountPaid += Number(ev.amountPaid || 0);

    totalEvents++;
    totalAmountExpected += Number(ev.amountExpected || 0);
    totalAmountPaid += Number(ev.amountPaid || 0);
  });

  return {
    days: Object.values(grouped).sort(
      (a, b) => dayjs.tz(b.date, TIMEZONE).valueOf() - dayjs.tz(a.date, TIMEZONE).valueOf(),
    ),
    totals: {
      days: targetDates.length,
      events: totalEvents,
      amountExpected: totalAmountExpected,
      amountPaid: totalAmountPaid,
    },
  };
}

export type TreatmentAnalyticsFilters = {
  from?: string;
  to?: string;
  calendarIds?: string[];
};

export type TreatmentAnalyticsResult = {
  totals: {
    events: number;
    amountExpected: number;
    amountPaid: number;
    dosageMl: number;
    domicilioCount: number;
    induccionCount: number;
    mantencionCount: number;
  };
  byDate: Array<{
    date: string;
    events: number;
    amountExpected: number;
    amountPaid: number;
    dosageMl: number;
    domicilioCount: number;
    induccionCount: number;
    mantencionCount: number;
  }>;
  byWeek: Array<{
    isoYear: number;
    isoWeek: number;
    events: number;
    amountExpected: number;
    amountPaid: number;
    dosageMl: number;
    domicilioCount: number;
    induccionCount: number;
    mantencionCount: number;
  }>;
  byMonth: Array<{
    year: number;
    month: number;
    events: number;
    amountExpected: number;
    amountPaid: number;
    dosageMl: number;
    domicilioCount: number;
    induccionCount: number;
    mantencionCount: number;
  }>;
};

/**
 * Get analytics for subcutaneous treatment events
 * Aggregates treatments by date, week, and month with metrics like dosage, home delivery, and treatment stage
 */
export async function getTreatmentAnalytics(
  filters: TreatmentAnalyticsFilters,
): Promise<TreatmentAnalyticsResult> {
  let baseQuery = db.$qb
    .selectFrom("Event as e")
    .leftJoin("Calendar as c", "e.calendarId", "c.id")
    .where("e.category", "=", "Tratamiento subcutáneo");

  // Apply filters
  if (filters.from && dayjs(filters.from).isValid()) {
    const fromDate = dayjs(filters.from).startOf("day").toISOString();
    baseQuery = baseQuery.where(sql`coalesce(e.start_date_time, e.start_date)`, ">=", fromDate);
  }
  if (filters.to && dayjs(filters.to).isValid()) {
    const toDate = dayjs(filters.to).endOf("day").toISOString();
    baseQuery = baseQuery.where(sql`coalesce(e.start_date_time, e.start_date)`, "<=", toDate);
  }
  if (filters.calendarIds && filters.calendarIds.length > 0) {
    baseQuery = baseQuery.where("c.googleId", "in", filters.calendarIds);
  }

  // SQL expression for extracting dosage value as number (in ml)
  // Now simply sums the dosage_value column directly
  const dosageSql = sql<number>`
    COALESCE(
      SUM(CASE WHEN e.dosage_value IS NOT NULL THEN e.dosage_value ELSE 0 END),
      0
    )
  `;

  // 1. Totals
  const totals = await baseQuery
    .select([
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
      dosageSql.as("dosageMl"),
      sql<number>`sum(case when e.is_domicilio = true then 1 else 0 end)`.as("domicilioCount"),
      sql<number>`sum(case when e.treatment_stage = 'Inducción' then 1 else 0 end)`.as(
        "induccionCount",
      ),
      sql<number>`sum(case when e.treatment_stage = 'Mantención' then 1 else 0 end)`.as(
        "mantencionCount",
      ),
    ])
    .executeTakeFirst();

  // 2. By Date
  const byDate = await baseQuery
    .select([
      EVENT_DATE_SQL.as("date"),
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
      dosageSql.as("dosageMl"),
      sql<number>`sum(case when e.is_domicilio = true then 1 else 0 end)`.as("domicilioCount"),
      sql<number>`sum(case when e.treatment_stage = 'Inducción' then 1 else 0 end)`.as(
        "induccionCount",
      ),
      sql<number>`sum(case when e.treatment_stage = 'Mantención' then 1 else 0 end)`.as(
        "mantencionCount",
      ),
    ])
    .groupBy(EVENT_DATE_SQL)
    .orderBy(EVENT_DATE_SQL, "desc")
    .execute();

  // 3. By Week
  const byWeek = await baseQuery
    .select([
      sql<number>`extract(isoyear from coalesce(e.start_date_time, e.start_date))`.as("isoYear"),
      sql<number>`extract(week from coalesce(e.start_date_time, e.start_date))`.as("isoWeek"),
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
      dosageSql.as("dosageMl"),
      sql<number>`sum(case when e.is_domicilio = true then 1 else 0 end)`.as("domicilioCount"),
      sql<number>`sum(case when e.treatment_stage = 'Inducción' then 1 else 0 end)`.as(
        "induccionCount",
      ),
      sql<number>`sum(case when e.treatment_stage = 'Mantención' then 1 else 0 end)`.as(
        "mantencionCount",
      ),
    ])
    .groupBy([
      sql`extract(isoyear from coalesce(e.start_date_time, e.start_date))`,
      sql`extract(week from coalesce(e.start_date_time, e.start_date))`,
    ])
    .orderBy(sql`extract(isoyear from coalesce(e.start_date_time, e.start_date))`, "desc")
    .orderBy(sql`extract(week from coalesce(e.start_date_time, e.start_date))`, "desc")
    .execute();

  // 4. By Month
  const byMonth = await baseQuery
    .select([
      sql<number>`extract(year from coalesce(e.start_date_time, e.start_date))`.as("year"),
      sql<number>`extract(month from coalesce(e.start_date_time, e.start_date))`.as("month"),
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(e.amount_expected), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e.amount_paid), 0)`.as("amountPaid"),
      dosageSql.as("dosageMl"),
      sql<number>`sum(case when e.is_domicilio = true then 1 else 0 end)`.as("domicilioCount"),
      sql<number>`sum(case when e.treatment_stage = 'Inducción' then 1 else 0 end)`.as(
        "induccionCount",
      ),
      sql<number>`sum(case when e.treatment_stage = 'Mantención' then 1 else 0 end)`.as(
        "mantencionCount",
      ),
    ])
    .groupBy([
      sql`extract(year from coalesce(e.start_date_time, e.start_date))`,
      sql`extract(month from coalesce(e.start_date_time, e.start_date))`,
    ])
    .orderBy(sql`extract(year from coalesce(e.start_date_time, e.start_date))`, "desc")
    .orderBy(sql`extract(month from coalesce(e.start_date_time, e.start_date))`, "desc")
    .execute();

  // Type casting for query results
  type TotalRow = {
    events: number | string;
    amountExpected: number | string;
    amountPaid: number | string;
    dosageMl: number | string;
    domicilioCount: number | string;
    induccionCount: number | string;
    mantencionCount: number | string;
  };

  type DateRow = {
    date: string | Date;
    events: number | string;
    amountExpected: number | string;
    amountPaid: number | string;
    dosageMl: number | string;
    domicilioCount: number | string;
    induccionCount: number | string;
    mantencionCount: number | string;
  };

  type WeekRow = {
    isoYear: number | string;
    isoWeek: number | string;
    events: number | string;
    amountExpected: number | string;
    amountPaid: number | string;
    dosageMl: number | string;
    domicilioCount: number | string;
    induccionCount: number | string;
    mantencionCount: number | string;
  };

  type MonthRow = {
    year: number | string;
    month: number | string;
    events: number | string;
    amountExpected: number | string;
    amountPaid: number | string;
    dosageMl: number | string;
    domicilioCount: number | string;
    induccionCount: number | string;
    mantencionCount: number | string;
  };

  return {
    totals: {
      events: Number((totals as unknown as TotalRow)?.events || 0),
      amountExpected: Number((totals as unknown as TotalRow)?.amountExpected || 0),
      amountPaid: Number((totals as unknown as TotalRow)?.amountPaid || 0),
      dosageMl: Number((totals as unknown as TotalRow)?.dosageMl || 0),
      domicilioCount: Number((totals as unknown as TotalRow)?.domicilioCount || 0),
      induccionCount: Number((totals as unknown as TotalRow)?.induccionCount || 0),
      mantencionCount: Number((totals as unknown as TotalRow)?.mantencionCount || 0),
    },
    byDate: (byDate as unknown as DateRow[]).map((r: DateRow) => ({
      date: formatDateOnly(r.date as string | Date),
      events: Number(r.events),
      amountExpected: Number(r.amountExpected),
      amountPaid: Number(r.amountPaid),
      dosageMl: Number(r.dosageMl),
      domicilioCount: Number(r.domicilioCount),
      induccionCount: Number(r.induccionCount),
      mantencionCount: Number(r.mantencionCount),
    })),
    byWeek: (byWeek as unknown as WeekRow[]).map((r: WeekRow) => ({
      isoYear: Number(r.isoYear),
      isoWeek: Number(r.isoWeek),
      events: Number(r.events),
      amountExpected: Number(r.amountExpected),
      amountPaid: Number(r.amountPaid),
      dosageMl: Number(r.dosageMl),
      domicilioCount: Number(r.domicilioCount),
      induccionCount: Number(r.induccionCount),
      mantencionCount: Number(r.mantencionCount),
    })),
    byMonth: (byMonth as unknown as MonthRow[]).map((r: MonthRow) => ({
      year: Number(r.year),
      month: Number(r.month),
      events: Number(r.events),
      amountExpected: Number(r.amountExpected),
      amountPaid: Number(r.amountPaid),
      dosageMl: Number(r.dosageMl),
      domicilioCount: Number(r.domicilioCount),
      induccionCount: Number(r.induccionCount),
      mantencionCount: Number(r.mantencionCount),
    })),
  };
}

export function defaultDateRange(): { from: string; to: string } {
  const today = dayjs().startOf("day");
  const fromSource = googleCalendarConfig?.syncStartDate ?? "2000-01-01";
  const lookahead = googleCalendarConfig?.syncLookAheadDays ?? 365;
  const from = dayjs(fromSource).isValid() ? dayjs(fromSource) : today.subtract(365, "day");
  const to = today.add(lookahead, "day");
  return {
    from: from.format("YYYY-MM-DD"),
    to: to.format("YYYY-MM-DD"),
  };
}
