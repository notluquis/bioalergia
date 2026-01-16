import { reply } from "../utils/reply";
import { Hono, type Context } from "hono";
import { getSessionUser, type AuthSession, hasPermission } from "../auth";

import dayjs from "dayjs";
import {
  getCalendarAggregates,
  getCalendarEventsByDate,
  type CalendarEventFilters,
} from "../lib/google/google-calendar-queries";
import { syncGoogleCalendarOnce } from "../lib/google/google-calendar";
import { db } from "@finanzas/db";
import {
  createCalendarSyncLogEntry,
  finalizeCalendarSyncLogEntry,
  listCalendarSyncLogs,
  listUnclassifiedCalendarEvents,
  updateCalendarEventClassification,
  type UnclassifiedEvent,
  loadSettings,
} from "../services/calendar";

import {
  CATEGORY_CHOICES,
  TREATMENT_STAGE_CHOICES,
  isIgnoredEvent,
  parseCalendarMetadata,
} from "../lib/parsers";

import { updateClassificationSchema, settingsSchema } from "../lib/schemas";
import { googleCalendarConfig } from "../config";

export const calendarRoutes = new Hono();

// Helper to coerce array
function ensureArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

// Helper to normalize search
function normalizeSearch(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value.trim() || undefined;
}

// Helper to normalize date
function normalizeDate(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) return undefined;
  const val = Array.isArray(value) ? value[0] : value;
  if (!val || !dayjs(val).isValid()) return undefined;
  return dayjs(val).format("YYYY-MM-DD");
}

function coercePositiveInteger(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : undefined;
}

async function buildFilters(
  query: Record<string, string | string[] | undefined>,
) {
  const settings = await loadSettings();
  const configStart =
    settings["calendar.syncStart"]?.trim() ||
    googleCalendarConfig?.syncStartDate ||
    "2000-01-01";

  const baseStart = configStart;
  const lookaheadRaw = Number(settings["calendar.syncLookaheadDays"] ?? "365");
  const lookaheadDays =
    Number.isFinite(lookaheadRaw) && lookaheadRaw > 0
      ? Math.min(Math.floor(lookaheadRaw), 1095)
      : 365;
  const defaultEnd = dayjs().add(lookaheadDays, "day").format("YYYY-MM-DD");

  let from = normalizeDate(query.from) ?? baseStart;
  let to = normalizeDate(query.to) ?? defaultEnd;

  if (dayjs(from).isAfter(dayjs(to))) {
    to = from;
  }

  const calendarIds = ensureArray(query.calendarId);
  const eventTypes = ensureArray(query.eventType);
  const categories = ensureArray(query.category);
  const search = normalizeSearch(query.search);

  const defaultMaxDays = Number(settings["calendar.dailyMaxDays"] ?? "31");
  const maxDaysInput = coercePositiveInteger(query.maxDays);
  const maxDays =
    maxDaysInput ??
    (Number.isFinite(defaultMaxDays) && defaultMaxDays > 0
      ? Math.min(Math.floor(defaultMaxDays), 120)
      : 31);

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

// Middleware to require auth
const requireAuth = async (c: Context, next: any) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }
  c.set("user", user);
  await next();
};

// ============================================================
// AGGREGATES
// ============================================================
calendarRoutes.get("/events/summary", requireAuth, async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canReadSchedule = await hasPermission(
    user.id,
    "read",
    "CalendarSchedule",
  );
  const canReadHeatmap = await hasPermission(
    user.id,
    "read",
    "CalendarHeatmap",
  );
  const canReadEvents = await hasPermission(user.id, "read", "CalendarEvent"); // Legacy/Broad

  if (!canReadSchedule && !canReadHeatmap && !canReadEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { filters, applied } = await buildFilters(c.req.query());
  const aggregates = await getCalendarAggregates(filters);
  return reply(c, {
    status: "ok",
    filters: applied,
    totals: aggregates.totals,
    aggregates: aggregates.aggregates,
    available: aggregates.available,
  });
});

