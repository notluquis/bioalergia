import dayjs from "dayjs";
import { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "./prisma.js";

import { googleCalendarConfig } from "../config.js";

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
  byYear: Array<{ year: number; total: number; amountExpected: number; amountPaid: number }>;
  byMonth: Array<{ year: number; month: number; total: number; amountExpected: number; amountPaid: number }>;
  byWeek: Array<{ isoYear: number; isoWeek: number; total: number; amountExpected: number; amountPaid: number }>;
  byWeekday: Array<{ weekday: number; total: number; amountExpected: number; amountPaid: number }>;
  byDate: Array<{ date: string; total: number; amountExpected: number; amountPaid: number }>;
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
  };
  aggregates: CalendarAggregates;
  available: CalendarAvailableFilters;
};

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
  dosage?: string | null;
  treatmentStage?: string | null;
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

const NULL_EVENT_TYPE_TOKEN = "__NULL__";
const NULL_CATEGORY_TOKEN = "__NULL_CATEGORY__";

const EVENT_DATETIME = Prisma.sql`COALESCE(events.start_date_time, STR_TO_DATE(CONCAT(events.start_date, ' 00:00:00'), '%Y-%m-%d %H:%i:%s'))`;
const EVENT_DATE = Prisma.sql`COALESCE(events.start_date, DATE(events.start_date_time))`;

function buildWhereClause(filters: CalendarEventFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`${EVENT_DATETIME} IS NOT NULL`];

  if (filters.from) {
    conditions.push(Prisma.sql`${EVENT_DATETIME} >= ${filters.from} `);
  }

  if (filters.to) {
    conditions.push(Prisma.sql`${EVENT_DATETIME} < DATE_ADD(${filters.to}, INTERVAL 1 DAY)`);
  }

  if (filters.calendarIds?.length) {
    const values = Prisma.join(
      filters.calendarIds.map((id) => Prisma.sql`${id}`),
      ", "
    );
    conditions.push(Prisma.sql`events.calendar_id IN (${values})`);
  }

  if (filters.eventTypes?.length) {
    const includeNull = filters.eventTypes.includes(NULL_EVENT_TYPE_TOKEN);
    const explicit = filters.eventTypes.filter((type) => type !== NULL_EVENT_TYPE_TOKEN);
    const clauses: Prisma.Sql[] = [];

    if (explicit.length) {
      const list = Prisma.join(
        explicit.map((type) => Prisma.sql`${type}`),
        ", "
      );
      clauses.push(Prisma.sql`events.event_type IN (${list})`);
    }

    if (includeNull) {
      clauses.push(Prisma.sql`events.event_type IS NULL`);
    }

    if (clauses.length) {
      conditions.push(Prisma.sql`(${Prisma.join(clauses, " OR ")})`);
    }
  }

  if (filters.categories?.length) {
    const includeNull = filters.categories.includes(NULL_CATEGORY_TOKEN);
    const explicit = filters.categories.filter((item) => item !== NULL_CATEGORY_TOKEN);
    const clauses: Prisma.Sql[] = [];

    if (explicit.length) {
      const list = Prisma.join(
        explicit.map((value) => Prisma.sql`${value}`),
        ", "
      );
      clauses.push(Prisma.sql`events.category IN (${list})`);
    }

    if (includeNull) {
      clauses.push(Prisma.sql`(events.category IS NULL OR events.category = '')`);
    }

    if (clauses.length) {
      conditions.push(Prisma.sql`(${Prisma.join(clauses, " OR ")})`);
    }
  }

  if (filters.search) {
    const likePattern = `%${filters.search}%`;
    conditions.push(Prisma.sql`(events.summary LIKE ${likePattern} OR events.description LIKE ${likePattern})`);
  }

  if (filters.dates?.length) {
    const list = Prisma.join(
      filters.dates.map((date) => Prisma.sql`${date}`),
      ", "
    );
    conditions.push(Prisma.sql`${EVENT_DATE} IN (${list})`);
  }

  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

type AggregateRowBase = { total: bigint | number; amountExpected: number | null; amountPaid: number | null };
type YearAggregateRow = AggregateRowBase & { year: number };
type MonthAggregateRow = AggregateRowBase & { year: number; month: number };
type WeekAggregateRow = AggregateRowBase & { isoYear: number; isoWeek: number };
type WeekdayAggregateRow = AggregateRowBase & { weekday: number };
type DateAggregateRow = AggregateRowBase & { date: string };

