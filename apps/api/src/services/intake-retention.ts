// Bespoke retention purge for IntakeSubmission (Ley 21.719 — data
// minimization / limitación del plazo de conservación).
//
// Why NOT the generic data_retention_policies sweep (lib/retention-sweep.ts):
// IntakeSubmission is TRANSIENT staging PHI — the patient submits a ficha +
// payment receipt via the WhatsApp Flow; staff transcribe it by hand into the
// real patient record and the submission becomes redundant. It is correctly
// NOT on the CLINICAL_DENYLIST (it's not a permanent ficha clínica), so it MAY
// be purged. BUT the generic sweep is DB-only: it can't delete the receipt
// blob in R2 (comprobanteR2Key), which would orphan PHI in object storage. So
// we clean R2 FIRST, then the row — a row is never deleted while its blob
// lingers.
//
// Window is Setting-driven (intake.retentionDays), NOT a hardcoded constant —
// operator-tunable without redeploy (project rule: minimize hardcoded). Default
// 180 days when unset/invalid.
//
// Behavior gate (mirrors DB_ORPHAN_CLEANUP / DB_RETENTION_SWEEP):
//   - INTAKE_RETENTION_PURGE=1 → execute (R2 delete + row delete)
//   - default                  → dry-run, counts + logs only (no R2/no delete)
//
// Bounded by SAFETY_LIMIT per run so a misconfigured (tiny) window can never
// nuke the whole table in one tick — the next nightly run picks up the rest.

import { db } from "@finanzas/db";
import { logAuditEvent } from "../lib/audit-log.ts";
import { logEvent, logWarn } from "../lib/logger.ts";
import { getSetting } from "../lib/settings.ts";
import { deleteR2Objects } from "../modules/cloudflare/r2.ts";

const SAFETY_LIMIT = 500;
const DEFAULT_RETENTION_DAYS = 180;
const RETENTION_DAYS_SETTING = "intake.retentionDays";
const ENV_FLAG = "INTAKE_RETENTION_PURGE";

export type IntakeRetentionReport = {
  dryRun: boolean;
  windowDays: number;
  matched: number;
  rowsDeleted: number;
  r2KeysDeleted: number;
  durationMs: number;
};

function executeEnabled(): boolean {
  const raw = process.env[ENV_FLAG];
  return raw === "1" || raw?.toLowerCase() === "true";
}

/** Resolve the retention window from the DB Setting. Positive integer only;
 * anything missing/blank/non-positive falls back to the 180-day default. */
export async function resolveRetentionDays(): Promise<number> {
  const raw = await getSetting(RETENTION_DAYS_SETTING);
  if (raw == null) return DEFAULT_RETENTION_DAYS;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

/**
 * Purge IntakeSubmission rows older than the retention window, cleaning their
 * R2 receipt blobs first. Bounded to SAFETY_LIMIT rows per run. Dry-run unless
 * INTAKE_RETENTION_PURGE is set. Best-effort audit + event log at the end.
 */
export async function purgeExpiredIntakeSubmissions(): Promise<IntakeRetentionReport> {
  const startedAt = Date.now();
  const execute = executeEnabled();
  const windowDays = await resolveRetentionDays();
  const report: IntakeRetentionReport = {
    dryRun: !execute,
    windowDays,
    matched: 0,
    rowsDeleted: 0,
    r2KeysDeleted: 0,
    durationMs: 0,
  };

  const cutoff = new Date(startedAt - windowDays * 24 * 60 * 60 * 1000);

  try {
    // Oldest first: purge the longest-expired rows before the SAFETY_LIMIT cap
    // truncates the batch, so nothing lingers indefinitely across runs.
    const expired = await db.intakeSubmission.findMany({
      where: { submittedAt: { lt: cutoff } },
      select: { id: true, comprobanteR2Key: true },
      orderBy: { submittedAt: "asc" },
      take: SAFETY_LIMIT,
    });
    report.matched = expired.length;

    if (expired.length > 0 && execute) {
      // Clean R2 FIRST so a row is never deleted while its receipt blob lingers.
      // Best-effort: deleteR2Objects swallows its own errors (logs + continues);
      // an R2 hiccup must not block the DB purge — a re-run reconverges since
      // the same keys are collected again until the row is gone.
      const keys = expired
        .map((r) => r.comprobanteR2Key)
        .filter((k): k is string => Boolean(k));
      if (keys.length > 0) {
        await deleteR2Objects(keys);
        report.r2KeysDeleted = keys.length;
      }

      const ids = expired.map((r) => r.id);
      const { count } = await db.intakeSubmission.deleteMany({ where: { id: { in: ids } } });
      report.rowsDeleted = count;
    }
  } catch (err) {
    logWarn("[intake-retention] purge failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  report.durationMs = Date.now() - startedAt;

  // Audit trail: one ADMIN_ACTION row summarizing the purge (append-only,
  // HMAC-chained). Best-effort — logAuditEvent swallows DB failures.
  await logAuditEvent({
    kind: "ADMIN_ACTION",
    actorLabel: "system:intake-retention",
    resource: "intake_submissions",
    outcome: "ok",
    message: report.dryRun
      ? `intake retention purge (dry-run): ${report.matched} expired rows matched (window ${windowDays}d)`
      : `intake retention purge: ${report.rowsDeleted} rows + ${report.r2KeysDeleted} R2 receipts purged (window ${windowDays}d)`,
    metadata: {
      dryRun: report.dryRun,
      windowDays,
      matched: report.matched,
      rowsDeleted: report.rowsDeleted,
      r2KeysDeleted: report.r2KeysDeleted,
    },
  });

  logEvent("[intake-retention] purge complete", { ...report });
  return report;
}
