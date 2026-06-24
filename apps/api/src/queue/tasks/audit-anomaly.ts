// graphile-worker task: breach / anomaly detection over audit_logs.
// Triggered by parsedCronItems every N minutes (default */15). Thresholds +
// window come from DB settings (lib/audit-anomaly.ts) — no hardcoded values.
// On anomaly: emitSecurityAlert (Web Push to admins, deduped) + AuditLog row.

import type { Task } from "graphile-worker";
import { runAuditAnomaly } from "../../lib/audit-anomaly.ts";
import { logEvent } from "../../lib/logger.ts";

export const audit_anomaly: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("audit_anomaly.start");
  const report = await runAuditAnomaly();
  logEvent("queue.audit_anomaly.done", { ms: Date.now() - started, report });
};
