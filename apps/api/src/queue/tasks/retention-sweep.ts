// graphile-worker task: automated PII retention sweep (Ley 21.719).
// Triggered by parsedCronItems at 04:00 America/Santiago.
// Actual deletes/anonymizations gated by DB_RETENTION_SWEEP=1 inside
// runRetentionSweep() — unset = dry-run (counts only). Clinical/ficha tables
// are hard-guarded (15-yr retention) and never swept.

import type { Task } from "graphile-worker";
import { logEvent } from "../../lib/logger.ts";
import { runRetentionSweep } from "../../lib/retention-sweep.ts";

export const retention_sweep: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("retention_sweep.start");
  const report = await runRetentionSweep();
  logEvent("queue.retention_sweep.done", { ms: Date.now() - started, report });
};