// ============================================================
// DAILY EVENTS
// ============================================================
calendarRoutes.get("/events/daily", requireAuth, async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canReadDaily = await hasPermission(user.id, "read", "CalendarDaily");
  const canReadEvents = await hasPermission(user.id, "read", "CalendarEvent"); // Legacy/Broad

  if (!canReadDaily && !canReadEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { filters, applied, maxDays } = await buildFilters(c.req.query());
  const events = await getCalendarEventsByDate(filters, { maxDays });
  return reply(c, {
    status: "ok",
    filters: {
      ...applied,
      maxDays,
    },
    totals: events.totals,
    days: events.days,
  });
});

// ============================================================
// SYNC
// ============================================================
calendarRoutes.post("/events/sync", requireAuth, async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canSync = await hasPermission(user.id, "update", "CalendarSetting");
  // Also allow if they can manage events broadly, though strictly it's a setting op
  const canManageEvents = await hasPermission(
    user.id,
    "update",
    "CalendarEvent",
  );

  if (!canSync && !canManageEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  // Create log entry first
  const logId = await createCalendarSyncLogEntry({
    triggerSource: "manual",
    triggerUserId: user.id,
    triggerLabel: user.email,
  });

  // Start sync in background (fire and forget)
  syncGoogleCalendarOnce()
    .then(async (result) => {
      // Build excluded summaries form payload
      const excludedSummaries = result.payload.excludedEvents
        .slice(0, 20)
        .map((e) => e.summary?.slice(0, 50) || "(sin título)");

      await finalizeCalendarSyncLogEntry(logId, {
        status: "SUCCESS",
        fetchedAt: new Date(result.payload.fetchedAt),
        inserted: result.upsertResult.inserted,
        updated: result.upsertResult.updated,
        skipped: result.upsertResult.skipped,
        excluded: result.payload.excludedEvents.length,
        changeDetails: {
          inserted: result.upsertResult.details.inserted,
          updated: result.upsertResult.details.updated,
          excluded: excludedSummaries,
        },
      });
      console.log(`✅ Sync completed successfully (logId: ${logId})`);
    })
    .catch(async (error) => {
      await finalizeCalendarSyncLogEntry(logId, {
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      console.error(`❌ Sync failed (logId: ${logId}):`, error);
    });

  return reply(
    c,
    {
      status: "accepted",
      message: "Sincronización iniciada en segundo plano",
      logId,
    },
    202,
  );
});

// ============================================================
// SYNC LOGS
// ============================================================
calendarRoutes.get("/events/sync/logs", requireAuth, async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canReadLogs = await hasPermission(user.id, "read", "CalendarSyncLog");
  const canReadSettings = await hasPermission(
    user.id,
    "update",
    "CalendarSetting",
  ); // Settings page shows logs

  if (!canReadLogs && !canReadSettings) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const logs = await listCalendarSyncLogs(50);
  return reply(c, {
    status: "ok",
    logs: logs.map((log: any) => ({
      id: Number(log.id),
      triggerSource: log.triggerSource,
      triggerUserId:
        log.triggerUserId != null ? Number(log.triggerUserId) : null,
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
      changeDetails: log.changeDetails,
    })),
  });
});

// ============================================================
// CLASSIFICATION OPTIONS
// ============================================================
calendarRoutes.get("/classification-options", async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  // Allow if user has ANY calendar read capability
  const canReadSchedule = await hasPermission(
    user.id,
    "read",
    "CalendarSchedule",
  );
  const canReadDaily = await hasPermission(user.id, "read", "CalendarDaily");
  const canReadEvents = await hasPermission(user.id, "read", "CalendarEvent");

  if (!canReadSchedule && !canReadDaily && !canReadEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  return reply(c, {
    status: "ok",
    categories: CATEGORY_CHOICES,
    treatmentStages: TREATMENT_STAGE_CHOICES,
  });
});

// ============================================================
// UNCLASSIFIED EVENTS
// ============================================================
calendarRoutes.get("/events/unclassified", requireAuth, async (c: Context) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canUpdateEvents = await hasPermission(
    user.id,
    "update",
    "CalendarEvent",
  );

  if (!canUpdateEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const query = c.req.query();
  const limitParam = query.limit;
  const limitRaw = limitParam
    ? Number.parseInt(
        String(Array.isArray(limitParam) ? limitParam[0] : limitParam),
        10,
      )
    : 50;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 500)
    : 50;

  const offsetParam = query.offset;
  const offsetRaw = offsetParam
    ? Number.parseInt(
        String(Array.isArray(offsetParam) ? offsetParam[0] : offsetParam),
        10,
      )
    : 0;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const filterModeParam = query.filterMode;
  const filterMode = filterModeParam === "AND" ? "AND" : "OR";

  const filters = {
    category: query.missingCategory === "true",
    amountExpected: query.missingAmount === "true",
    attended: query.missingAttended === "true",
    dosage: query.missingDosage === "true",
    treatmentStage: query.missingTreatmentStage === "true",
    filterMode: filterMode as "AND" | "OR",
  };

  const hasFilters = Object.values(filters)
    .filter((v) => typeof v === "boolean")
    .some(Boolean);

  const { events: rows, totalCount } = await listUnclassifiedCalendarEvents(
    limit,
    offset,
    hasFilters ? filters : undefined,
  );

  const filteredRows = rows.filter(
    (row: UnclassifiedEvent) => !isIgnoredEvent(row.summary),
  );

  return reply(c, {
    status: "ok",
    totalCount,
    events: filteredRows.map((row: UnclassifiedEvent) => ({
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
});

// ============================================================
// CLASSIFY EVENT
// ============================================================
// ============================================================
// CLASSIFY EVENT
// ============================================================
calendarRoutes.post("/events/classify", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canClassify = await hasPermission(user.id, "update", "CalendarEvent");

  if (!canClassify) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateClassificationSchema.safeParse(body);
  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        error: "Payload inválido",
        details: parsed.error.flatten(),
      },
      400,
    );
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

  return reply(c, { status: "ok" });
});

// ============================================================
// LIST CALENDARS
// ============================================================
// GET /api/calendar/calendars
calendarRoutes.get("/calendars", async (c) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  // Allow if they have any broad listing/settings access
  const canReadSchedule = await hasPermission(
    user.id,
    "read",
    "CalendarSchedule",
  );
  const canReadSettings = await hasPermission(
    user.id,
    "update",
    "CalendarSetting",
  );
  const canReadEvents = await hasPermission(user.id, "read", "CalendarEvent");

  if (!canReadSchedule && !canReadSettings && !canReadEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  /* eslint-disable-next-line @typescript-eslint/consistent-type-definitions */
  type CalendarWithCount = Awaited<
    ReturnType<typeof db.calendar.findMany>
  >[number] & {
    _count: { events: number };
  };

  const calendars = (await db.calendar.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          events: true,
        },
      },
    },
  })) as unknown as CalendarWithCount[];

  return reply(c, {
    status: "ok",
    calendars: calendars.map((cal: any) => ({
      id: cal.id,
      googleId: cal.googleId,
      name: cal.name ?? "Sin nombre",
      eventCount: cal._count.events,
      createdAt: cal.createdAt.toISOString(),
      updatedAt: cal.updatedAt.toISOString(),
    })),
  });
});

