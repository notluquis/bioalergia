// Railway Cron entrypoint: WA scheduled + broadcast pump.
//
// Replaces the in-process setInterval pollers (5s broadcast, 30s scheduled)
// that kept api heap hot 24/7 (closures + timer refs blocking GC).
//
// Recommended Railway cron schedule: */1 * * * *  (every minute).
// startCommand: node --max-old-space-size=256 src/cron-jobs/run-wa-pump.ts
//
// Each invocation: drain one scheduled batch + advance one broadcast tick,
// then exit(0). Process death = guaranteed memory release.

import "../instrument.ts";
import { runOnce as runBroadcastOnce } from "../modules/wa-cloud/broadcast-runner.ts";
import { runOnce as runScheduledOnce } from "../modules/wa-cloud/scheduled-sender.ts";
import { logError, logEvent } from "../lib/logger.ts";

async function main() {
  const started = Date.now();
  logEvent("cron.wa-pump.start", {});

  const results = await Promise.allSettled([runScheduledOnce(), runBroadcastOnce()]);
  for (const [i, r] of results.entries()) {
    if (r.status === "rejected") {
      logError(`cron.wa-pump.task${i}.failed`, r.reason);
    }
  }

  logEvent("cron.wa-pump.done", { ms: Date.now() - started });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logError("cron.wa-pump.fatal", err);
    process.exit(1);
  });
