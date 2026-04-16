import { db } from "@finanzas/db";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { sql } from "kysely";
import { googleCalendarConfig } from "../../config";
import { parseCalendarMetadata } from "../../lib/parsers";

dayjs.extend(utc);
dayjs.extend(timezone);
const DEFAULT_TIMEZONE = "America/Santiago";
const TIMEZONE = googleCalendarConfig?.timeZone ?? DEFAULT_TIMEZONE;
const DATE_ONLY_FORMAT = "YYYY-MM-DD";
const EVENT_DATE_SQL = sql<string>`
  COALESCE(
    e.start_date,
    (e.start_date_time AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE})::date
  )
`;
const HAS_LINKED_DTE_SQL = sql<boolean>`
  EXISTS (
    SELECT 1
    FROM event_dte_sale_links l
    WHERE l.event_id = e.id
      AND l.status != 'REJECTED'
  )
`;
const LINKED_DTE_TOTAL_AMOUNT_SQL = sql<number>`
  (
    SELECT COALESCE(SUM(COALESCE(s.total_amount, 0)), 0)::float
    FROM event_dte_sale_links l
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE l.event_id = e.id
      AND l.status != 'REJECTED'
  )
`;
const EFFECTIVE_AMOUNT_EXPECTED_SQL = sql<number>`
  CASE
    WHEN ${HAS_LINKED_DTE_SQL} THEN ${LINKED_DTE_TOTAL_AMOUNT_SQL}
    ELSE COALESCE(e.amount_expected, 0)
  END
`;
const EFFECTIVE_AMOUNT_PAID_SQL = sql<number>`
  CASE
    WHEN ${HAS_LINKED_DTE_SQL} THEN ${LINKED_DTE_TOTAL_AMOUNT_SQL}
    ELSE COALESCE(e.amount_paid, 0)
  END
`;
const EFFECTIVE_ATTENDED_SQL = sql<boolean | null>`
  CASE
    WHEN ${HAS_LINKED_DTE_SQL} THEN true
    ELSE e.attended
  END
`;
const LINKED_PATIENT_NAME_SQL = sql<string | null>`
  (
    SELECT s.client_name
    FROM event_dte_sale_links l
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE l.event_id = e.id
      AND l.status != 'REJECTED'
      AND s.client_rut = COALESCE(e.patient_rut, cs.patient_rut)
    ORDER BY l.updated_at DESC, s.document_date DESC, s.folio DESC
    LIMIT 1
  )
`;
const EFFECTIVE_PATIENT_NAME_SQL = sql<string | null>`
  coalesce(${LINKED_PATIENT_NAME_SQL}, e.patient_name, cs.patient_name)
`;

const formatDateOnly = (value: string | Date | null | undefined): string => {
  if (!value) {
    return "";
  }
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
  beneficiaryRut?: string;
  from?: string;
  to?: string;
  calendarIds?: string[];
  clinicalSeriesId?: number;
  eventTypes?: string[];
  categories?: string[];
  patientName?: string;
  patientRut?: string;
  search?: string;
  seriesKind?: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  seriesStatus?: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
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

// Local-time expression: converts UTC start_date_time to local timezone.
// start_date_time is stored as `timestamp without time zone` in UTC, so we
// need double AT TIME ZONE: first to tag it as UTC, then to convert to local.
const EVENT_DATE_EXPR = sql`coalesce(e.start_date, (e.start_date_time AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}))`;
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
  db.$qb
    .selectFrom("Event as e")
    .leftJoin("Calendar as c", "e.calendarId", "c.id")
    .leftJoin("ClinicalSeries as cs", "e.clinicalSeriesId", "cs.id");

type EventBaseQuery = ReturnType<typeof buildEventBaseQuery>;

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);
const toNullableNumber = (value: number | string | null | undefined): null | number => {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

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
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
    ])
    .executeTakeFirst();
}

