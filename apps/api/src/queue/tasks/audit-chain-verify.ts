// graphile-worker task: nightly audit-log tamper-evidence check.
// Verifies the HMAC hash chain of `audit_logs` (RFC 6962-style append-only).
// If any row's chain hash fails, the access log has been altered → critical
// alert. Integrity control for Decreto 41/2012 art. 9 / Ley 20.584 (the ficha
// access log must be trustworthy) and HIPAA §164.312(c)(1).
// Triggered by parsedCronItems nightly (after orphan_cleanup).

import type { Task } from "graphile-worker";
import { verifyAuditChain } from "../../lib/audit-log-verify.ts";
import { logEvent } from "../../lib/logger.ts";
import { emitSecurityAlert } from "../../lib/security-alerts.ts";

export const audit_chain_verify: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("audit_chain_verify.start");
  // null = chain intact; otherwise the id of the first tampered row.
  const tamperedId = await verifyAuditChain();
  if (tamperedId !== null) {
    await emitSecurityAlert({
      scope: "global",
      alertType: "audit_chain_tampered",
      severity: "critical",
      title: "Cadena de auditoría alterada",
      message: `La verificación HMAC del registro de auditoría falló en la fila #${tamperedId}. Posible manipulación del log de accesos a fichas.`,
      details: { tamperedRowId: tamperedId.toString() },
    });
  }
  logEvent("queue.audit_chain_verify.done", {
    ms: Date.now() - started,
    tamperedRowId: tamperedId === null ? null : tamperedId.toString(),
  });
};
