// graphile-worker task: nightly IntakeSubmission retention purge (Ley 21.719).
// Triggered by parsedCronItems at 04:30 America/Santiago.
// Actual R2 + row deletes gated by INTAKE_RETENTION_PURGE=1 inside
// purgeExpiredIntakeSubmissions() — unset = dry-run (counts only). Window from
// the intake.retentionDays Setting (default 180d). Staging PHI only; the ficha
// clínica is a separate permanent model and is never touched here.

import type { Task } from "graphile-worker";
import { logEvent } from "../../lib/logger.ts";
import { purgeExpiredIntakeSubmissions } from "../../services/intake-retention.ts";

export const intake_retention: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("intake_retention.start");
  const report = await purgeExpiredIntakeSubmissions();
  logEvent("queue.intake_retention.done", { ms: Date.now() - started, report });
};
