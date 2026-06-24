// graphile-worker task: nightly orphan cleanup.
// Triggered by parsedCronItems at 03:30 America/Santiago.
// Actual deletes gated by DB_ORPHAN_CLEANUP=1 inside runOrphanCleanup().

import type { Task } from "graphile-worker";
import { runOrphanCleanup } from "../../lib/cleanup-orphans.ts";
import { logEvent } from "../../lib/logger.ts";

export const orphan_cleanup: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("orphan_cleanup.start");
  const report = await runOrphanCleanup();
  logEvent("queue.orphan_cleanup.done", { ms: Date.now() - started, report });
};
