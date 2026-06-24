import { doctoraliaCalendarSyncService } from "./doctoralia-calendar.ts";
import { getSetting, updateSetting } from "./settings.ts";
import { logEvent, logWarn } from "../lib/logger.ts";
import { hasCalendarApiToken } from "../lib/doctoralia/doctoralia-calendar-client.ts";

// Scheduling moved to graphile-worker (queue/tasks/doctoralia-calendar-sync.ts;
// cron item in queue/runner.ts, gated by ENABLE_DOCTORALIA_CALENDAR_SYNC).
// runDoctoraliaCalendarAutoSync keeps its own min-interval + running guards.

const DEFAULT_MIN_SYNC_INTERVAL_MS = 60_000;
const SETTINGS_KEYS = {
  lastAttemptAt: "doctoralia:calendar:lastAttemptAt",
  lastSuccessAt: "doctoralia:calendar:lastSuccessAt",
};

let isRunning = false;

/**
 * Extract every useful field from an unknown thrown value. gaxios/axios-style
 * errors carry the real signal in `.response.status` / `.response.data` /
 * `.code`, not in `.message` (which is often empty). Returns a flat record safe
 * to spread into a structured log.
 */
function describeSyncError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error: String(error), errorType: typeof error };
  }

  const out: Record<string, unknown> = {
    error: error.message || "(empty message)",
    errorName: error.name,
  };

  const maybe = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown; statusText?: unknown; data?: unknown };
    cause?: unknown;
  };
  if (maybe.code != null) out.code = maybe.code;
  if (maybe.status != null) out.httpStatus = maybe.status;
  if (maybe.response) {
    out.httpStatus = maybe.response.status ?? out.httpStatus;
    out.httpStatusText = maybe.response.statusText;
    // Cap the body so a giant HTML error page doesn't flood logs.
    const body =
      typeof maybe.response.data === "string"
        ? maybe.response.data
        : JSON.stringify(maybe.response.data);
    if (body) out.responseBody = body.slice(0, 500);
  }
  if (maybe.cause != null) {
    out.cause = maybe.cause instanceof Error ? maybe.cause.message : String(maybe.cause);
  }
  return out;
}

export async function runDoctoraliaCalendarAutoSync({ trigger }: { trigger: string }) {
  if (process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC !== "true") {
    logWarn("doctoralia.calendar.sync.skip", {
      reason: "standby_mode",
      trigger,
    });
    return;
  }

  const hasToken = await hasCalendarApiToken();
  if (!hasToken) {
    logWarn("doctoralia.calendar.sync.skip", {
      reason: "missing_scraper_token",
      trigger,
    });
    return;
  }

  const minSyncIntervalMs = Number(
    process.env.DOCTORALIA_CALENDAR_MIN_SYNC_INTERVAL_MS || DEFAULT_MIN_SYNC_INTERVAL_MS
  );
  const now = Date.now();
  const lastAttemptAtRaw = await getSetting(SETTINGS_KEYS.lastAttemptAt);
  const lastAttemptAt = lastAttemptAtRaw ? new Date(lastAttemptAtRaw).getTime() : 0;
  const hasRecentAttempt =
    Number.isFinite(lastAttemptAt) && lastAttemptAt > 0 && now - lastAttemptAt < minSyncIntervalMs;

  if (hasRecentAttempt) {
    logWarn("doctoralia.calendar.sync.skip", {
      reason: "min_interval",
      trigger,
      minSyncIntervalMs,
    });
    return;
  }

  if (isRunning) {
    logWarn("doctoralia.calendar.sync.skip", {
      reason: "already_running",
      trigger,
    });
    return;
  }

  isRunning = true;
  try {
    await updateSetting(SETTINGS_KEYS.lastAttemptAt, new Date(now).toISOString());
    const result = await doctoraliaCalendarSyncService.syncFromAlerts(3, "cron-alerts");
    await updateSetting(SETTINGS_KEYS.lastSuccessAt, new Date().toISOString());
    logEvent("doctoralia.calendar.sync.success", {
      trigger,
      alertsFetched: result.alertsFetched,
      pendingAlertsFetched: result.pendingAlertsFetched,
      appointmentsInserted: result.appointments.inserted,
      appointmentsUpdated: result.appointments.updated,
      alertUpdates: result.alertUpdates.updated,
      schedules: result.scheduleIds.length,
      syncWindow: result.syncWindow,
    });
  } catch (error) {
    // The underlying gaxios request can throw an Error with an empty message
    // (or a non-Error), which previously surfaced as `error:""` and hid the
    // real cause. Capture the full shape so the next run is diagnosable.
    logWarn("doctoralia.calendar.sync.error", {
      trigger,
      ...describeSyncError(error),
    });
  } finally {
    isRunning = false;
  }
}