// ============================================================
// LIST EVENTS
// ============================================================
calendarRoutes.get("/calendars/:calendarId/events", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canReadSchedule = await hasPermission(
    user.id,
    "read",
    "CalendarSchedule",
  );
  const canReadDaily = await hasPermission(user.id, "read", "CalendarDaily");
  const canReadEvents = await hasPermission(user.id, "read", "CalendarEvent");

  if (!canReadSchedule && !canReadDaily && !canReadEvents) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const calendarId = c.req.param("calendarId");
  const query = c.req.query();

  // Find calendar ID by googleId (which is what we use in URL usually)
  // or id? Route parameter is :id, usually database ID or google ID?
  // Let's assume googleId for compatibility with frontend?
  // But wait, frontend passes ID.
  // Code uses `db.calendar.findUnique({ where: { googleId: calendarId } })`.
  const calendar = await db.calendar.findUnique({
    where: { googleId: calendarId },
  });

  if (!calendar) {
    return reply(c, { status: "error", message: "Calendar not found" }, 404);
  }

  const startParam = query.start;
  const endParam = query.end;

  if (!startParam || !endParam) {
    return reply(
      c,
      { status: "error", message: "Missing start or end date" },
      400,
    );
  }

  const start = new Date(startParam);
  const end = new Date(endParam);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return reply(
      c,
      { status: "error", message: "Invalid start or end date" },
      400,
    );
  }

  const filterConditions: {
    category?: string;
    treatmentStage?: string;
    attended?: boolean;
  } = {};

  if (query.category) {
    filterConditions.category = query.category;
  }
  if (query.treatmentStage) {
    filterConditions.treatmentStage = query.treatmentStage;
  }
  if (query.attended) {
    filterConditions.attended = query.attended === "true";
  }

  // Fetch events from DB (internal copy)
  // Support both all-day events (startDate) and timed events (startDateTime)
  const events = await db.event.findMany({
    where: {
      calendarId: calendar.id,
      OR: [
        {
          startDateTime: {
            gte: start,
            lte: end,
          },
        },
        {
          startDate: {
            gte: start,
            lte: end,
          },
        },
      ],
      ...filterConditions,
    },
    orderBy: [{ startDateTime: "asc" }, { startDate: "asc" }],
  });

  return reply(c, {
    status: "ok",
    events: events.map((e) => ({
      ...e,
      // Ensure strict typing for response
      amountExpected: e.amountExpected || 0,
      amountPaid: e.amountPaid || 0,
    })),
  });
});

