import cron from "node-cron";
import { googleCalendarConfig } from "../../config";
import { createCalendarSyncLogEntry, finalizeCalendarSyncLogEntry } from "../../services/calendar";

import { logEvent, logWarn } from "../logger";
import { syncGoogleCalendarOnce } from "./google-calendar.js";

// Polling disabled by user request (relying on Webhooks)
const CRON_JOBS: { expression: string; label: string }[] = [];

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
        const logId = await createCalendarSyncLogEntry({
          triggerSource: `cron:${job.label}`,
          triggerLabel: job.expression,
        });
        try {
          const result = await syncGoogleCalendarOnce();
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
          logEvent("googleCalendar.sync.success", {
            label: job.label,
            expression: job.expression,
            events: result.payload.events.length,
            inserted: result.upsertResult.inserted,
            updated: result.upsertResult.updated,
            skipped: result.upsertResult.skipped,
            excluded: result.payload.excludedEvents.length,
            snapshotPath: result.snapshotPath,
          });
        } catch (error) {
          await finalizeCalendarSyncLogEntry(logId, {
            status: "ERROR",
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          logWarn("googleCalendar.sync.error", {
            label: job.label,
            expression: job.expression,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        timezone,
      },
    );
  }

  logEvent("googleCalendar.scheduler.started", {
    jobs: CRON_JOBS.length,
    timezone,
  });
}
