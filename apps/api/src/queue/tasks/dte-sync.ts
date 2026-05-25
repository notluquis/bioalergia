// graphile-worker task: daily DTE sync (Haulmer).
// Triggered by parsedCronItems at 17:00 America/Santiago.

import type { Task } from "graphile-worker";
import { syncDTEs } from "../../services/dte-sync.ts";
import { logEvent } from "../../lib/logger.ts";

export const dte_sync: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("dte_sync.start");
  const result = await syncDTEs({ triggerSource: "cron" });
  const totals = result.results.reduce(
    (acc, r) => {
      acc.inserted += r.inserted;
      acc.updated += r.updated;
      acc.processed += r.processed;
      return acc;
    },
    { inserted: 0, updated: 0, processed: 0 }
  );
  logEvent("queue.dte_sync.done", {
    ms: Date.now() - started,
    status: result.status,
    period: result.period,
    logId: result.logId,
    ...totals,
  });
};