// ============================================================
// WEBHOOK (No Auth)
// ============================================================
const WEBHOOK_DEBOUNCE_MS = 5000;
let webhookSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastWebhookChannelId: string | null = null;

function executeWebhookSync(channelId: string) {
  webhookSyncTimer = null;
  console.log(
    `[webhook] 🚀 Executing debounced sync: ${channelId.slice(0, 8)}...`,
  );

  createCalendarSyncLogEntry({
    triggerSource: "webhook",
    triggerUserId: null,
    triggerLabel: `channel:${channelId.slice(0, 8)}`,
  })
    .then((logId) => {
      syncGoogleCalendarOnce()
        .then(async (result) => {
          console.log(`[webhook] Sync result:`, {
            fetched: result.payload.events.length,
            excluded: result.payload.excludedEvents.length,
            inserted: result.upsertResult.inserted,
            updated: result.upsertResult.updated,
            skipped: result.upsertResult.skipped,
          });

          const excludedSummaries = result.payload.excludedEvents
            .slice(0, 20)
            .map((e) => e.summary?.slice(0, 50) || "(sin título)");

          await finalizeCalendarSyncLogEntry(logId, {
            status: "SUCCESS",
            fetchedAt: new Date(result.payload.fetchedAt),
            inserted: result.upsertResult.inserted,
            updated: result.upsertResult.updated,
            skipped: result.upsertResult.skipped,
            excluded: result.payload.excludedEvents.length,
            changeDetails: {
              inserted: result.upsertResult.details.inserted,
              updated: result.upsertResult.details.updated,
              excluded: excludedSummaries,
            },
          });
          console.log(
            `[webhook] ✅ Sync completed: ${channelId.slice(0, 8)}...`,
          );
        })
        .catch(async (err) => {
          await finalizeCalendarSyncLogEntry(logId, {
            status: "ERROR",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          console.error(
            `[webhook] ❌ Sync failed: ${channelId.slice(0, 8)}...`,
            err.message,
          );
        });
    })
    .catch((err) => {
      if (err.message === "Sincronización ya en curso") {
        console.log(
          `[webhook] ℹ️ Sync skipped (already in progress): ${channelId.slice(0, 8)}...`,
        );
      } else {
        console.error(`[webhook] ❌ Failed to create log entry:`, err.message);
      }
    });
}

calendarRoutes.post("/webhook", async (c) => {
  const channelId = c.req.header("x-goog-channel-id");
  const resourceState = c.req.header("x-goog-resource-state");
  const resourceId = c.req.header("x-goog-resource-id");
  const messageNumber = c.req.header("x-goog-message-number");

  if (!channelId || !resourceId) {
    console.warn("[webhook] ⚠️ Missing channelId or resourceId");
    return reply(c, { error: "Missing required headers" }, 400);
  }

  if (resourceState === "sync") {
    // Initial verification
    console.log(`[webhook] ✓ Sync verified: ${channelId.slice(0, 8)}...`);
    return c.body(null, 200);
  }

  if (resourceState === "exists") {
    console.log(
      `[webhook] 📥 Change #${messageNumber || "?"}: channel=${channelId.slice(0, 8)}... (debouncing ${WEBHOOK_DEBOUNCE_MS}ms)`,
    );

    if (webhookSyncTimer) {
      clearTimeout(webhookSyncTimer);
    }

    lastWebhookChannelId = channelId;

    webhookSyncTimer = setTimeout(() => {
      if (lastWebhookChannelId) {
        executeWebhookSync(lastWebhookChannelId);
      }
    }, WEBHOOK_DEBOUNCE_MS);

    return c.body(null, 200);
  }

  console.log(`[webhook] ❓ Unknown state: ${resourceState}`);
  return c.body(null, 200);
});

// ============================================================
// JOB QUEUE TASKS
// ============================================================

calendarRoutes.post("/events/reclassify", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canReclassify = await hasPermission(user.id, "update", "CalendarEvent");
  if (!canReclassify) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  // Dynamic import to avoid cycles if any, though imports up top are fine
  const { startJob, updateJobProgress, completeJob, failJob } =
    await import("../lib/jobQueue");

  const events = await db.event.findMany({
    where: {
      OR: [
        { category: null },
        { category: "" },
        { dosage: null },
        { treatmentStage: null },
        { attended: null },
        { amountExpected: null },
        { amountPaid: null },
      ],
    },
    select: {
      id: true,
      summary: true,
      description: true,
      category: true,
      dosage: true,
      treatmentStage: true,
      attended: true,
      amountExpected: true,
      amountPaid: true,
    },
  });

  const jobId = startJob("reclassify", events.length);
  reply(c, { status: "accepted", jobId, totalEvents: events.length }); // Respond first? No, await issues in Hono.
  // Hono doesn't support responding then continuing easily without waitUntil.
  // c.executionCtx.waitUntil is for Cloudflare Workers.
  // In Node, we can just not await the async IIFE.

  // Background Process
  (async () => {
    try {
      type EventUpdate = {
        id: number;
        data: {
          category?: string;
          dosage?: string;
          treatmentStage?: string;
          attended?: boolean;
          amountExpected?: number;
          amountPaid?: number;
        };
      };
      const updates: EventUpdate[] = [];
      const fieldCounts = {
        category: 0,
        dosage: 0,
        treatmentStage: 0,
        attended: 0,
        amountExpected: 0,
        amountPaid: 0,
      };

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const metadata = parseCalendarMetadata({
          summary: event.summary,
          description: event.description,
        });

        const updateData: EventUpdate["data"] = {};
        if (
          (event.category === null || event.category === "") &&
          metadata.category
        ) {
          updateData.category = metadata.category;
          fieldCounts.category++;
        }
        if (event.dosage === null && metadata.dosage) {
          updateData.dosage = metadata.dosage;
          fieldCounts.dosage++;
        }
        if (event.treatmentStage === null && metadata.treatmentStage) {
          updateData.treatmentStage = metadata.treatmentStage;
          fieldCounts.treatmentStage++;
        }
        if (event.attended === null && metadata.attended !== null) {
          updateData.attended = metadata.attended;
          fieldCounts.attended++;
        }
        if (event.amountExpected === null && metadata.amountExpected !== null) {
          updateData.amountExpected = metadata.amountExpected;
          fieldCounts.amountExpected++;
        }
        if (event.amountPaid === null && metadata.amountPaid !== null) {
          updateData.amountPaid = metadata.amountPaid;
          fieldCounts.amountPaid++;
        }

        if (Object.keys(updateData).length > 0) {
          updates.push({ id: event.id, data: updateData });
        }

        if (i % 50 === 0 || i === events.length - 1) {
          updateJobProgress(
            jobId,
            i + 1,
            `Analizando ${i + 1}/${events.length} eventos...`,
          );
        }
      }

      const BATCH_SIZE = 20;
      let processed = 0;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await db.$transaction(
          batch.map((u) =>
            db.event.update({
              where: { id: u.id },
              data: u.data,
            }),
          ),
        );
        processed += batch.length;
        updateJobProgress(
          jobId,
          events.length,
          `Guardando ${processed}/${updates.length} actualizaciones...`,
        );
      }

      completeJob(jobId, {
        message: `Reclassified ${updates.length} events`,
        totalChecked: events.length,
        reclassified: updates.length,
        fieldCounts,
      });
    } catch (err) {
      failJob(jobId, err instanceof Error ? err.message : "Unknown error");
    }
  })();

  return reply(c, { status: "accepted", jobId, totalEvents: events.length });
});

