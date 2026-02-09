import cron from "node-cron";
import { syncDTEs } from "../../services/dte-sync";
import { logEvent, logWarn } from "../logger";

// DTE Sync Cron Job Configuration
const CRON_JOBS: { expression: string; label: string }[] = [
  {
    expression: "0 17 * * *", // Daily at 5 PM (17:00)
    label: "daily-dte-sync",
  },
];

export function startDTESyncScheduler() {
  if (!CRON_JOBS.length) {
    logWarn("dtе.scheduler.disabled", {
      reason: "no_jobs_configured",
    });
    return;
  }

  const timezone = process.env.TZ || "America/Santiago"; // Default to Chile timezone

  for (const job of CRON_JOBS) {
    cron.schedule(
      job.expression,
      async () => {
        logEvent("dte.sync.trigger", {
          label: job.label,
          expression: job.expression,
        });

        try {
          const result = await syncDTEs({
            triggerSource: "cron",
          });

          // Sum totals from all doc types
          const totalInserted = result.results.reduce((sum, r) => sum + r.inserted, 0);
          const totalUpdated = result.results.reduce((sum, r) => sum + r.updated, 0);
          const totalProcessed = result.results.reduce((sum, r) => sum + r.processed, 0);

          logEvent("dte.sync.success", {
            label: job.label,
            expression: job.expression,
            status: result.status,
            period: result.period,
            logId: result.logId,
            inserted: totalInserted,
            updated: totalUpdated,
            processed: totalProcessed,
            docTypes: result.results.map((r) => `${r.docType}(${r.inserted})`).join(", "),
          });
        } catch (error) {
          logWarn("dte.sync.error", {
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

    logEvent("dte.sync.scheduled", {
      label: job.label,
      expression: job.expression,
      timezone,
    });
  }

  logEvent("dte.scheduler.started", {
    jobs: CRON_JOBS.length,
    timezone,
  });
}
