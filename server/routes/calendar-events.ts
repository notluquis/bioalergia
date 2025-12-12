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
import { prisma } from "../prisma.js";

import {
  loadSettings,
  createCalendarSyncLogEntry,
  finalizeCalendarSyncLogEntry,
  listCalendarSyncLogs,
  listUnclassifiedCalendarEvents,
  updateCalendarEventClassification,
  type UnclassifiedEvent,
} from "../services/calendar.js";
import {
  ensureArray,
  normalizeSearch,
  coercePositiveInteger,
  normalizeDate,
  type QueryValue,
} from "../lib/query-helpers.js";
import { googleCalendarConfig } from "../config.js";
import { updateClassificationSchema } from "../schemas.js";

function coerceMaxDays(value: QueryValue): number | undefined {
  return coercePositiveInteger(value);
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
      let logId: number | null = null;

      try {
        logId = await createCalendarSyncLogEntry({
          triggerSource: "manual",
          triggerUserId: req.auth?.userId ?? null,
          triggerLabel: req.auth?.email ?? null,
        });

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
        // Si hubo un error, marcar el log como ERROR
        if (logId) {
          await finalizeCalendarSyncLogEntry(logId, {
            status: "ERROR",
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
        throw error; // Re-throw para que asyncHandler lo maneje
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
            triggerUserId: number | null;
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
        events: rows.map((row: UnclassifiedEvent) => ({
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

  app.get(
    "/api/calendar/calendars",
    authenticate,
    requireRole("VIEWER", "ANALYST", "ADMIN", "GOD"),
    asyncHandler(async (_req, res) => {
      const calendars = await prisma.calendar.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          googleId: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              events: true,
            },
          },
        },
      });

      res.json({
        status: "ok",
        calendars: calendars.map((cal) => ({
          id: cal.id,
          googleId: cal.googleId,
          name: cal.name ?? "Sin nombre",
          eventCount: cal._count.events,
          createdAt: cal.createdAt.toISOString(),
          updatedAt: cal.updatedAt.toISOString(),
        })),
      });
    })
  );

  // Webhook endpoint for Google Calendar push notifications
  // Does NOT require authentication (Google will call this)
  app.post(
    "/api/calendar/webhook",
    express.raw({ type: "application/json" }),
    asyncHandler(async (req, res) => {
      const channelId = req.headers["x-goog-channel-id"] as string | undefined;
      const resourceState = req.headers["x-goog-resource-state"] as string | undefined;
      const resourceId = req.headers["x-goog-resource-id"] as string | undefined;

      // Log webhook received
      console.log("Calendar webhook received", {
        channelId,
        resourceState,
        resourceId,
        headers: req.headers,
      });

      // Verify channel exists in database
      if (!channelId || !resourceId) {
        console.warn("Missing channelId or resourceId in webhook headers");
        res.status(400).json({ error: "Missing required headers" });
        return;
      }

      // Handle different resource states
      if (resourceState === "sync") {
        // Initial verification request from Google
        console.log("Webhook sync verification", { channelId });
        res.status(200).end();
        return;
      }

      if (resourceState === "exists") {
        // Calendar has changes - trigger sync
        console.log("Webhook exists notification - queueing sync", { channelId, resourceId });

        // Queue sync job (don't await - respond immediately to Google)
        syncGoogleCalendarOnce()
          .then(() => {
            console.log("Webhook-triggered sync completed", { channelId });
          })
          .catch((err) => {
            console.error("Webhook-triggered sync failed", err, { channelId });
          });

        res.status(200).end();
        return;
      }

      // Unknown state
      console.log("Unknown webhook resource state", { resourceState, channelId });
      res.status(200).end();
    })
  );
}
