import dayjs from "dayjs";
import type { RowDataPacket } from "mysql2";

import { getPool } from "../db.js";

const BASE_EVENTS_SELECT = `
  SELECT
    calendar_id,
    event_id,
    event_status,
    event_type,
    summary,
    description,
    start_date,
    start_date_time,
    start_time_zone,
    end_date,
    end_date_time,
    end_time_zone,
    event_created_at,
    event_updated_at,
    color_id,
    location,
    transparency,
    visibility,
    hangout_link,
    raw_event,
    last_synced_at,
    COALESCE(start_date_time, STR_TO_DATE(CONCAT(start_date, ' 00:00:00'), '%Y-%m-%d %H:%i:%s')) AS event_datetime,
    COALESCE(start_date, DATE(start_date_time)) AS event_date
  FROM google_calendar_events
`;

const NULL_EVENT_TYPE_TOKEN = "__NULL__";

export type CalendarEventFilters = {
  from?: string;
  to?: string;
  calendarIds?: string[];
  eventTypes?: string[];
  search?: string;
  dates?: string[];
};

export type CalendarAggregates = {
  byYear: Array<{ year: number; total: number }>;
  byMonth: Array<{ year: number; month: number; total: number }>;
  byWeek: Array<{ isoYear: number; isoWeek: number; total: number }>;
  byWeekday: Array<{ weekday: number; total: number }>;
  byDate: Array<{ date: string; total: number }>;
};

export type CalendarAvailableFilters = {
  calendars: Array<{ calendarId: string; total: number }>;
  eventTypes: Array<{ eventType: string | null; total: number }>;
};

