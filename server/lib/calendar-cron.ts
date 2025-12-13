import cron from "node-cron";
import { renewWatchChannels } from "./google-calendar-watch.js";
import { logEvent, logWarn } from "./logger.js";

let renewalCronJob: cron.ScheduledTask | null = null;

/**
 * Start calendar-related cron jobs:
 * 1. Renew watch channels daily at 3 AM
 * (fallback sync every 15 minutes removed — webhooks + manual sync handle freshness)
 */
export function startCalendarCron() {
  // Daily renewal of watch channels at 3 AM
  renewalCronJob = cron.schedule("0 3 * * *", async () => {
    logEvent("cron_renew_watch_channels_start", {});
    try {
      await renewWatchChannels();
      logEvent("cron_renew_watch_channels_success", {});
    } catch (error) {
      console.error("cron_renew_watch_channels_error", error);
      logWarn("cron_renew_watch_channels_error", {});
    }
  });

  logEvent("calendar_cron_started", {
    renewalSchedule: "0 3 * * * (daily at 3 AM)",
    fallbackSyncSchedule: "disabled",
  });
}

/**
 * Stop all calendar cron jobs (useful for graceful shutdown)
 */
export function stopCalendarCron() {
  if (renewalCronJob) {
    renewalCronJob.stop();
    renewalCronJob = null;
  }
  logEvent("calendar_cron_stopped", {});
}
