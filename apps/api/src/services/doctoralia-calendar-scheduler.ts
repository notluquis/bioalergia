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
    logWarn("doctoralia.calendar.sync.error", {
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isRunning = false;
  }
}
