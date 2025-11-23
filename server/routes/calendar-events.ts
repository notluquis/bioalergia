import express from "express";
import type { ParsedQs } from "qs";
import dayjs from "dayjs";

import { asyncHandler, authenticate, requireRole } from "../lib/index.js";
import {
  getCalendarAggregates,
  getCalendarEventsByDate,
  type CalendarEventFilters,
} from "../lib/google-calendar-queries.js";
import { syncGoogleCalendarOnce } from "../lib/google-calendar.js";
import { formatDateOnly, parseDateOnly } from "../lib/time.js";
import {
  loadSettings,
  createCalendarSyncLogEntry,
  finalizeCalendarSyncLogEntry,
  listCalendarSyncLogs,
  listUnclassifiedCalendarEvents,
  updateCalendarEventClassification,
} from "../services/calendar.js";
import { Prisma } from "../../generated/prisma/client.js";
import { googleCalendarConfig } from "../config.js";
import { z } from "zod";

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

async function buildFilters(query: ParsedQs) {
  const settings = await loadSettings();
  const configStart = settings.calendarSyncStart?.trim() || googleCalendarConfig?.syncStartDate || "2000-01-01";

  const baseStart = configStart;
  const lookaheadRaw = Number(settings.calendarSyncLookaheadDays ?? "365");
  const lookaheadDays =
    Number.isFinite(lookaheadRaw) && lookaheadRaw > 0 ? Math.min(Math.floor(lookaheadRaw), 1095) : 365;
  const defaultEnd = dayjs().add(lookaheadDays, "day").format("YYYY-MM-DD");

  let from = normalizeDate(query.from) ?? baseStart;
  let to = normalizeDate(query.to) ?? defaultEnd;

  if (dayjs(from).isAfter(dayjs(to))) {
    to = from;
  }

  const calendarIds = ensureArray(query.calendarId) ?? [];
  const eventTypes = ensureArray(query.eventType) ?? [];
  const categories = ensureArray(query.category) ?? [];
  const search = normalizeSearch(query.search);

  const defaultMaxDays = Number(settings.calendarDailyMaxDays ?? "31");
  const maxDaysInput = coerceMaxDays(query.maxDays);
  const maxDays =
    maxDaysInput ??
    (Number.isFinite(defaultMaxDays) && defaultMaxDays > 0 ? Math.min(Math.floor(defaultMaxDays), 120) : 31);

  const filters: CalendarEventFilters = {
    from,
    to,
    calendarIds: calendarIds.length ? calendarIds : undefined,
    eventTypes: eventTypes.length ? eventTypes : undefined,
    categories: categories.length ? categories : undefined,
    search,
  };

  return {
    filters,
    applied: {
      from,
      to,
      calendarIds,
      eventTypes,
      categories,
      search,
    },
    maxDays,
  };
}

