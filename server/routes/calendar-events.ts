import express from "express";
import type { ParsedQs } from "qs";

import { asyncHandler, authenticate, requireRole } from "../lib/index.js";
import {
  defaultDateRange,
  getCalendarAggregates,
  getCalendarEventsByDate,
  type CalendarEventFilters,
} from "../lib/google-calendar-queries.js";
import { syncGoogleCalendarOnce } from "../lib/google-calendar.js";
import { formatDateOnly, parseDateOnly } from "../lib/time.js";

type QueryValue = string | ParsedQs | (string | ParsedQs)[] | undefined;

function toStringValues(value: QueryValue): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function ensureArray(value: QueryValue): string[] | undefined {
  const values = toStringValues(value);
  if (!values.length) return undefined;
  const result = values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  return result.length ? result : undefined;
}

function normalizeDate(value: QueryValue): string | undefined {
  const [raw] = toStringValues(value);
  if (!raw) return undefined;
  const parsed = parseDateOnly(raw);
  return parsed ? formatDateOnly(parsed) : undefined;
}

function normalizeSearch(value: QueryValue): string | undefined {
  const [raw] = toStringValues(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 200);
}

function coerceMaxDays(value: QueryValue): number | undefined {
  const [raw] = toStringValues(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function buildFilters(query: ParsedQs): { filters: CalendarEventFilters; applied: Required<Pick<CalendarEventFilters, "from" | "to">> & {
  calendarIds: string[];
  eventTypes: string[];
  search?: string;
}; } {
  let from = normalizeDate(query.from);
  let to = normalizeDate(query.to);

  if (!from && to) {
    from = to;
  }
  if (!to && from) {
    to = from;
  }

  if (!from || !to) {
    const defaults = defaultDateRange();
    from = defaults.from;
    to = defaults.to;
  }

  const calendarIds = ensureArray(query.calendarId) ?? [];
  const eventTypes = ensureArray(query.eventType) ?? [];
  const search = normalizeSearch(query.search);

  return {
    filters: {
      from,
      to,
      calendarIds: calendarIds.length ? calendarIds : undefined,
      eventTypes: eventTypes.length ? eventTypes : undefined,
      search,
    },
    applied: {
      from,
      to,
      calendarIds,
      eventTypes,
      search,
    },
  };
}

export function registerCalendarEventRoutes(app: express.Express) {
  app.get(
    "/api/calendar/events/summary",
    authenticate,
    requireRole("VIEWER", "ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (req, res) => {
      const { filters, applied } = buildFilters(req.query);
      const aggregates = await getCalendarAggregates(filters);
      res.json({
        status: "ok",
        filters: applied,
        totals: aggregates.totals,
        aggregates: aggregates.aggregates,
        available: aggregates.available,
      });
    })
  );

  app.get(
    "/api/calendar/events/daily",
    authenticate,
    requireRole("VIEWER", "ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (req, res) => {
      const { filters, applied } = buildFilters(req.query);
      const maxDays = coerceMaxDays(req.query.maxDays);
      const events = await getCalendarEventsByDate(filters, { maxDays });
      res.json({
        status: "ok",
        filters: {
          ...applied,
          maxDays: maxDays ?? 31,
        },
        totals: events.totals,
        days: events.days,
      });
    })
  );

  app.post(
    "/api/calendar/events/sync",
    authenticate,
    requireRole("ADMIN", "GOD"),
    asyncHandler(async (_req, res) => {
      const result = await syncGoogleCalendarOnce();
      res.json({
        status: "ok",
        fetchedAt: result.payload.fetchedAt,
        events: result.payload.events.length,
        inserted: result.upsertResult.inserted,
        updated: result.upsertResult.updated,
        skipped: result.upsertResult.skipped,
      });
    })
  );
}