function mapAggregateRow(row: AggregateRowBase) {
  return {
    total: Number(row.total ?? 0),
    amountExpected: Number(row.amountExpected ?? 0),
    amountPaid: Number(row.amountPaid ?? 0),
  };
}

export async function getCalendarAggregates(filters: CalendarEventFilters): Promise<CalendarAggregateResult> {
  const where = buildWhereClause(filters);

  const yearRows = await prisma.$queryRaw<
    Array<{ year: number; total: bigint; amountExpected: number | null; amountPaid: number | null }>
  >(Prisma.sql`
    SELECT YEAR(${EVENT_DATETIME}) AS year,
           COUNT(*) AS total,
           SUM(events.amount_expected) AS amountExpected,
           SUM(events.amount_paid) AS amountPaid
      FROM google_calendar_events events
      ${where}
     GROUP BY YEAR(${EVENT_DATETIME})
     ORDER BY YEAR(${EVENT_DATETIME})
  `);

  const monthRows = await prisma.$queryRaw<
    Array<{ year: number; month: number; total: bigint; amountExpected: number | null; amountPaid: number | null }>
  >(Prisma.sql`
    SELECT YEAR(${EVENT_DATETIME}) AS year,
           MONTH(${EVENT_DATETIME}) AS month,
           COUNT(*) AS total,
           SUM(events.amount_expected) AS amountExpected,
           SUM(events.amount_paid) AS amountPaid
      FROM google_calendar_events events
      ${where}
     GROUP BY YEAR(${EVENT_DATETIME}), MONTH(${EVENT_DATETIME})
     ORDER BY YEAR(${EVENT_DATETIME}), MONTH(${EVENT_DATETIME})
  `);

  const weekRows = await prisma.$queryRaw<
    Array<{ isoYear: number; isoWeek: number; total: bigint; amountExpected: number | null; amountPaid: number | null }>
  >(Prisma.sql`
    SELECT CAST(DATE_FORMAT(${EVENT_DATETIME}, '%x') AS UNSIGNED) AS isoYear,
           CAST(DATE_FORMAT(${EVENT_DATETIME}, '%v') AS UNSIGNED) AS isoWeek,
           COUNT(*) AS total,
           SUM(events.amount_expected) AS amountExpected,
           SUM(events.amount_paid) AS amountPaid
      FROM google_calendar_events events
      ${where}
     GROUP BY isoYear, isoWeek
     ORDER BY isoYear, isoWeek
  `);

  const weekdayRows = await prisma.$queryRaw<
    Array<{ weekday: number; total: bigint; amountExpected: number | null; amountPaid: number | null }>
  >(Prisma.sql`
    SELECT WEEKDAY(${EVENT_DATETIME}) AS weekday,
           COUNT(*) AS total,
           SUM(events.amount_expected) AS amountExpected,
           SUM(events.amount_paid) AS amountPaid
      FROM google_calendar_events events
      ${where}
     GROUP BY WEEKDAY(${EVENT_DATETIME})
     ORDER BY WEEKDAY(${EVENT_DATETIME})
  `);

  const dateRows = await prisma.$queryRaw<
    Array<{ date: string; total: bigint; amountExpected: number | null; amountPaid: number | null }>
  >(Prisma.sql`
    SELECT ${EVENT_DATE} AS date,
           COUNT(*) AS total,
           SUM(events.amount_expected) AS amountExpected,
           SUM(events.amount_paid) AS amountPaid
      FROM google_calendar_events events
      ${where}
     GROUP BY date
     ORDER BY date
  `);

  const totalsRow = await prisma.$queryRaw<
    Array<{ total: bigint; total_expected: number | null; total_paid: number | null }>
  >(Prisma.sql`
    SELECT COUNT(*) AS total,
           SUM(events.amount_expected) AS total_expected,
           SUM(events.amount_paid) AS total_paid
      FROM google_calendar_events events
      ${where}
  `);

  const calendarRows = await prisma.$queryRaw<Array<{ calendarId: string; total: bigint }>>(Prisma.sql`
    SELECT events.calendar_id AS calendarId,
           COUNT(*) AS total
      FROM google_calendar_events events
      ${where}
     GROUP BY events.calendar_id
     ORDER BY events.calendar_id
  `);

  const eventTypeRows = await prisma.$queryRaw<Array<{ eventType: string | null; total: bigint }>>(Prisma.sql`
    SELECT events.event_type AS eventType,
           COUNT(*) AS total
      FROM google_calendar_events events
      ${where}
     GROUP BY events.event_type
     ORDER BY events.event_type IS NULL, events.event_type
  `);

  const categoryRows = await prisma.$queryRaw<Array<{ category: string | null; total: bigint }>>(Prisma.sql`
    SELECT CASE WHEN events.category IS NULL OR events.category = '' THEN NULL ELSE events.category END AS category,
           COUNT(*) AS total
      FROM google_calendar_events events
      ${where}
     GROUP BY category
     ORDER BY category IS NULL, category
  `);

  const totalEvents = totalsRow.length ? Number(totalsRow[0].total ?? 0) : 0;
  const totalAmountExpected = totalsRow.length ? Number(totalsRow[0].total_expected ?? 0) : 0;
  const totalAmountPaid = totalsRow.length ? Number(totalsRow[0].total_paid ?? 0) : 0;

  return {
    totals: {
      events: totalEvents,
      days: dateRows.length,
      amountExpected: totalAmountExpected,
      amountPaid: totalAmountPaid,
    },
    aggregates: {
      byYear: yearRows.map((row: YearAggregateRow) => ({ year: Number(row.year), ...mapAggregateRow(row) })),
      byMonth: monthRows.map((row: MonthAggregateRow) => ({
        year: Number(row.year),
        month: Number(row.month),
        ...mapAggregateRow(row),
      })),
      byWeek: weekRows.map((row: WeekAggregateRow) => ({
        isoYear: Number(row.isoYear),
        isoWeek: Number(row.isoWeek),
        ...mapAggregateRow(row),
      })),
      byWeekday: weekdayRows
        .filter((row: WeekdayAggregateRow) => Number(row.weekday) <= 6)
        .map((row: WeekdayAggregateRow) => ({ weekday: Number(row.weekday), ...mapAggregateRow(row) })),
      byDate: dateRows.map((row: DateAggregateRow) => ({ date: String(row.date), ...mapAggregateRow(row) })),
    },
    available: {
      calendars: calendarRows.map((row) => ({ calendarId: String(row.calendarId), total: Number(row.total ?? 0) })),
      eventTypes: eventTypeRows.map((row) => ({
        eventType: row.eventType != null ? String(row.eventType) : null,
        total: Number(row.total ?? 0),
      })),
      categories: categoryRows.map((row) => ({
        category: row.category != null ? String(row.category) : null,
        total: Number(row.total ?? 0),
      })),
    },
  };
}

