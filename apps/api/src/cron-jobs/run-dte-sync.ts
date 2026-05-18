// Railway Cron entrypoint: DTE daily sync (Haulmer).
//
// Recommended Railway cron schedule: 0 17 * * *  (17:00 America/Santiago).
// Set TZ=America/Santiago on the service.
// startCommand: node --max-old-space-size=512 src/cron-jobs/run-dte-sync.ts

import "../instrument.ts";
import { syncDTEs } from "../services/dte-sync.ts";
import { logError, logEvent } from "../lib/logger.ts";

async function main() {
  const started = Date.now();
  logEvent("cron.dte-sync.start", {});

  const result = await syncDTEs({ triggerSource: "cron" });

  const totalInserted = result.results.reduce((sum, r) => sum + r.inserted, 0);
  const totalUpdated = result.results.reduce((sum, r) => sum + r.updated, 0);
  const totalProcessed = result.results.reduce((sum, r) => sum + r.processed, 0);

  logEvent("cron.dte-sync.done", {
    ms: Date.now() - started,
    status: result.status,
    period: result.period,
    logId: result.logId,
    inserted: totalInserted,
    updated: totalUpdated,
    processed: totalProcessed,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logError("cron.dte-sync.fatal", err);
    process.exit(1);
  });
