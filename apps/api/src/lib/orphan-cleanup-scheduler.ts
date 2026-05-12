import cron from "node-cron";
import { runOrphanCleanup } from "./cleanup-orphans.ts";
import { logEvent, logWarn } from "./logger.ts";

// Nightly orphan cleanup. Runs at 03:30 America/Santiago (low-traffic
// window between the daily DTE sync and Doctoralia IMAP poll). Cron
// expression configurable via ORPHAN_CLEANUP_CRON; behaviour gated by
// DB_ORPHAN_CLEANUP=1 inside runOrphanCleanup itself, so a misconfig
// downgrades to a logging-only dry-run instead of unintended deletes.

const DEFAULT_CRON = "30 3 * * *";
const TIMEZONE = "America/Santiago";

export function startOrphanCleanupScheduler(): void {
  const expr = process.env.ORPHAN_CLEANUP_CRON || DEFAULT_CRON;
  if (!cron.validate(expr)) {
    logWarn("[orphan-cleanup.scheduler] disabled", { cronExpression: expr, reason: "invalid_cron" });
    return;
  }
  cron.schedule(
    expr,
    async () => {
      try {
        await runOrphanCleanup();
      } catch (err) {
        logWarn("[orphan-cleanup.scheduler] run failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { timezone: TIMEZONE },
  );
  logEvent("[orphan-cleanup.scheduler] started", { cronExpression: expr, timezone: TIMEZONE });
}
