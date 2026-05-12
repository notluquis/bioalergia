import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import {
  cancelJob,
  completeJob,
  failJob,
  getActiveJobsByType,
  isJobCancelled,
  startJob,
  updateJobProgress,
} from "../lib/jobQueue.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { reprocessClinicalRecordImport } from "./clinical-record-imports.ts";

// Background bulk reprocess for clinical_record_imports. One in-flight
// job at a time (in-process lock via the existing jobQueue's
// getActiveJobsByType). Operator triggers via the intranet review
// page; the worker walks the PENDING_REVIEW + ERROR queue in batches
// of REPROCESS_BATCH and reports incremental progress so the UI can
// poll without blocking the operator.
//
// Concurrency=1 inside the loop so no two reprocesses target the
// same import row at once (reprocessClinicalRecordImport already
// holds a pg_advisory_xact_lock for cross-replica safety, but
// avoiding parallel calls inside the same process keeps OneDrive
// rate limits + Postgres connection use predictable).
//
// Cancellable: the worker checks isJobCancelled(jobId) between
// imports so the operator can stop a runaway batch from the UI.

const JOB_TYPE = "clinical-record-bulk-reprocess";
const REPROCESS_BATCH = 25;

export function getClinicalRecordBulkJobType(): string {
  return JOB_TYPE;
}

async function fetchPendingIds(limit: number, excludeIds: Set<string>): Promise<string[]> {
  const rows = await sql<{ id: string }>`
    SELECT id FROM clinical_record_imports
    WHERE status IN ('PENDING_REVIEW', 'ERROR')
    ORDER BY created_at ASC
    LIMIT ${limit + excludeIds.size}
  `.execute(kysely);
  return rows.rows.map((r) => r.id).filter((id) => !excludeIds.has(id));
}

async function countPending(): Promise<number> {
  const r = await sql<{ c: string }>`
    SELECT COUNT(*)::text AS c FROM clinical_record_imports
    WHERE status IN ('PENDING_REVIEW', 'ERROR')
  `.execute(kysely);
  return Number.parseInt(r.rows[0]?.c ?? "0", 10);
}

export function startBulkClinicalRecordReprocessJob(options?: {
  trigger?: string;
  /** Hard cap on total imports processed in a single run (default: all pending). */
  maxImports?: number;
}): string {
  const active = getActiveJobsByType(JOB_TYPE);
  if (active.length > 0) {
    return active[0]!.id;
  }

  const jobId = startJob(JOB_TYPE, 1);
  updateJobProgress(jobId, 0, "Preparando reprocesamiento de fichas clínicas", {
    phase: "starting",
  });

  void (async () => {
    try {
      const totalPending = await countPending();
      const cap = options?.maxImports ?? totalPending;
      const total = Math.min(cap, totalPending);
      if (total === 0) {
        completeJob(
          jobId,
          { processed: 0, imported: 0, pending: 0, errors: 0 },
          "Sin fichas pendientes",
          { phase: "completed" },
        );
        return;
      }

      updateJobProgress(jobId, 0, `Procesando ${total} fichas clínicas`, {
        phase: "running",
        total,
      }, total);

      let processed = 0;
      let imported = 0;
      let pending = 0;
      let errors = 0;
      // Track ids that flipped status this run so the next fetchPendingIds
      // call doesn't re-pick them while their status update is still
      // visible to a stale read (also defends against bugs that leave
      // status PENDING after a parser failure).
      const seen = new Set<string>();

      while (processed < total) {
        if (isJobCancelled(jobId)) {
          throw new Error("SYNC_CANCELLED");
        }
        const remaining = total - processed;
        const fetched = await fetchPendingIds(Math.min(REPROCESS_BATCH, remaining), seen);
        if (fetched.length === 0) break;
        for (const id of fetched) {
          if (isJobCancelled(jobId)) {
            throw new Error("SYNC_CANCELLED");
          }
          seen.add(id);
          try {
            const r = await reprocessClinicalRecordImport(id);
            if (r.status === "IMPORTED") imported += 1;
            else if (r.status === "PENDING_REVIEW") pending += 1;
            else errors += 1;
          } catch (err) {
            errors += 1;
            logError("[clinical-record.bulk] import failed", err, { id });
          }
          processed += 1;
          if (processed % 5 === 0 || processed === total) {
            updateJobProgress(
              jobId,
              processed,
              `Procesando fichas clínicas (${processed}/${total})`,
              { phase: "running", imported, pending, errors },
              total,
            );
          }
        }
      }

      completeJob(
        jobId,
        { processed, imported, pending, errors },
        `Reprocesamiento completado — ${imported} importadas, ${pending} pendientes, ${errors} errores`,
        { phase: "completed", imported, pending, errors },
      );
      logEvent("clinicalRecords.bulk.completed", {
        processed,
        imported,
        pending,
        errors,
        trigger: options?.trigger ?? "manual",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "SYNC_CANCELLED") {
        cancelJob(jobId, "Reprocesamiento cancelado por usuario");
        logEvent("clinicalRecords.bulk.cancelled", { trigger: options?.trigger ?? "manual" });
        return;
      }
      failJob(jobId, message);
      logError("clinicalRecords.bulk.failed", error, { trigger: options?.trigger ?? "manual" });
    }
  })();

  return jobId;
}