calendarRoutes.post("/events/reclassify-all", requireAuth, async (c) => {
  const user = await getSessionUser(c);
  if (!user)
    return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canReclassify = await hasPermission(user.id, "update", "CalendarEvent");
  if (!canReclassify) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { startJob, updateJobProgress, completeJob, failJob } =
    await import("../lib/jobQueue");

  const events = await db.event.findMany({
    select: {
      id: true,
      summary: true,
      description: true,
    },
  });

  const jobId = startJob("reclassify-all", events.length);

  (async () => {
    try {
      type EventUpdate = {
        id: number;
        data: {
          category: string | null;
          dosage: string | null;
          treatmentStage: string | null;
          attended: boolean | null;
          amountExpected: number | null;
          amountPaid: number | null;
        };
      };

      const updates: EventUpdate[] = [];
      const fieldCounts = {
        category: 0,
        dosage: 0,
        treatmentStage: 0,
        attended: 0,
        amountExpected: 0,
        amountPaid: 0,
      };

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const metadata = parseCalendarMetadata({
          summary: event.summary,
          description: event.description,
        });

        const updateData: EventUpdate["data"] = {
          category: metadata.category,
          dosage: metadata.dosage,
          treatmentStage: metadata.treatmentStage,
          attended: metadata.attended,
          amountExpected: metadata.amountExpected,
          amountPaid: metadata.amountPaid,
        };

        if (metadata.category) fieldCounts.category++;
        if (metadata.dosage) fieldCounts.dosage++;
        if (metadata.treatmentStage) fieldCounts.treatmentStage++;
        if (metadata.attended !== null) fieldCounts.attended++;
        if (metadata.amountExpected !== null) fieldCounts.amountExpected++;
        if (metadata.amountPaid !== null) fieldCounts.amountPaid++;

        updates.push({ id: event.id, data: updateData });

        if (i % 100 === 0 || i === events.length - 1) {
          updateJobProgress(
            jobId,
            i + 1,
            `Analizando ${i + 1}/${events.length} eventos...`,
          );
        }
      }

      const BATCH_SIZE = 20;
      let processed = 0;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await db.$transaction(
          batch.map((u) =>
            db.event.update({ where: { id: u.id }, data: u.data }),
          ),
        );
        processed += batch.length;

        if ((i / BATCH_SIZE) % 5 === 0 || i + BATCH_SIZE >= updates.length) {
          updateJobProgress(
            jobId,
            events.length,
            `Guardando ${processed}/${updates.length} actualizaciones...`,
          );
        }
      }

      completeJob(jobId, {
        message: `Reclassified all ${updates.length} events`,
        totalChecked: events.length,
        reclassified: updates.length,
        fieldCounts,
      });
    } catch (err) {
      failJob(jobId, err instanceof Error ? err.message : "Unknown error");
    }
  })();

  return reply(c, { status: "accepted", jobId, totalEvents: events.length });
});

calendarRoutes.get("/events/job/:jobId", requireAuth, async (c) => {
  const { getJobStatus } = await import("../lib/jobQueue");
  const jobId = c.req.param("jobId");
  const job = getJobStatus(jobId);

  if (!job) {
    return reply(
      c,
      { status: "error", message: "Job not found or expired" },
      404,
    );
  }

  return reply(c, {
    status: "ok",
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      total: job.total,
      message: job.message,
      result: job.result,
      error: job.error,
    },
  });
});
