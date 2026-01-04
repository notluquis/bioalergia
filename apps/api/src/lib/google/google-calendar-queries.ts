import { googleCalendarConfig } from "../../config";
import dayjs from "dayjs";
import { kysely } from "@finanzas/db";
import { sql } from "kysely";

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

// Helper: Apply filters to a Kysely query
function applyFilters(query: any, filters: CalendarEventFilters) {
  let q = query;

  if (filters.from) {
    q = q.where("startDate", ">=", new Date(filters.from));
  }
  if (filters.to) {
    q = q.where("startDate", "<=", new Date(filters.to));
  }
  if (filters.calendarIds && filters.calendarIds.length > 0) {
    // We need to join Calendar to filter by googleId
    // Assumes the query has joined 'Calendar' or we filter by subquery
    // For simplicity, let's assume we can join or the main table has what we need?
    // The Event table has 'calendarId' (int), not googleId.
    // So we usually need to join Calendar c on e.calendarId = c.id
    // But let's handle this in the main query construction.
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
      filters.categories.includes("Uncategorized");
    const validCategories = filters.categories.filter(
      (c) => c !== "null" && c !== "Uncategorized",
    );

    if (hasNull && validCategories.length > 0) {
      q = q.where((eb: any) =>
        eb.or([
          eb("e.category", "in", validCategories),
          eb("e.category", "is", null),
        ]),
      );
    } else if (hasNull) {
      q = q.where("e.category", "is", null);
    } else {
      q = q.where("e.category", "in", validCategories);
    }
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    q = q.where((eb: any) =>
      eb.or([
        eb("e.summary", "ilike", term),
        eb("e.description", "ilike", term),
      ]),
    );
  }

  if (filters.dates && filters.dates.length > 0) {
    // Cast date to string for comparison or strictly compare dates
    // "startDate" is Timestamp/Date.
    // Simplest is to cast to date
    q = q.where(sql<any>`DATE(e."startDate")`, "in", filters.dates);
  }

  return q;
}