export function registerCalendarEventRoutes(app: express.Express) {
  app.get(
    "/api/calendar/events/summary",
    authenticate,
    requireRole("VIEWER", "ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (req, res) => {
      const { filters, applied } = await buildFilters(req.query);
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
      const { filters, applied, maxDays } = await buildFilters(req.query);
      const events = await getCalendarEventsByDate(filters, { maxDays });
      res.json({
        status: "ok",
        filters: {
          ...applied,
          maxDays,
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
    asyncHandler(async (req, res) => {
      const logId = await createCalendarSyncLogEntry({
        triggerSource: "manual",
        triggerUserId: req.auth?.userId ?? null,
        triggerLabel: req.auth?.email ?? null,
      });

      try {
        const result = await syncGoogleCalendarOnce();
        const steps = [
          {
            id: "fetch",
            label: "Consultando Google Calendar",
            durationMs: Math.round(result.metrics.fetchDurationMs),
            details: {
              calendars: result.payload.calendars.length,
              events: result.payload.events.length,
            },
          },
          {
            id: "upsert",
            label: "Actualizando base de datos",
            durationMs: Math.round(result.metrics.upsertDurationMs),
            details: {
              inserted: result.upsertResult.inserted,
              updated: result.upsertResult.updated,
            },
          },
          {
            id: "exclude",
            label: "Eliminando eventos excluidos",
            durationMs: Math.round(result.metrics.removeDurationMs),
            details: {
              excluded: result.payload.excludedEvents.length,
            },
          },
          {
            id: "snapshot",
            label: "Guardando snapshot",
            durationMs: Math.round(result.metrics.snapshotDurationMs),
            details: {
              stored: true,
            },
          },
        ];
        await finalizeCalendarSyncLogEntry(logId, {
          status: "SUCCESS",
          fetchedAt: new Date(result.payload.fetchedAt),
          inserted: result.upsertResult.inserted,
          updated: result.upsertResult.updated,
          skipped: result.upsertResult.skipped,
          excluded: result.payload.excludedEvents.length,
        });

        res.json({
          status: "ok",
          fetchedAt: result.payload.fetchedAt,
          events: result.payload.events.length,
          inserted: result.upsertResult.inserted,
          updated: result.upsertResult.updated,
          skipped: result.upsertResult.skipped,
          excluded: result.payload.excludedEvents.length,
          logId,
          steps,
          totalDurationMs: Math.round(result.metrics.totalDurationMs),
        });
      } catch (error) {
        await finalizeCalendarSyncLogEntry(logId, {
          status: "ERROR",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    })
  );

  app.get(
    "/api/calendar/events/sync/logs",
    authenticate,
    requireRole("VIEWER", "ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (_req, res) => {
      const logs = await listCalendarSyncLogs(50);
      res.json({
        status: "ok",
        logs: logs.map(
          (log: {
            id: bigint;
            triggerSource: string;
            triggerUserId: bigint | null;
            triggerLabel: string | null;
            status: string;
            startedAt: Date;
            finishedAt: Date | null;
            fetchedAt: Date | null;
            inserted: number | null;
            updated: number | null;
            skipped: number | null;
            excluded: number | null;
            errorMessage: string | null;
          }) => ({
            id: Number(log.id),
            triggerSource: log.triggerSource,
            triggerUserId: log.triggerUserId != null ? Number(log.triggerUserId) : null,
            triggerLabel: log.triggerLabel ?? null,
            status: log.status,
            startedAt: log.startedAt,
            finishedAt: log.finishedAt,
            fetchedAt: log.fetchedAt,
            inserted: Number(log.inserted ?? 0),
            updated: Number(log.updated ?? 0),
            skipped: Number(log.skipped ?? 0),
            excluded: Number(log.excluded ?? 0),
            errorMessage: log.errorMessage ?? null,
          })
        ),
      });
    })
  );

  app.get(
    "/api/calendar/events/unclassified",
    authenticate,
    requireRole("ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (req, res) => {
      const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limitRaw = limitParam ? Number.parseInt(String(limitParam), 10) : 50;
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
      const rows = await listUnclassifiedCalendarEvents(limit);
      res.json({
        status: "ok",
        events: rows.map((row: Prisma.EventGetPayload<{ include: { calendar: true } }>) => ({
          calendarId: row.calendar.googleId,
          eventId: row.externalEventId,
          status: row.eventStatus ?? null,
          eventType: row.eventType ?? null,
          summary: row.summary ?? null,
          description: row.description ?? null,
          startDate: row.startDate ? row.startDate.toISOString() : null,
          startDateTime: row.startDateTime ? row.startDateTime.toISOString() : null,
          endDate: row.endDate ? row.endDate.toISOString() : null,
          endDateTime: row.endDateTime ? row.endDateTime.toISOString() : null,
          category: row.category ?? null,
          amountExpected: row.amountExpected ?? null,
          amountPaid: row.amountPaid ?? null,
          attended: row.attended ?? null,
          dosage: row.dosage ?? null,
          treatmentStage: row.treatmentStage ?? null,
        })),
      });
    })
  );

  const amountSchema = z
    .union([z.number(), z.string(), z.null()])
    .transform((value) => {
      if (value == null) return null;
      if (typeof value === "number") {
        if (!Number.isFinite(value)) return Number.NaN;
        return Math.trunc(value);
      }
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        return Number.NaN;
      }
      return parsed;
    })
    .refine((value) => value == null || (Number.isInteger(value) && value >= 0 && value <= 100_000_000), {
      message: "Monto inválido",
    })
    .optional();

  const updateClassificationSchema = z.object({
    calendarId: z.string().min(1).max(200),
    eventId: z.string().min(1).max(200),
    category: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .or(z.literal(""))
      .nullable()
      .optional()
      .transform((value) => {
        if (value == null) return null;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
      }),
    amountExpected: amountSchema,
    amountPaid: amountSchema,
    attended: z.boolean().nullable().optional(),
    dosage: z
      .string()
      .trim()
      .max(64)
      .nullish()
      .transform((value) => (value && value.length ? value : null)),
    treatmentStage: z
      .string()
      .trim()
      .max(64)
      .nullish()
      .transform((value) => (value && value.length ? value : null)),
  });

  app.post(
    "/api/calendar/events/classify",
    authenticate,
    requireRole("ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (req, res) => {
      const parsed = updateClassificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: "error",
          error: "Payload inválido",
          details: parsed.error.flatten(),
        });
        return;
      }

      const payload = parsed.data;

      await updateCalendarEventClassification(payload.calendarId, payload.eventId, {
        category: payload.category ?? null,
        amountExpected: payload.amountExpected ?? null,
        amountPaid: payload.amountPaid ?? null,
        attended: payload.attended ?? null,
        dosage: payload.dosage ?? null,
        treatmentStage: payload.treatmentStage ?? null,
      });

      res.json({ status: "ok" });
    })
  );
}
