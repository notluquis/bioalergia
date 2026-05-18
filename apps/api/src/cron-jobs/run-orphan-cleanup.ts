// Railway Cron entrypoint: nightly orphan cleanup
// (clinical_series → patients → people, cascade-safe).
//
// Recommended schedule: 30 3 * * *  (03:30 America/Santiago).
// Set DB_ORPHAN_CLEANUP=1 to enable actual deletes (default is dry-run).
// startCommand: node --max-old-space-size=256 src/cron-jobs/run-orphan-cleanup.ts

import "../instrument.ts";
import { runOrphanCleanup } from "../lib/cleanup-orphans.ts";
import { logError, logEvent } from "../lib/logger.ts";

async function main() {
  const started = Date.now();
  logEvent("cron.orphan-cleanup.start", {});
  const report = await runOrphanCleanup();
  logEvent("cron.orphan-cleanup.done", { ms: Date.now() - started, report });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logError("cron.orphan-cleanup.fatal", err);
    process.exit(1);
  });