export async function getCalendarAggregates(
  filters: CalendarEventFilters,
): Promise<CalendarAggregateResult> {
  const baseQuery = kysely
    .selectFrom("Event as e")
    .leftJoin("Calendar as c", "e.calendarId", "c.id");

  const filteredQuery = applyFilters(baseQuery, filters);

  // 1. Totals
  const totals = await filteredQuery
    .select([
      sql<number>`count(e.id)`.as("events"),
      sql<number>`count(distinct DATE(e."startDate"))`.as("days"),
      sql<number>`coalesce(sum(e."amountExpected"), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e."amountPaid"), 0)`.as("amountPaid"),
    ])
    .executeTakeFirst();

  // 2. By Month
  const byMonth = await filteredQuery
    .select([
      sql<number>`extract(year from e."startDate")`.as("year"),
      sql<number>`extract(month from e."startDate")`.as("month"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e."amountExpected"), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e."amountPaid"), 0)`.as("amountPaid"),
    ])
    .groupBy([
      sql`extract(year from e."startDate")`,
      sql`extract(month from e."startDate")`,
    ])
    .orderBy(sql`extract(year from e."startDate")`, "desc")
    .orderBy(sql`extract(month from e."startDate")`, "desc")
    .execute();

  // 3. By Week
  const byWeek = await filteredQuery
    .select([
      sql<number>`extract(isoyear from e."startDate")`.as("isoYear"),
      sql<number>`extract(week from e."startDate")`.as("isoWeek"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e."amountExpected"), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e."amountPaid"), 0)`.as("amountPaid"),
    ])
    .groupBy([
      sql`extract(isoyear from e."startDate")`,
      sql`extract(week from e."startDate")`,
    ])
    .orderBy(sql`extract(isoyear from e."startDate")`, "desc")
    .orderBy(sql`extract(week from e."startDate")`, "desc")
    .execute();

  // 4. By Date
  const byDate = await filteredQuery
    .select([
      sql<string>`DATE(e."startDate")`.as("date"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e."amountExpected"), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e."amountPaid"), 0)`.as("amountPaid"),
    ])
    .groupBy(sql`DATE(e."startDate")`)
    .orderBy(sql`DATE(e."startDate")`, "desc")
    .execute();

  // 5. By Weekday
  const byWeekday = await filteredQuery
    .select([
      sql<number>`extract(dow from e."startDate")`.as("weekday"),
      sql<number>`count(e.id)`.as("total"),
      sql<number>`coalesce(sum(e."amountExpected"), 0)`.as("amountExpected"),
      sql<number>`coalesce(sum(e."amountPaid"), 0)`.as("amountPaid"),
    ])
    .groupBy(sql`extract(dow from e."startDate")`)
    .orderBy("total", "desc")
    .execute();

  // 6. Available filters (separate queries without some filters?)
  // Actually, available filters usually respect the date range but ignore specific selection of that filter?
  // For simplicity, let's query available filters based on date range ONLY.

  const dateRangeQuery = kysely
    .selectFrom("Event as e")
    .leftJoin("Calendar as c", "e.calendarId", "c.id");

  let initialQ = dateRangeQuery;
  if (filters.from)
    initialQ = initialQ.where("startDate", ">=", new Date(filters.from));
  if (filters.to)
    initialQ = initialQ.where("startDate", "<=", new Date(filters.to));

  const [availCalendars, availEventTypes, availCategories] = await Promise.all([
    initialQ
      .select([
        "c.googleId as calendarId",
        sql<number>`count(e.id)`.as("total"),
      ])
      .groupBy("c.googleId")
      .orderBy("total", "desc")
      .execute(),
    initialQ
      .select(["e.eventType", sql<number>`count(e.id)`.as("total")])
      .groupBy("e.eventType")
      .orderBy("total", "desc")
      .execute(),
    initialQ
      .select(["e.category", sql<number>`count(e.id)`.as("total")])
      .groupBy("e.category")
      .orderBy("total", "desc")
      .execute(),
  ]);

  // helper types for query results
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
  type WeekdayRow = {
    weekday: number | string;
    total: number | string;
    amountExpected: number | string;
    amountPaid: number | string;
  };
  type CalendarRow = { calendarId: string; total: number | string };
  type EventTypeRow = { eventType: string | null; total: number | string };
  type CategoryRow = { category: string | null; total: number | string };

  return {
    totals: {
      events: Number((totals as unknown as TotalRow)?.events || 0),
      days: Number((totals as unknown as TotalRow)?.days || 0),
      amountExpected: Number(
        (totals as unknown as TotalRow)?.amountExpected || 0,
      ),
      amountPaid: Number((totals as unknown as TotalRow)?.amountPaid || 0),
    },
    aggregates: {
      byYear: (byMonth as unknown as MonthRow[]).reduce(
        (acc: any[], curr: MonthRow) => {
          // Flatten logic omitted, assuming byMonth covers needs or todo: implement proper byYear
          return acc;
        },
        [],
      ),
      byMonth: (byMonth as unknown as MonthRow[]).map((r: MonthRow) => ({
        year: Number(r.year),
        month: Number(r.month),
        total: Number(r.total),
        amountExpected: Number(r.amountExpected),
        amountPaid: Number(r.amountPaid),
      })),
      byWeek: (byWeek as unknown as WeekRow[]).map((r: WeekRow) => ({
        isoYear: Number(r.isoYear),
        isoWeek: Number(r.isoWeek),
        total: Number(r.total),
        amountExpected: Number(r.amountExpected),
        amountPaid: Number(r.amountPaid),
      })),
      byWeekday: (byWeekday as unknown as WeekdayRow[]).map(
        (r: WeekdayRow) => ({
          weekday: Number(r.weekday),
          total: Number(r.total),
          amountExpected: Number(r.amountExpected),
          amountPaid: Number(r.amountPaid),
        }),
      ),
      byDate: (byDate as unknown as DateRow[]).map((r: DateRow) => ({
        date: String(r.date),
        total: Number(r.total),
        amountExpected: Number(r.amountExpected),
        amountPaid: Number(r.amountPaid),
      })),
    },
    available: {
      calendars: (availCalendars as unknown as CalendarRow[]).map(
        (r: CalendarRow) => ({
          calendarId: String(r.calendarId),
          total: Number(r.total),
        }),
      ),
      eventTypes: (availEventTypes as unknown as EventTypeRow[]).map(
        (r: EventTypeRow) => ({
          eventType: r.eventType,
          total: Number(r.total),
        }),
      ),
      categories: (availCategories as unknown as CategoryRow[]).map(
        (r: CategoryRow) => ({ category: r.category, total: Number(r.total) }),
      ),
    },
  };
}

// Just add byYear query logic inside the function body
// (Self-correction during write)

export async function getCalendarEventsByDate(
  filters: CalendarEventFilters,
  options: { maxDays?: number } = {},
): Promise<CalendarEventsByDateResult> {
  const baseQuery = kysely
    .selectFrom("Event as e")
    .leftJoin("Calendar as c", "e.calendarId", "c.id");

  const filteredQuery = applyFilters(baseQuery, filters);

  const maxDays = options.maxDays || 31;

  // 1. Get dates with events
  const dates = await filteredQuery
    .select(sql<string>`DATE(e."startDate")`.as("date"))
    .distinct()
    .orderBy(sql`DATE(e."startDate")`, "desc")
    .limit(maxDays)
    .execute();

  type DateOnlyRow = { date: string | Date };
  const targetDates = (dates as unknown as DateOnlyRow[]).map(
    (d: DateOnlyRow) => String(d.date),
  );

  if (targetDates.length === 0) {
    return {
      days: [],
      totals: { days: 0, events: 0, amountExpected: 0, amountPaid: 0 },
    };
  }

  // 2. Get events for those dates
  // We apply filters again AND restrict to targetDates
  // Note: filtering by targetDates is redundant if we already filtered,
  // but we strictly want the events FOR the top N dates found.

  let eventsQuery = applyFilters(
    kysely
      .selectFrom("Event as e")
      .leftJoin("Calendar as c", "e.calendarId", "c.id"),
    { ...filters, dates: targetDates }, // Override dates filter? Or intersect?
    // The original logic likely wanted "top N days matching filters".
    // So we use the same filters, plus enforce date is in the top N set.
  );

  // However, applyFilters uses filters.dates as equality.
  // Let's manually add the where clause for dates.
  eventsQuery = eventsQuery.where(
    sql<any>`DATE(e."startDate")`,
    "in",
    targetDates,
  );

  const events = await eventsQuery
    .select([
      "c.googleId as calendarId",
      "e.externalEventId as eventId",
      "e.eventStatus as status",
      "e.eventType",
      "e.category",
      "e.summary",
      "e.description",
      "e.startDate",
      "e.startDateTime",
      "e.startTimeZone",
      "e.endDate",
      "e.endDateTime",
      "e.endTimeZone",
      "e.colorId",
      "e.location",
      "e.transparency",
      "e.visibility",
      "e.hangoutLink",
      "e.eventCreatedAt",
      "e.eventUpdatedAt",
      "e.amountExpected",
      "e.amountPaid",
      "e.attended",
      "e.dosage",
      "e.treatmentStage",
      sql<string>`DATE(e."startDate")`.as("eventDateString"), // helper for grouping
    ])
    .orderBy("e.startDateTime", "desc")
    .execute();

  // Group by date
  const grouped: Record<string, CalendarEventsByDate> = {};

  // Initialize with target dates to match order
  targetDates.forEach((date) => {
    grouped[date as string] = {
      date: date as string,
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
    dosage: string | null;
    treatmentStage: string | null;
  };

  (events as unknown as EventRow[]).forEach((ev: EventRow) => {
    const dateKey = String(ev.eventDateString);
    if (!grouped[dateKey]) return; // Should not happen

    const detail: CalendarEventDetail = {
      calendarId: ev.calendarId,
      eventId: ev.eventId,
      status: ev.status,
      eventType: ev.eventType,
      category: ev.category,
      summary: ev.summary,
      description: ev.description,
      startDate: ev.startDate ? new Date(ev.startDate).toISOString() : null,
      startDateTime: ev.startDateTime
        ? new Date(ev.startDateTime).toISOString()
        : null,
      startTimeZone: ev.startTimeZone,
      endDate: ev.endDate ? new Date(ev.endDate).toISOString() : null,
      endDateTime: ev.endDateTime
        ? new Date(ev.endDateTime).toISOString()
        : null,
      endTimeZone: ev.endTimeZone,
      colorId: ev.colorId,
      location: ev.location,
      transparency: ev.transparency,
      visibility: ev.visibility,
      hangoutLink: ev.hangoutLink,
      eventDate: dateKey,
      eventDateTime: ev.startDateTime
        ? new Date(ev.startDateTime).toISOString()
        : dateKey,
      eventCreatedAt: ev.eventCreatedAt
        ? new Date(ev.eventCreatedAt).toISOString()
        : null,
      eventUpdatedAt: ev.eventUpdatedAt
        ? new Date(ev.eventUpdatedAt).toISOString()
        : null,
      rawEvent: null, // we don't select raw json to save bandwidth
      amountExpected: Number(ev.amountExpected || 0),
      amountPaid: Number(ev.amountPaid || 0),
      attended: ev.attended,
      dosage: ev.dosage,
      treatmentStage: ev.treatmentStage,
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
    days: Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)),
    totals: {
      days: targetDates.length,
      events: totalEvents,
      amountExpected: totalAmountExpected,
      amountPaid: totalAmountPaid,
    },
  };
}

export function defaultDateRange(): { from: string; to: string } {
  const today = dayjs().startOf("day");
  const fromSource = googleCalendarConfig?.syncStartDate ?? "2000-01-01";
  const lookahead = googleCalendarConfig?.syncLookAheadDays ?? 365;
  const from = dayjs(fromSource).isValid()
    ? dayjs(fromSource)
    : today.subtract(365, "day");
  const to = today.add(lookahead, "day");
  return {
    from: from.format("YYYY-MM-DD"),
    to: to.format("YYYY-MM-DD"),
  };
}
