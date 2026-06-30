import { db } from "@finanzas/db";
import type { Context } from "hono";
import { Hono } from "hono";
import {
  type CalendarSyncLogEntryPayload,
  calendarSyncService,
  createCalendarSyncLogEntry,
  finalizeCalendarSyncLogEntry,
} from "../services/calendar.ts";

export const googleCalendarWebhookRoutes = new Hono();

const WEBHOOK_DEBOUNCE_MS = 5000;
let webhookSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastWebhookChannelId: string | null = null;
let lastWebhookSignal: null | {
  channelId: string;
  messageNumber: null | string;
  receivedAt: string;
  resourceId: string;
  resourceState: null | string;
  traceId: string;
} = null;

function buildStructuredSyncLogEntries(params: {
  errorMessage?: string;
  excluded?: number;
  inserted?: number;
  source: string;
  status: "ERROR" | "SUCCESS";
  updated?: number;
}): CalendarSyncLogEntryPayload[] {
  const entries: CalendarSyncLogEntryPayload[] = [
    {
      attributes: {
        excluded: params.excluded ?? 0,
        inserted: params.inserted ?? 0,
        updated: params.updated ?? 0,
      },
      message:
        params.status === "SUCCESS"
          ? "Calendar sync completed"
          : "Calendar sync finished with error",
      severity: params.status === "SUCCESS" ? "info" : "error",
      tags: {
        service: "calendar-sync",
        source: params.source,
      },
      timestamp: new Date(),
    },
  ];

  if (params.errorMessage) {
    entries.push({
      attributes: {
        errorMessage: params.errorMessage,
      },
      message: params.errorMessage,
      severity: "error",
      tags: {
        service: "calendar-sync",
        source: params.source,
      },
      timestamp: new Date(),
    });
  }

  return entries;
}

function shortWebhookId(id: null | string | undefined) {
  if (!id) {
    return "?";
  }
  return `${id.slice(0, 8)}...`;
}