export async function getCalendarEventsByDate(
  filters: CalendarEventFilters,
  options: { maxDays?: number } = {}
): Promise<CalendarEventsByDateResult> {
  const maxDays = Math.min(Math.max(options.maxDays ?? 31, 1), 120);
  const where = buildWhereClause(filters);

  const dateRows = await prisma.$queryRaw<
    Array<{ date: string; total: bigint; amountExpected: number | null; amountPaid: number | null }>
  >(Prisma.sql`
    SELECT ${EVENT_DATE} AS date,
           COUNT(*) AS total,
           SUM(events.amount_expected) AS amountExpected,
           SUM(events.amount_paid) AS amountPaid
      FROM google_calendar_events events
      ${where}
     GROUP BY date
     ORDER BY date DESC
     LIMIT ${maxDays}
  `);

  if (!dateRows.length) {
    return {
      days: [],
      totals: {
        days: 0,
        events: 0,
        amountExpected: 0,
        amountPaid: 0,
      },
    };
  }

  const selectedDates = dateRows.map((row) => row.date);
  const whereWithDates = buildWhereClause({ ...filters, dates: selectedDates });

  const eventRows = await prisma.$queryRaw<
    Array<CalendarEventDetail & { event_date: string; event_date_time: string | null }>
  >(Prisma.sql`
    SELECT
        events.calendar_id AS calendarId,
        events.event_id AS eventId,
        events.event_status AS status,
        events.event_type AS eventType,
        events.summary,
        events.description,
        events.category,
        events.amount_expected AS amountExpected,
        events.amount_paid AS amountPaid,
        events.attended,
        events.dosage,
        events.treatment_stage AS treatmentStage,
        events.start_date AS startDate,
        events.start_date_time AS startDateTime,
        events.start_time_zone AS startTimeZone,
        events.end_date AS endDate,
        events.end_date_time AS endDateTime,
        events.end_time_zone AS endTimeZone,
        events.event_created_at AS eventCreatedAt,
        events.event_updated_at AS eventUpdatedAt,
        events.color_id AS colorId,
        events.location,
        events.transparency,
        events.visibility,
        events.hangout_link AS hangoutLink,
        events.raw_event AS rawEvent,
        ${EVENT_DATE} AS event_date,
        DATE_FORMAT(${EVENT_DATETIME}, '%Y-%m-%dT%H:%i:%s') AS event_date_time
      FROM google_calendar_events events
      ${whereWithDates}
     ORDER BY event_date DESC, ${EVENT_DATETIME} ASC, events.event_id ASC
  `);

  const grouped = new Map<string, CalendarEventDetail[]>();
  for (const row of eventRows) {
    const list = grouped.get(row.event_date) ?? [];
    list.push({
      calendarId: String(row.calendarId),
      eventId: String(row.eventId),
      status: row.status ? String(row.status) : null,
      eventType: row.eventType ? String(row.eventType) : null,
      category: row.category ? String(row.category) : null,
      summary: row.summary != null ? String(row.summary) : null,
      description: row.description != null ? String(row.description) : null,
      startDate: row.startDate ? dayjs(row.startDate).format("YYYY-MM-DD") : null,
      startDateTime: row.startDateTime ? dayjs(row.startDateTime).format("YYYY-MM-DDTHH:mm:ss") : null,
      startTimeZone: row.startTimeZone ? String(row.startTimeZone) : null,
      endDate: row.endDate ? dayjs(row.endDate).format("YYYY-MM-DD") : null,
      endDateTime: row.endDateTime ? dayjs(row.endDateTime).format("YYYY-MM-DDTHH:mm:ss") : null,
      endTimeZone: row.endTimeZone ? String(row.endTimeZone) : null,
      colorId: row.colorId ? String(row.colorId) : null,
      location: row.location != null ? String(row.location) : null,
      transparency: row.transparency != null ? String(row.transparency) : null,
      visibility: row.visibility != null ? String(row.visibility) : null,
      hangoutLink: row.hangoutLink != null ? String(row.hangoutLink) : null,
      eventDate: row.event_date,
      eventDateTime: row.event_date_time,
      eventCreatedAt: row.eventCreatedAt ? dayjs(row.eventCreatedAt).format("YYYY-MM-DD HH:mm:ss") : null,
      eventUpdatedAt: row.eventUpdatedAt ? dayjs(row.eventUpdatedAt).format("YYYY-MM-DD HH:mm:ss") : null,
      rawEvent: row.rawEvent ?? null,
      amountExpected: row.amountExpected ?? null,
      amountPaid: row.amountPaid ?? null,
      attended: row.attended ?? null,
      dosage: row.dosage ?? null,
      treatmentStage: row.treatmentStage ?? null,
    });
    grouped.set(row.event_date, list);
  }

  const days: CalendarEventsByDate[] = [];
  let totalEvents = 0;
  let totalExpected = 0;
  let totalPaid = 0;

  for (const dateRow of dateRows) {
    const dateKey = String(dateRow.date);
    const events = grouped.get(dateKey) ?? [];
    totalEvents += events.length;
    const amountExpected = Number(dateRow.amountExpected ?? 0);
    const amountPaid = Number(dateRow.amountPaid ?? 0);
    totalExpected += amountExpected;
    totalPaid += amountPaid;

    events.sort((a, b) => {
      if (!a.eventDateTime && !b.eventDateTime) return a.eventId.localeCompare(b.eventId);
      if (!a.eventDateTime) return -1;
      if (!b.eventDateTime) return 1;
      if (a.eventDateTime === b.eventDateTime) return a.eventId.localeCompare(b.eventId);
      return a.eventDateTime < b.eventDateTime ? -1 : 1;
    });

    days.push({
      date: dateKey,
      total: Number(dateRow.total ?? 0),
      events,
      amountExpected,
      amountPaid,
    });
  }

  return {
    days,
    totals: {
      days: days.length,
      events: totalEvents,
      amountExpected: totalExpected,
      amountPaid: totalPaid,
    },
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
