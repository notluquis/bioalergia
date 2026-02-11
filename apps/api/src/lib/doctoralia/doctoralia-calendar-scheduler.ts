import cron from "node-cron";
import { doctoraliaCalendarSyncService } from "../../services/doctoralia-calendar";
import { getSetting, updateSetting } from "../../services/settings";
import { logEvent, logWarn } from "../logger";
import { isCalendarAuthConfigured } from "./doctoralia-calendar-auth";

const DEFAULT_CRON = "*/10 * * * *";
const DEFAULT_TIMEZONE = "America/Santiago";
const DEFAULT_MIN_SYNC_INTERVAL_MS = 60_000;
const SETTINGS_KEYS = {
  lastAttemptAt: "doctoralia:calendar:lastAttemptAt",
  lastSuccessAt: "doctoralia:calendar:lastSuccessAt",
};

let isRunning = false;

export function startDoctoraliaCalendarScheduler() {
  if (!isCalendarAuthConfigured()) {
    logWarn("doctoralia.calendar.scheduler.disabled", {
      reason: "missing_credentials",
    });
    return;
  }

  const cronExpression = process.env.DOCTORALIA_CALENDAR_SYNC_CRON || DEFAULT_CRON;
  const timezone = process.env.DOCTORALIA_CALENDAR_SYNC_TIMEZONE || DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    logWarn("doctoralia.calendar.scheduler.disabled", {
      reason: "invalid_cron",
      cronExpression,
    });
    return;
  }

  cron.schedule(
    cronExpression,
    async () => {
      await runDoctoraliaCalendarAutoSync({ trigger: `cron:${cronExpression}` });
    },
    {
      timezone,
      noOverlap: true,
      name: "doctoralia-calendar-alert-sync",
    },
  );

  logEvent("doctoralia.calendar.scheduler.started", {
    cronExpression,
    timezone,
  });
}

export async function runDoctoraliaCalendarAutoSync({ trigger }: { trigger: string }) {
  const minSyncIntervalMs = Number(
    process.env.DOCTORALIA_CALENDAR_MIN_SYNC_INTERVAL_MS || DEFAULT_MIN_SYNC_INTERVAL_MS,
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