function createWebhookTraceId() {
  return `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function finalizeSyncLog(
  logId: number,
  result: {
    inserted: number;
    updated: number;
    deleted: number;
    eventsFetched: number;
    details: {
      inserted: string[];
      updated: (string | { changes: string[]; summary: string })[];
      deleted: string[];
    };
  }
) {
  console.log("[webhook] Sync result", {
    excluded: result.deleted,
    fetched: result.eventsFetched,
    inserted: result.inserted,
    updated: result.updated,
  });

  await finalizeCalendarSyncLogEntry(logId, {
    status: "SUCCESS",
    fetchedAt: new Date(),
    inserted: result.inserted,
    updated: result.updated,
    skipped: 0,
    excluded: result.deleted,
    changeDetails: {
      inserted: result.details.inserted,
      updated: result.details.updated,
      excluded: result.details.deleted,
    },
    logEntries: buildStructuredSyncLogEntries({
      excluded: result.deleted,
      inserted: result.inserted,
      source: "webhook",
      status: "SUCCESS",
      updated: result.updated,
    }),
  });
  console.log(`[webhook] Sync completed (logId: ${logId})`);
}

async function executeWebhookSync(
  channelId: string,
  signal?: {
    messageNumber: null | string;
    receivedAt: string;
    resourceId: string;
    resourceState: null | string;
    traceId: string;
  }
) {
  webhookSyncTimer = null;
  const traceId = signal?.traceId ?? createWebhookTraceId();
  console.log("[webhook] Debounced sync start", {
    channelId: shortWebhookId(channelId),
    messageNumber: signal?.messageNumber ?? null,
    traceId,
  });

  const initialLogId = await createCalendarSyncLogEntry({
    triggerSource: "webhook",
    triggerUserId: null,
    triggerLabel: `channel:${channelId.slice(0, 8)}`,
  });

  try {
    const channel = await db.calendarWatchChannel.findUnique({
      where: { channelId },
      include: { calendar: true },
    });

    if (!channel) {
      console.warn("[webhook] Unknown channelId, falling back to syncAll", {
        channelId,
        traceId,
      });
      const result = await calendarSyncService.syncAll();
      await finalizeSyncLog(initialLogId, result);
      return;
    }

    const result = await calendarSyncService.syncCalendar(channel.calendar.googleId);
    await finalizeSyncLog(initialLogId, result);
  } catch (err) {
    if (err instanceof Error && err.message === "Sincronización ya en curso") {
      console.log("[webhook] Sync skipped (already in progress)", {
        channelId: shortWebhookId(channelId),
        traceId,
      });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] Sync failed", {
      channelId: shortWebhookId(channelId),
      error: message,
      traceId,
    });
    await finalizeCalendarSyncLogEntry(initialLogId, {
      status: "ERROR",
      errorMessage: message,
      logEntries: buildStructuredSyncLogEntries({
        errorMessage: message,
        source: "webhook",
        status: "ERROR",
      }),
    });
  }
}

export const handleGoogleCalendarWebhook = async (c: Context) => {
  const channelId = c.req.header("x-goog-channel-id");
  const resourceState = c.req.header("x-goog-resource-state");
  const resourceId = c.req.header("x-goog-resource-id");
  const messageNumber = c.req.header("x-goog-message-number");
  const channelExpirationHeader = c.req.header("x-goog-channel-expiration");
  const traceId = createWebhookTraceId();
  const receivedAt = new Date().toISOString();

  if (!channelId || !resourceId) {
    console.warn("[webhook] Missing required headers", {
      hasChannelId: Boolean(channelId),
      hasResourceId: Boolean(resourceId),
      traceId,
    });
    return c.json({ error: "Missing required headers" }, 400);
  }

  const known = await db.calendarWatchChannel.findFirst({
    where: { channelId, resourceId },
    select: { id: true },
  });
  if (!known) {
    console.warn("[webhook] Unknown channel, ignoring", {
      channelId: shortWebhookId(channelId),
      resourceId: shortWebhookId(resourceId),
      traceId,
    });
    return c.body(null, 200);
  }

  if (channelExpirationHeader) {
    const expirationMs = Date.parse(channelExpirationHeader);
    if (Number.isFinite(expirationMs)) {
      const updateResult = await db.calendarWatchChannel.updateMany({
        where: { channelId, resourceId },
        data: { expiration: new Date(expirationMs) },
      });

      console.log("[webhook] Channel expiration updated", {
        channelId: shortWebhookId(channelId),
        expiration: new Date(expirationMs).toISOString(),
        resourceId: shortWebhookId(resourceId),
        rowsAffected: updateResult.count,
        traceId,
      });
    }
  }

  if (resourceState === "sync") {
    return c.body(null, 200);
  }

  if (resourceState === "exists") {
    console.log("[webhook] Debounced notification", {
      channelId: shortWebhookId(channelId),
      debounceMs: WEBHOOK_DEBOUNCE_MS,
      messageNumber: messageNumber ?? null,
      traceId,
    });

    if (webhookSyncTimer) {
      console.log("[webhook] Debounce reset", {
        previousChannelId: shortWebhookId(lastWebhookChannelId),
        traceId,
      });
      clearTimeout(webhookSyncTimer);
    }

    lastWebhookChannelId = channelId;
    lastWebhookSignal = {
      channelId,
      messageNumber: messageNumber ?? null,
      receivedAt,
      resourceId,
      resourceState,
      traceId,
    };

    webhookSyncTimer = setTimeout(() => {
      if (lastWebhookChannelId) {
        executeWebhookSync(lastWebhookChannelId, lastWebhookSignal ?? undefined).catch((err) => {
          console.error("[webhook] Error in debounced sync", {
            channelId: shortWebhookId(lastWebhookChannelId),
            error: err instanceof Error ? err.message : String(err),
            traceId: lastWebhookSignal?.traceId ?? null,
          });
        });
      }
    }, WEBHOOK_DEBOUNCE_MS);

    return c.body(null, 200);
  }

  return c.body(null, 200);
};

// Golden standard: dedicated webhook ingress for external providers.
// Keep no-auth because Google push notifications cannot send app credentials.
googleCalendarWebhookRoutes.post("/calendar", handleGoogleCalendarWebhook);