export type CalendarAggregateResult = {
  totals: {
    events: number;
    days: number;
  };
  aggregates: CalendarAggregates;
  available: CalendarAvailableFilters;
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

export type CalendarEventsByDate = {
  date: string;
  total: number;
  events: CalendarEventDetail[];
};

export type CalendarEventsByDateResult = {
  days: CalendarEventsByDate[];
  totals: {
    days: number;
    events: number;
  };
};

function buildFilterClause(filters: CalendarEventFilters) {
  const conditions: string[] = ["events.event_datetime IS NOT NULL"];
  const params: unknown[] = [];

  if (filters.from) {
    conditions.push("events.event_datetime >= ?");
    params.push(`${filters.from} 00:00:00`);
  }

  if (filters.to) {
    conditions.push("events.event_datetime < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(filters.to);
  }

  if (filters.calendarIds?.length) {
    const placeholders = filters.calendarIds.map(() => "?").join(", ");
    conditions.push(`events.calendar_id IN (${placeholders})`);
    params.push(...filters.calendarIds);
  }

  if (filters.eventTypes?.length) {
    const includeNull = filters.eventTypes.includes(NULL_EVENT_TYPE_TOKEN);
    const explicitTypes = filters.eventTypes.filter((type) => type !== NULL_EVENT_TYPE_TOKEN);
    const clauses: string[] = [];

    if (explicitTypes.length) {
      const placeholders = explicitTypes.map(() => "?").join(", ");
      clauses.push(`events.event_type IN (${placeholders})`);
      params.push(...explicitTypes);
    }

    if (includeNull) {
      clauses.push("events.event_type IS NULL");
    }

    if (clauses.length) {
      conditions.push(`(${clauses.join(" OR ")})`);
    }
  }

  if (filters.search) {
    conditions.push("(events.summary LIKE ? OR events.description LIKE ?)");
    const pattern = `%${filters.search}%`;
    params.push(pattern, pattern);
  }

  if (filters.dates?.length) {
    const placeholders = filters.dates.map(() => "?").join(", ");
    conditions.push(`events.event_date IN (${placeholders})`);
    params.push(...filters.dates);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereClause, params };
}

export async function getCalendarAggregates(filters: CalendarEventFilters): Promise<CalendarAggregateResult> {
  const pool = getPool();
  const { whereClause, params } = buildFilterClause(filters);

  const [yearRows] = await pool.query<RowDataPacket[]>(
    `SELECT YEAR(events.event_datetime) AS year, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY YEAR(events.event_datetime)
     ORDER BY YEAR(events.event_datetime)`,
    [...params]
  );

  const [monthRows] = await pool.query<RowDataPacket[]>(
    `SELECT YEAR(events.event_datetime) AS year, MONTH(events.event_datetime) AS month, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY YEAR(events.event_datetime), MONTH(events.event_datetime)
     ORDER BY YEAR(events.event_datetime), MONTH(events.event_datetime)`,
    [...params]
  );

  const [weekRows] = await pool.query<RowDataPacket[]>(
    `SELECT
        CAST(DATE_FORMAT(events.event_datetime, '%x') AS UNSIGNED) AS isoYear,
        CAST(DATE_FORMAT(events.event_datetime, '%v') AS UNSIGNED) AS isoWeek,
        COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY isoYear, isoWeek
     ORDER BY isoYear, isoWeek`,
    [...params]
  );

  const [weekdayRows] = await pool.query<RowDataPacket[]>(
    `SELECT WEEKDAY(events.event_datetime) AS weekday, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY WEEKDAY(events.event_datetime)
     ORDER BY WEEKDAY(events.event_datetime)`,
    [...params]
  );

  const [dateRows] = await pool.query<RowDataPacket[]>(
    `SELECT events.event_date AS date, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY events.event_date
     ORDER BY events.event_date`,
    [...params]
  );

  const [totalRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}`,
    [...params]
  );

  const totalEvents = totalRows.length ? Number(totalRows[0].total ?? 0) : 0;

  const [calendarRows] = await pool.query<RowDataPacket[]>(
    `SELECT events.calendar_id AS calendarId, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY events.calendar_id
     ORDER BY events.calendar_id`,
    [...params]
  );

  const [eventTypeRows] = await pool.query<RowDataPacket[]>(
    `SELECT events.event_type AS eventType, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY events.event_type
     ORDER BY events.event_type IS NULL, events.event_type`,
    [...params]
  );

  return {
    totals: {
      events: totalEvents,
      days: dateRows.length,
    },
    aggregates: {
      byYear: yearRows.map((row) => ({ year: Number(row.year), total: Number(row.total) })),
      byMonth: monthRows.map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        total: Number(row.total),
      })),
      byWeek: weekRows.map((row) => ({
        isoYear: Number(row.isoYear),
        isoWeek: Number(row.isoWeek),
        total: Number(row.total),
      })),
      byWeekday: weekdayRows.map((row) => ({
        weekday: Number(row.weekday),
        total: Number(row.total),
      })),
      byDate: dateRows.map((row) => ({
        date: String(row.date),
        total: Number(row.total),
      })),
    },
    available: {
      calendars: calendarRows.map((row) => ({
        calendarId: String(row.calendarId),
        total: Number(row.total),
      })),
      eventTypes: eventTypeRows.map((row) => ({
        eventType: row.eventType != null ? String(row.eventType) : null,
        total: Number(row.total),
      })),
    },
  };
}

export async function getCalendarEventsByDate(
  filters: CalendarEventFilters,
  options: { maxDays?: number } = {}
): Promise<CalendarEventsByDateResult> {
  const pool = getPool();
  const maxDays = Math.min(Math.max(options.maxDays ?? 31, 1), 120);

  const { whereClause, params } = buildFilterClause(filters);

  const [dateRows] = await pool.query<RowDataPacket[]>(
    `SELECT events.event_date AS date, COUNT(*) AS total
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${whereClause}
     GROUP BY events.event_date
     ORDER BY events.event_date DESC
     LIMIT ?`,
    [...params, maxDays]
  );

  if (!dateRows.length) {
    return {
      days: [],
      totals: {
        days: 0,
        events: 0,
      },
    };
  }

  const selectedDates = dateRows.map((row) => String(row.date));

  const { whereClause: dateFilteredWhere, params: dateFilteredParams } = buildFilterClause({
    ...filters,
    dates: selectedDates,
  });

  const [eventRows] = await pool.query<RowDataPacket[]>(
    `SELECT
        events.calendar_id,
        events.event_id,
        events.event_status,
        events.event_type,
        events.summary,
        events.description,
        events.start_date,
        DATE_FORMAT(events.event_datetime, '%Y-%m-%dT%H:%i:%s') AS event_date_time,
        events.start_date_time,
        events.start_time_zone,
        events.end_date,
        events.end_date_time,
        events.end_time_zone,
        events.event_created_at,
        events.event_updated_at,
        events.color_id,
        events.location,
        events.transparency,
        events.visibility,
        events.hangout_link,
        events.raw_event,
        events.event_date
     FROM (${BASE_EVENTS_SELECT}) AS events
     ${dateFilteredWhere}
     ORDER BY events.event_date DESC, events.event_datetime ASC, events.event_id ASC`,
    [...dateFilteredParams]
  );

  const grouped = new Map<string, CalendarEventDetail[]>();

  for (const row of eventRows) {
    const date = String(row.event_date);
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    const raw = row.raw_event;
    let parsedRaw: unknown | null = null;
    if (raw != null) {
      if (typeof raw === "string") {
        try {
          parsedRaw = JSON.parse(raw);
        } catch {
          parsedRaw = raw;
        }
      } else {
        parsedRaw = raw;
      }
    }

    grouped.get(date)!.push({
      calendarId: String(row.calendar_id),
      eventId: String(row.event_id),
      status: row.event_status ? String(row.event_status) : null,
      eventType: row.event_type ? String(row.event_type) : null,
      summary: row.summary != null ? String(row.summary) : null,
      description: row.description != null ? String(row.description) : null,
      startDate: row.start_date != null ? String(row.start_date) : null,
      startDateTime: row.start_date_time != null ? String(row.start_date_time) : null,
      startTimeZone: row.start_time_zone != null ? String(row.start_time_zone) : null,
      endDate: row.end_date != null ? String(row.end_date) : null,
      endDateTime: row.end_date_time != null ? String(row.end_date_time) : null,
      endTimeZone: row.end_time_zone != null ? String(row.end_time_zone) : null,
      colorId: row.color_id != null ? String(row.color_id) : null,
      location: row.location != null ? String(row.location) : null,
      transparency: row.transparency != null ? String(row.transparency) : null,
      visibility: row.visibility != null ? String(row.visibility) : null,
      hangoutLink: row.hangout_link != null ? String(row.hangout_link) : null,
      eventDate: date,
      eventDateTime: row.event_date_time != null ? String(row.event_date_time) : null,
      eventCreatedAt: row.event_created_at != null ? String(row.event_created_at) : null,
      eventUpdatedAt: row.event_updated_at != null ? String(row.event_updated_at) : null,
      rawEvent: parsedRaw,
    });
  }

  const days: CalendarEventsByDate[] = [];
  let totalEvents = 0;

  const sortedDates = Array.from(grouped.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  for (const date of sortedDates) {
    const events = grouped.get(date) ?? [];
    totalEvents += events.length;
    events.sort((a, b) => {
      if (!a.eventDateTime && !b.eventDateTime) return a.eventId.localeCompare(b.eventId);
      if (!a.eventDateTime) return -1;
      if (!b.eventDateTime) return 1;
      if (a.eventDateTime === b.eventDateTime) {
        return a.eventId.localeCompare(b.eventId);
      }
      return a.eventDateTime < b.eventDateTime ? -1 : 1;
    });

    days.push({
      date,
      total: events.length,
      events,
    });
  }

  return {
    days,
    totals: {
      days: days.length,
      events: totalEvents,
    },
  };
}

export function defaultDateRange(): { from: string; to: string } {
  const today = dayjs().startOf("day");
  const from = today.subtract(30, "day");
  return {
    from: from.format("YYYY-MM-DD"),
    to: today.format("YYYY-MM-DD"),
  };
}
