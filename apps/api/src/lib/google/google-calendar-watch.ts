import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@finanzas/db";
import { calendar, type calendar_v3 } from "@googleapis/calendar";
import { JWT } from "google-auth-library";
import { logEvent, logWarn } from "../logger";

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const CREDENTIALS_PATH = path.resolve(
  process.cwd(),
  "storage",
  "google-calendar",
  "credentials.json",
);
const WEBHOOK_BASE_URL = process.env.PUBLIC_URL || "http://localhost:5000";
const WEBHOOK_ENDPOINT = `${WEBHOOK_BASE_URL}/api/calendar/webhook`;

// Google Calendar watch channels expire after 7 days max
const CHANNEL_TTL_DAYS = 7;
const RENEWAL_BUFFER_DAYS = 1; // Renew 1 day before expiration

type CalendarClient = calendar_v3.Calendar;

/**
 * Get authenticated Google Calendar client
 * Tries environment variables first, then falls back to credentials.json file
 * Returns null if no credentials are available
 */
async function getCalendarClient(): Promise<CalendarClient | null> {
  let clientEmail: string | undefined;
  let privateKey: string | undefined;

  // Try environment variables first (Railway approach)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // Railway may escape newlines as literal \n, convert them back
    privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
    logEvent("google_calendar_auth_from_env", { clientEmail });
  } else {
    // Fall back to credentials file
    try {
      await fs.access(CREDENTIALS_PATH);
      const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, "utf-8"));
      clientEmail = credentials.client_email;
      privateKey = credentials.private_key;
      logEvent("google_calendar_auth_from_file", {
        clientEmail,
        path: CREDENTIALS_PATH,
      });
    } catch {
      logWarn("google_calendar_credentials_not_found", {
        envMissing: "GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
        filePath: CREDENTIALS_PATH,
        hint: "Set env vars or provide credentials.json file",
      });
      return null;
    }
  }

  if (!clientEmail || !privateKey) {
    logWarn("google_calendar_invalid_credentials", {
      hasEmail: !!clientEmail,
      hasKey: !!privateKey,
    });
    return null;
  }

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: CALENDAR_SCOPES,
  });

  return calendar({ version: "v3", auth });
}

/**
 * Register a watch channel for a calendar to receive push notifications
 * @param calendarGoogleId - Google Calendar ID (e.g., "primary" or email)
 * @param calendarDbId - Internal database calendar ID
 * @returns Channel information or null if registration failed
 */
export async function registerWatchChannel(
  calendarGoogleId: string,
  calendarDbId: number,
): Promise<{ channelId: string; resourceId: string; expiration: Date } | null> {
  try {
    const client = await getCalendarClient();

    // If no credentials available, skip registration silently
    if (!client) {
      return null;
    }

    const channelId = randomUUID();
    const fallbackExpiration = new Date(Date.now() + CHANNEL_TTL_DAYS * 24 * 60 * 60 * 1000);

    logEvent("register_watch_channel_start", {
      calendarGoogleId,
      calendarDbId,
      channelId,
      webhookUrl: WEBHOOK_ENDPOINT,
    });

    const response = await client.events.watch({
      calendarId: calendarGoogleId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: WEBHOOK_ENDPOINT,
        params: {
          ttl: String(CHANNEL_TTL_DAYS * 24 * 60 * 60), // seconds
        },
      },
    });

    const resourceId = response.data.resourceId;
    if (!resourceId) {
      logWarn("register_watch_channel_failed", {
        calendarGoogleId,
        channelId,
        error: "No resourceId in response",
      });
      return null;
    }

    const responseExpirationMs = response.data.expiration
      ? Number(response.data.expiration)
      : Number.NaN;
    const expiration = Number.isFinite(responseExpirationMs)
      ? new Date(responseExpirationMs)
      : fallbackExpiration;

    // Store in database
    await db.calendarWatchChannel.upsert({
      where: { channelId },
      create: {
        calendarId: calendarDbId,
        channelId,
        resourceId,
        expiration,
        webhookUrl: WEBHOOK_ENDPOINT,
      },
      update: {
        resourceId,
        expiration,
        webhookUrl: WEBHOOK_ENDPOINT,
      },
    });

    logEvent("register_watch_channel_success", {
      calendarGoogleId,
      calendarDbId,
      channelId,
      resourceId,
      expiration: expiration.toISOString(),
    });

    return { channelId, resourceId, expiration };
  } catch (error) {
    console.error("register_watch_channel_error", error, {
      calendarGoogleId,
      calendarDbId,
    });
    logWarn("register_watch_channel_error", { calendarGoogleId, calendarDbId });
    return null;
  }
}

