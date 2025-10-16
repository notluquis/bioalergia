import cron from "node-cron";

import { googleCalendarConfig } from "../config.js";
import { logEvent, logWarn } from "./logger.js";
import { syncGoogleCalendarOnce } from "./google-calendar.js";

const CRON_JOBS = [
  { expression: "0 9 * * *", label: "morning" },
  { expression: "0 20 * * *", label: "evening" },
];

export function startGoogleCalendarScheduler() {
  if (!googleCalendarConfig) {
    logWarn("googleCalendar.scheduler.disabled", {
      reason: "missing_config",
    });
    return;
  }

  const timezone = googleCalendarConfig.timeZone;

  for (const job of CRON_JOBS) {
    cron.schedule(
      job.expression,
      async () => {
        logEvent("googleCalendar.sync.trigger", {
          label: job.label,
          expression: job.expression,
        });
        try {
          const result = await syncGoogleCalendarOnce();
          logEvent("googleCalendar.sync.success", {
            label: job.label,
            expression: job.expression,
            events: result.payload.events.length,
            inserted: result.upsertResult.inserted,
            updated: result.upsertResult.updated,
            skipped: result.upsertResult.skipped,
            snapshotPath: result.snapshotPath,
          });
        } catch (error) {
          logWarn("googleCalendar.sync.error", {
            label: job.label,
            expression: job.expression,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        timezone,
      }
    );
  }

  logEvent("googleCalendar.scheduler.started", {
    jobs: CRON_JOBS.length,
    timezone,
  });
}