function getByMonth(query: EventBaseQuery) {
  return query
    .select([
      EVENT_YEAR.as("year"),
      EVENT_MONTH.as("month"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
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
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
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
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
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
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
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
  beneficiaryName?: string | null;
  beneficiaryRut?: string | null;
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
  patientName?: string | null;
  patientRut?: string | null;
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
  clinicalSeriesId?: number | null;
  dosageValue?: number | null;
  dosageUnit?: string | null;
  seriesStageKind?: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
  seriesStageLabel?: string | null;
  seriesStageNumber?: number | null;
  testMetadata?: {
    firstReading: boolean;
    patchTest: boolean;
    secondReading: boolean;
    skinTest: boolean;
    thirdReading: boolean;
  } | null;
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

function applyCategoryFilter(query: EventBaseQuery, categories: string[]) {
  const hasNull =
    categories.includes("null") ||
    categories.includes("Uncategorized") ||
    categories.includes("__NULL_CATEGORY__");
  const validCategories = categories.filter(
    (c) => c !== "null" && c !== "Uncategorized" && c !== "__NULL_CATEGORY__",
  );

  if (hasNull && validCategories.length > 0) {
    return query.where((eb) =>
      eb.or([eb("e.category", "in", validCategories), eb("e.category", "is", null)]),
    );
  }
  if (hasNull) {
    return query.where("e.category", "is", null);
  }
  return query.where("e.category", "in", validCategories);
}

function applySearchFilter(query: EventBaseQuery, search: string) {
  const term = `%${search}%`;
  return query.where((eb) =>
    eb.or([
      eb("e.summary", "ilike", term),
      eb("e.description", "ilike", term),
      eb("e.beneficiaryName", "ilike", term),
      eb("cs.beneficiaryName", "ilike", term),
      eb(EFFECTIVE_PATIENT_NAME_SQL, "ilike", term),
    ]),
  );
}

function applyFilters(query: EventBaseQuery, filters: CalendarEventFilters): EventBaseQuery {
  let q = applyDateRangeFilters(query, filters);

  // Implementation note: The caller should handle joining if needed.
  // Here we just add where clauses assuming table aliases 'e' (Event) and 'c' (Calendar)

  if (filters.calendarIds && filters.calendarIds.length > 0) {
    q = q.where("c.googleId", "in", filters.calendarIds);
  }

  if (filters.eventTypes && filters.eventTypes.length > 0) {
    q = q.where("e.eventType", "in", filters.eventTypes);
  }

  if (filters.clinicalSeriesId) {
    q = q.where("e.clinicalSeriesId", "=", filters.clinicalSeriesId);
  }

  if (filters.categories && filters.categories.length > 0) {
    q = applyCategoryFilter(q, filters.categories);
  }

  if (filters.patientRut) {
    q = q.where(sql<string>`coalesce(e.patient_rut, cs.patient_rut)`, "=", filters.patientRut);
  }

  if (filters.beneficiaryRut) {
    q = q.where(
      sql<string>`coalesce(e.beneficiary_rut, cs.beneficiary_rut)`,
      "=",
      filters.beneficiaryRut,
    );
  }

  if (filters.patientName) {
    q = q.where(
      EFFECTIVE_PATIENT_NAME_SQL,
      "ilike",
      `%${filters.patientName}%`,
    );
  }

  if (filters.seriesKind) {
    q = q.where("cs.kind", "=", filters.seriesKind);
  }

  if (filters.seriesStatus) {
    q = q.where("cs.status", "=", filters.seriesStatus);
  }

  if (filters.search) {
    q = applySearchFilter(q, filters.search);
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
      EFFECTIVE_PATIENT_NAME_SQL.as("patientName"),
      "e.patientRut as patientRut",
      "e.beneficiaryName as beneficiaryName",
      "e.beneficiaryRut as beneficiaryRut",
      "e.transparency",
      "e.visibility",
      "e.hangoutLink as hangoutLink",
      "e.eventCreatedAt as eventCreatedAt",
      "e.eventUpdatedAt as eventUpdatedAt",
      EFFECTIVE_AMOUNT_EXPECTED_SQL.as("amountExpected"),
      EFFECTIVE_AMOUNT_PAID_SQL.as("amountPaid"),
      EFFECTIVE_ATTENDED_SQL.as("attended"),
      sql<number | null>`e.clinical_series_id`.as("clinicalSeriesId"),
      sql<string | null>`e.series_stage_kind`.as("seriesStageKind"),
      sql<string | null>`e.series_stage_label`.as("seriesStageLabel"),
      sql<number | null>`e.series_stage_number`.as("seriesStageNumber"),
      "e.dosageValue as dosageValue",
      "e.dosageUnit as dosageUnit",
      sql<unknown>`e.test_metadata`.as("testMetadata"),
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
    patientName: string | null;
    patientRut: string | null;
    beneficiaryName: string | null;
    beneficiaryRut: string | null;
    transparency: string | null;
    visibility: string | null;
    hangoutLink: string | null;
    eventDateString: string | Date;
    eventCreatedAt: string | Date | null;
    eventUpdatedAt: string | Date | null;
    amountExpected: number | string | null;
    amountPaid: number | string | null;
    attended: boolean | null;
    clinicalSeriesId: number | null;
    seriesStageKind: "DOSE" | "INSTALLATION" | "MAINTENANCE" | "READING" | null;
    seriesStageLabel: string | null;
    seriesStageNumber: number | null;
    dosageValue: number | null;
    dosageUnit: string | null;
    testMetadata: {
      firstReading: boolean;
      patchTest: boolean;
      secondReading: boolean;
      skinTest: boolean;
      thirdReading: boolean;
    } | null;
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

    // Backward-compat fallback: some historical rows have null classification fields.
    // Recompute from summary/description so schedule view can recover category-based color.
    const parsedMetadata =
      ev.category == null ||
      ev.treatmentStage == null ||
      ev.controlIncluded == null ||
      ev.isDomicilio == null
        ? parseCalendarMetadata({
            summary: ev.summary,
            description: ev.description,
          })
        : null;

    const detail: CalendarEventDetail = {
      calendarId: ev.calendarId,
      eventId: ev.eventId,
      status: ev.status,
      eventType: ev.eventType,
      category: ev.category ?? parsedMetadata?.category ?? null,
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
      patientName: ev.patientName,
      patientRut: ev.patientRut,
      beneficiaryName: ev.beneficiaryName,
      beneficiaryRut: ev.beneficiaryRut,
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
      amountExpected: toNullableNumber(ev.amountExpected),
      amountPaid: toNullableNumber(ev.amountPaid),
      attended: ev.attended,
      clinicalSeriesId: ev.clinicalSeriesId,
      dosageValue: ev.dosageValue,
      dosageUnit: ev.dosageUnit,
      seriesStageKind: ev.seriesStageKind ?? parsedMetadata?.seriesStageKind ?? null,
      seriesStageLabel: ev.seriesStageLabel ?? parsedMetadata?.seriesStageLabel ?? null,
      seriesStageNumber: ev.seriesStageNumber ?? parsedMetadata?.seriesStageNumber ?? null,
      testMetadata: ev.testMetadata ?? parsedMetadata?.testMetadata ?? null,
      treatmentStage: ev.treatmentStage ?? parsedMetadata?.treatmentStage ?? null,
      controlIncluded: ev.controlIncluded ?? parsedMetadata?.controlIncluded ?? false,
      isDomicilio: ev.isDomicilio ?? parsedMetadata?.isDomicilio ?? false,
    };

    grouped[dateKey].events.push(detail);
    grouped[dateKey].total++;
    grouped[dateKey].amountExpected += toNumber(ev.amountExpected);
    grouped[dateKey].amountPaid += toNumber(ev.amountPaid);

    totalEvents++;
    totalAmountExpected += toNumber(ev.amountExpected);
    totalAmountPaid += toNumber(ev.amountPaid);
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
  beneficiaryRut?: string;
  from?: string;
  to?: string;
  calendarIds?: string[];
  clinicalSeriesId?: number;
  patientRut?: string;
  seriesKind?: "PATCH_TEST" | "SKIN_TEST" | "SUBCUTANEOUS_TREATMENT";
  seriesStatus?: "ACTIVE" | "CANCELLED" | "COMPLETED" | "PLANNED" | "INACTIVE";
};

export type TreatmentAnalyticsGranularity = "all" | "day" | "week" | "month";

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
  byDate?: Array<{
    date: string;
    events: number;
    amountExpected: number;
    amountPaid: number;
    dosageMl: number;
    domicilioCount: number;
    induccionCount: number;
    mantencionCount: number;
  }>;
  byWeek?: Array<{
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
  byMonth?: Array<{
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

type TreatmentTotalRow = {
  amountExpected: number | string;
  amountPaid: number | string;
  domicilioCount: number | string;
  dosageMl: number | string;
  events: number | string;
  induccionCount: number | string;
  mantencionCount: number | string;
};

type TreatmentDateRow = {
  amountExpected: number | string;
  amountPaid: number | string;
  date: string | Date;
  domicilioCount: number | string;
  dosageMl: number | string;
  events: number | string;
  induccionCount: number | string;
  mantencionCount: number | string;
};

type TreatmentWeekRow = {
  amountExpected: number | string;
  amountPaid: number | string;
  domicilioCount: number | string;
  dosageMl: number | string;
  events: number | string;
  induccionCount: number | string;
  isoWeek: number | string;
  isoYear: number | string;
  mantencionCount: number | string;
};

type TreatmentMonthRow = {
  amountExpected: number | string;
  amountPaid: number | string;
  domicilioCount: number | string;
  dosageMl: number | string;
  events: number | string;
  induccionCount: number | string;
  mantencionCount: number | string;
  month: number | string;
  year: number | string;
};

const dosageAggregateSql = sql<number>`
  COALESCE(
    SUM(CASE WHEN e.dosage_value IS NOT NULL THEN e.dosage_value ELSE 0 END),
    0
  )
`;

const treatDateExpression = sql`coalesce(e.start_date_time, e.start_date)`;

function buildTreatmentBaseQuery(filters: TreatmentAnalyticsFilters) {
  let baseQuery = db.$qb
    .selectFrom("Event as e")
    .leftJoin("Calendar as c", "e.calendarId", "c.id")
    .leftJoin("ClinicalSeries as cs", "e.clinicalSeriesId", "cs.id")
    .where("e.category", "=", "Tratamiento subcutáneo");

  if (filters.from && dayjs(filters.from).isValid()) {
    baseQuery = baseQuery.where(
      treatDateExpression,
      ">=",
      dayjs(filters.from).startOf("day").toISOString(),
    );
  }
  if (filters.to && dayjs(filters.to).isValid()) {
    baseQuery = baseQuery.where(
      treatDateExpression,
      "<=",
      dayjs(filters.to).endOf("day").toISOString(),
    );
  }
  if (filters.calendarIds && filters.calendarIds.length > 0) {
    baseQuery = baseQuery.where("c.googleId", "in", filters.calendarIds);
  }
  if (filters.clinicalSeriesId) {
    baseQuery = baseQuery.where("e.clinicalSeriesId", "=", filters.clinicalSeriesId);
  }
  if (filters.patientRut) {
    baseQuery = baseQuery.where(
      sql<string>`coalesce(e.patient_rut, cs.patient_rut)`,
      "=",
      filters.patientRut,
    );
  }
  if (filters.beneficiaryRut) {
    baseQuery = baseQuery.where(
      sql<string>`coalesce(e.beneficiary_rut, cs.beneficiary_rut)`,
      "=",
      filters.beneficiaryRut,
    );
  }
  if (filters.seriesKind) {
    baseQuery = baseQuery.where("cs.kind", "=", filters.seriesKind);
  }
  if (filters.seriesStatus) {
    baseQuery = baseQuery.where("cs.status", "=", filters.seriesStatus);
  }
  return baseQuery;
}

async function getTreatmentTotals(baseQuery: ReturnType<typeof buildTreatmentBaseQuery>) {
  return baseQuery
    .select([
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
      dosageAggregateSql.as("dosageMl"),
      sql<number>`sum(case when e.is_domicilio = true then 1 else 0 end)`.as("domicilioCount"),
      sql<number>`sum(case when e.treatment_stage = 'Inducción' then 1 else 0 end)`.as(
        "induccionCount",
      ),
      sql<number>`sum(case when e.treatment_stage = 'Mantención' then 1 else 0 end)`.as(
        "mantencionCount",
      ),
    ])
    .executeTakeFirst();
}

async function getTreatmentByDate(baseQuery: ReturnType<typeof buildTreatmentBaseQuery>) {
  const byDateBase = baseQuery.select([
    EVENT_DATE_SQL.as("date"),
    EFFECTIVE_AMOUNT_EXPECTED_SQL.as("amountExpectedRaw"),
    EFFECTIVE_AMOUNT_PAID_SQL.as("amountPaidRaw"),
    sql<number>`e.dosage_value`.as("dosageValueRaw"),
    sql<boolean>`e.is_domicilio`.as("isDomicilioRaw"),
    sql<string>`e.treatment_stage`.as("treatmentStageRaw"),
  ]);

  return db.$qb
    .selectFrom(byDateBase.as("b"))
    .select([
      sql`b.date`.as("date"),
      sql<number>`count(*)`.as("events"),
      sql<number>`coalesce(sum(b."amountExpectedRaw"), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(b."amountPaidRaw"), 0)`.as("amountPaid"),
      sql<number>`
        COALESCE(
          SUM(CASE WHEN b."dosageValueRaw" IS NOT NULL THEN b."dosageValueRaw" ELSE 0 END),
          0
        )
      `.as("dosageMl"),
      sql<number>`sum(case when b."isDomicilioRaw" = true then 1 else 0 end)`.as("domicilioCount"),
      sql<number>`sum(case when b."treatmentStageRaw" = 'Inducción' then 1 else 0 end)`.as(
        "induccionCount",
      ),
      sql<number>`sum(case when b."treatmentStageRaw" = 'Mantención' then 1 else 0 end)`.as(
        "mantencionCount",
      ),
    ])
    .groupBy("b.date")
    .orderBy("b.date", "desc")
    .execute();
}

async function getTreatmentByWeek(baseQuery: ReturnType<typeof buildTreatmentBaseQuery>) {
  return baseQuery
    .select([
      sql<number>`extract(isoyear from coalesce(e.start_date_time, e.start_date))`.as("isoYear"),
      sql<number>`extract(week from coalesce(e.start_date_time, e.start_date))`.as("isoWeek"),
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
      dosageAggregateSql.as("dosageMl"),
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
}

async function getTreatmentByMonth(baseQuery: ReturnType<typeof buildTreatmentBaseQuery>) {
  return baseQuery
    .select([
      sql<number>`extract(year from coalesce(e.start_date_time, e.start_date))`.as("year"),
      sql<number>`extract(month from coalesce(e.start_date_time, e.start_date))`.as("month"),
      sql<number>`count(e.id)`.as("events"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_EXPECTED_SQL}), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(${EFFECTIVE_AMOUNT_PAID_SQL}), 0)`.as("amountPaid"),
      dosageAggregateSql.as("dosageMl"),
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
}

function mapTotals(row: null | TreatmentTotalRow | undefined): TreatmentAnalyticsResult["totals"] {
  return {
    events: Number(row?.events || 0),
    amountExpected: Number(row?.amountExpected || 0),
    amountPaid: Number(row?.amountPaid || 0),
    dosageMl: Number(row?.dosageMl || 0),
    domicilioCount: Number(row?.domicilioCount || 0),
    induccionCount: Number(row?.induccionCount || 0),
    mantencionCount: Number(row?.mantencionCount || 0),
  };
}

function mapByDate(rows: TreatmentDateRow[] | null | undefined) {
  return rows?.map((r) => ({
    date: formatDateOnly(r.date),
    events: Number(r.events),
    amountExpected: Number(r.amountExpected),
    amountPaid: Number(r.amountPaid),
    dosageMl: Number(r.dosageMl),
    domicilioCount: Number(r.domicilioCount),
    induccionCount: Number(r.induccionCount),
    mantencionCount: Number(r.mantencionCount),
  }));
}

function mapByWeek(rows: TreatmentWeekRow[] | null | undefined) {
  return rows?.map((r) => ({
    isoYear: Number(r.isoYear),
    isoWeek: Number(r.isoWeek),
    events: Number(r.events),
    amountExpected: Number(r.amountExpected),
    amountPaid: Number(r.amountPaid),
    dosageMl: Number(r.dosageMl),
    domicilioCount: Number(r.domicilioCount),
    induccionCount: Number(r.induccionCount),
    mantencionCount: Number(r.mantencionCount),
  }));
}

function mapByMonth(rows: TreatmentMonthRow[] | null | undefined) {
  return rows?.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    events: Number(r.events),
    amountExpected: Number(r.amountExpected),
    amountPaid: Number(r.amountPaid),
    dosageMl: Number(r.dosageMl),
    domicilioCount: Number(r.domicilioCount),
    induccionCount: Number(r.induccionCount),
    mantencionCount: Number(r.mantencionCount),
  }));
}

/**
 * Get analytics for subcutaneous treatment events
 * Aggregates treatments by date, week, and month with metrics like dosage, home delivery, and treatment stage
 */
export async function getTreatmentAnalytics(
  filters: TreatmentAnalyticsFilters,
  options?: { granularity?: TreatmentAnalyticsGranularity },
): Promise<TreatmentAnalyticsResult> {
  const granularity = options?.granularity ?? "all";
  const includeByDate = granularity === "all" || granularity === "day";
  const includeByWeek = granularity === "all" || granularity === "week";
  const includeByMonth = granularity === "all" || granularity === "month";
  const baseQuery = buildTreatmentBaseQuery(filters);
  const [totals, byDate, byWeek, byMonth] = await Promise.all([
    getTreatmentTotals(baseQuery),
    includeByDate ? getTreatmentByDate(baseQuery) : Promise.resolve(null),
    includeByWeek ? getTreatmentByWeek(baseQuery) : Promise.resolve(null),
    includeByMonth ? getTreatmentByMonth(baseQuery) : Promise.resolve(null),
  ]);

  return {
    totals: mapTotals(totals as TreatmentTotalRow | null | undefined),
    byDate: mapByDate(byDate as TreatmentDateRow[] | null | undefined),
    byWeek: mapByWeek(byWeek as TreatmentWeekRow[] | null | undefined),
    byMonth: mapByMonth(byMonth as TreatmentMonthRow[] | null | undefined),
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