/**
 * Check if the error is a 404 Not Found from Google API
 */
function is404Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const e = error as {
    code?: number;
    status?: number;
    response?: { status?: number };
    message?: string;
  };

  return (
    e.code === 404 ||
    e.status === 404 ||
    e.response?.status === 404 ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("not found"))
  );
}

async function safeDeleteWatchChannel(channelId: string) {
  try {
    await db.calendarWatchChannel.delete({
      where: { channelId },
    });
  } catch (error) {
    // Ignore missing rows or concurrent deletions
    logWarn("stop_watch_channel_db_cleanup_failed", { channelId, error });
  }
}

/**
 * Stop watching a calendar by stopping the channel
 * @param channelId - Channel ID to stop
 * @param resourceId - Resource ID from Google
 */
export async function stopWatchChannel(channelId: string, resourceId: string): Promise<boolean> {
  try {
    const client = await getCalendarClient();

    // If no credentials available, just delete from DB
    if (!client) {
      await safeDeleteWatchChannel(channelId);
      return true;
    }

    logEvent("stop_watch_channel_start", { channelId, resourceId });

    await client.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });

    // Remove from database
    await db.calendarWatchChannel.delete({
      where: { channelId },
    });

    logEvent("stop_watch_channel_success", { channelId, resourceId });
    return true;
  } catch (error: unknown) {
    // Treat 404 as success (channel already gone) to allow cleanup
    if (is404Error(error)) {
      logWarn("stop_watch_channel_404", {
        channelId,
        message: "Channel not found on Google, removing from DB",
      });

      // Ensure removal from database so we don't try again
      await safeDeleteWatchChannel(channelId);

      return true;
    }

    console.error("stop_watch_channel_error", error, { channelId, resourceId });
    logWarn("stop_watch_channel_error", { channelId, resourceId });
    return false;
  }
}

/**
 * Renew all watch channels that are about to expire
 * Should be run daily via cron job
 */
export async function renewWatchChannels(): Promise<void> {
  try {
    const expirationThreshold = new Date(Date.now() + RENEWAL_BUFFER_DAYS * 24 * 60 * 60 * 1000);

    // Find channels expiring soon
    const expiring = await db.calendarWatchChannel.findMany({
      where: {
        expiration: {
          lte: expirationThreshold,
        },
      },
      include: {
        calendar: true,
      },
    });

    logEvent("renew_watch_channels_start", {
      expiringCount: expiring.length,
      expirationThreshold: expirationThreshold.toISOString(),
    });

    for (const channel of expiring) {
      // Stop old channel
      await stopWatchChannel(channel.channelId, channel.resourceId);

      // Register new channel
      const result = await registerWatchChannel(channel.calendar.googleId, channel.calendarId);

      if (result) {
        logEvent("renew_watch_channel_success", {
          calendarGoogleId: channel.calendar.googleId,
          oldChannelId: channel.channelId,
          newChannelId: result.channelId,
        });
      } else {
        logWarn("renew_watch_channel_failed", {
          calendarGoogleId: channel.calendar.googleId,
          oldChannelId: channel.channelId,
        });
      }
    }

    logEvent("renew_watch_channels_complete", {
      processedCount: expiring.length,
    });
  } catch (error) {
    console.error("renew_watch_channels_error", error);
    logWarn("renew_watch_channels_error", {});
  }
}

/**
 * Get all active watch channels
 */
export async function getActiveWatchChannels(): Promise<
  Array<{
    channelId: string;
    resourceId: string;
    calendarGoogleId: string;
    expiration: Date;
  }>
> {
  const channels = await db.calendarWatchChannel.findMany({
    where: {
      expiration: {
        lt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expiring in < 24h
      },
    },
    include: { calendar: true },
  });

  return channels.map((ch) => ({
    channelId: ch.channelId,
    resourceId: ch.resourceId,
    calendarGoogleId: ch.calendar.googleId,
    expiration: ch.expiration,
  }));
}

