import cron from "node-cron";
import { renewWatchChannels, getActiveWatchChannels } from "./google-calendar-watch.js";
import { syncGoogleCalendarOnce } from "./google-calendar.js";
import { logEvent, logWarn } from "./logger.js";

let renewalCronJob: cron.ScheduledTask | null = null;
let fallbackSyncCronJob: cron.ScheduledTask | null = null;

/**
 * Start calendar-related cron jobs:
 * 1. Renew watch channels daily at 3 AM
 * 2. Fallback sync every 15 minutes (only if no webhooks are active)
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

  // Fallback sync every 15 minutes (only if no webhooks)
  // This ensures sync continues even if webhooks fail or aren't set up
  fallbackSyncCronJob = cron.schedule("*/15 * * * *", async () => {
    try {
      // Check if any watch channels are active
      const activeChannels = await getActiveWatchChannels();

      if (activeChannels.length === 0) {
        // No webhooks active - run fallback sync
        logEvent("cron_fallback_sync_start", { reason: "no_active_webhooks" });
        await syncGoogleCalendarOnce();
        logEvent("cron_fallback_sync_success", {});
      } else {
        // Webhooks are active - skip fallback sync
        logEvent("cron_fallback_sync_skipped", {
          reason: "webhooks_active",
          activeChannelsCount: activeChannels.length,
        });
      }
    } catch (error) {
      console.error("cron_fallback_sync_error", error);
      logWarn("cron_fallback_sync_error", {});
    }
  });

  logEvent("calendar_cron_started", {
    renewalSchedule: "0 3 * * * (daily at 3 AM)",
    fallbackSyncSchedule: "*/15 * * * * (every 15 minutes if no webhooks)",
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
  if (fallbackSyncCronJob) {
    fallbackSyncCronJob.stop();
    fallbackSyncCronJob = null;
  }
  logEvent("calendar_cron_stopped", {});
}