/**
 * Setup watch channels for all calendars that don't have one
 * Should be called on server startup
 */
type SetupResult = "updated" | "skipped" | "failed";

let lastSkipLogAt = 0;
const SKIP_LOG_THROTTLE_MS = 60 * 60 * 1_000; // 1 hour

export async function setupAllWatchChannels(): Promise<SetupResult> {
  try {
    // Get all calendars
    const calendars = await db.calendar.findMany();

    // Get existing active channels
    const existingChannels = await db.calendarWatchChannel.findMany({
      where: {
        expiration: {
          gt: new Date(),
        },
      },
      select: {
        calendarId: true,
      },
    });

    const calendarsWithChannels = new Set(existingChannels.map((ch) => ch.calendarId));

    // Find calendars without watch channels
    const calendarsNeedingChannels = calendars.filter((cal) => !calendarsWithChannels.has(cal.id));

    logEvent("setup_watch_channels_start", {
      totalCalendars: calendars.length,
      existingChannels: existingChannels.length,
      needingChannels: calendarsNeedingChannels.length,
    });

    if (calendarsNeedingChannels.length === 0) {
      const now = Date.now();
      if (now - lastSkipLogAt >= SKIP_LOG_THROTTLE_MS) {
        logEvent("setup_watch_channels_skip", {
          message: "All calendars already have active watch channels",
        });
        lastSkipLogAt = now;
      }
      return "skipped";
    }

    // Register watch channels for calendars that need them
    let successCount = 0;
    let failCount = 0;

    for (const calendar of calendarsNeedingChannels) {
      const result = await registerWatchChannel(calendar.googleId, calendar.id);
      if (result) {
        successCount++;
        logEvent("setup_watch_channel_success", {
          calendarGoogleId: calendar.googleId,
          channelId: result.channelId,
        });
      } else {
        failCount++;
        logWarn("setup_watch_channel_failed", {
          calendarGoogleId: calendar.googleId,
        });
      }
    }

    logEvent("setup_watch_channels_complete", {
      successCount,
      failCount,
    });
    return "updated";
  } catch (error) {
    console.error("setup_watch_channels_error", error);
    logWarn("setup_watch_channels_error", {});
    return "failed";
  }
}

type SetupRetryOptions = {
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  fallbackDelayMs?: number;
  minDelayMs?: number;
};

let setupInFlight = false;

export function scheduleWatchChannelSetup(options: SetupRetryOptions = {}) {
  const {
    initialDelayMs = 5_000,
    maxDelayMs = 60 * 60 * 1_000,
    jitterMs = 1_000,
    fallbackDelayMs = 6 * 60 * 60 * 1_000,
    minDelayMs = 30_000,
  } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = (delayMs: number) => {
    if (timer) {
      clearTimeout(timer);
    }
    const jitter = Math.floor(Math.random() * jitterMs);
    const delay = Math.min(maxDelayMs, Math.max(minDelayMs, delayMs + jitter));
    timer = setTimeout(runMaintenance, delay);
  };

  const computeNextDelay = async (_lastResult: SetupResult | null) => {
    const nextExpiration = await db.calendarWatchChannel.findFirst({
      orderBy: { expiration: "asc" },
      select: { expiration: true },
    });

    if (!nextExpiration) {
      return fallbackDelayMs;
    }

    const bufferMs = RENEWAL_BUFFER_DAYS * 24 * 60 * 60 * 1000;
    const targetTime = nextExpiration.expiration.getTime() - bufferMs;
    const delayMs = targetTime - Date.now();
    return delayMs;
  };

  const runMaintenance = async () => {
    if (setupInFlight) {
      scheduleNext(initialDelayMs);
      return;
    }

    setupInFlight = true;
    let result: SetupResult | null = null;
    try {
      result = await setupAllWatchChannels();
      await renewWatchChannels();
    } catch (error) {
      console.error("setup_watch_channels_retry_error", error);
      logWarn("setup_watch_channels_retry_error", {});
      result = "failed";
    } finally {
      setupInFlight = false;
    }

    const nextDelay = await computeNextDelay(result);
    scheduleNext(nextDelay);
  };

  runMaintenance().catch((error) => {
    console.error("setup_watch_channels_initial_error", error);
    logWarn("setup_watch_channels_initial_error", {});
    scheduleNext(initialDelayMs);
  });
}
