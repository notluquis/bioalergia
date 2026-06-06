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
import {
  approveClinicalRecordImport,
  reprocessClinicalRecordImport,
} from "./clinical-record-imports.ts";

// Background bulk reprocess for clinical_record_imports. One in-flight
// job at a time (in-process lock via the existing jobQueue's
// getActiveJobsByType). Operator triggers via the intranet review page; the
// worker walks the PENDING_REVIEW + ERROR queue by keyset pagination and
// reports incremental progress so the UI can poll without blocking.
//
// Throughput: a bounded worker pool (CLINICAL_RECORD_REPROCESS_CONCURRENCY,
// default 6, capped under the pg pool of 10) runs reprocesses in parallel.
// The slow part — the OneDrive xlsx download — happens OUTSIDE each import's
// short advisory-locked transaction, so distinct ids never contend and the
// network-bound work overlaps. Serial processing was the bottleneck on the
// ~14k backfilled corpus.
//
// Cancellable: workers check isJobCancelled(jobId) between imports so the
// operator can stop a runaway batch from the UI.

const JOB_TYPE = "clinical-record-bulk-reprocess";
const AUTO_APPROVE_JOB_TYPE = "clinical-record-auto-approve";
// Rows fetched per keyset page. The real throughput knob is concurrency below.
const FETCH_BATCH = 200;
// Each reprocess does the slow OneDrive download OUTSIDE its (short) advisory-
// locked transaction, so workers parallelize the network-bound part. Cap well
// under the pg pool (max 10) to leave headroom for the rest of the app.
const DEFAULT_REPROCESS_CONCURRENCY = 6;
const MAX_REPROCESS_CONCURRENCY = 10;

function resolveReprocessConcurrency(): number {
  const raw = Number.parseInt(process.env.CLINICAL_RECORD_REPROCESS_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_REPROCESS_CONCURRENCY;
  return Math.min(raw, MAX_REPROCESS_CONCURRENCY);
}

export function getClinicalRecordBulkJobType(): string {
  return JOB_TYPE;
}

export function getClinicalRecordAutoApproveJobType(): string {
  return AUTO_APPROVE_JOB_TYPE;
}

type PendingCursor = { createdAt: Date; id: string } | null;

// Keyset pagination over the pending queue: walk (created_at, id) forward so
// each row is visited exactly once per run — even the no-match rows that stay
// PENDING_REVIEW after reprocess. Avoids the old O(n²) growing exclude-set.
async function fetchPendingBatch(
  limit: number,
  after: PendingCursor
): Promise<Array<{ id: string; createdAt: Date }>> {
  const rows = await sql<{ id: string; created_at: Date }>`
    SELECT id, created_at FROM clinical_record_imports
    WHERE status IN ('PENDING_REVIEW', 'ERROR')
      ${after ? sql`AND (created_at, id) > (${after.createdAt}::timestamptz, ${after.id})` : sql``}
    ORDER BY created_at ASC, id ASC
    LIMIT ${limit}
  `.execute(kysely);
  return rows.rows.map((r) => ({ id: r.id, createdAt: r.created_at }));
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
    return active[0].id;
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
          { phase: "completed" }
        );
        return;
      }

      updateJobProgress(
        jobId,
        0,
        `Procesando ${total} fichas clínicas`,
        {
          phase: "running",
          total,
        },
        total
      );

      let processed = 0;
      let imported = 0;
      let pending = 0;
      let errors = 0;
      const concurrency = resolveReprocessConcurrency();
      let cursor: PendingCursor = null;

      while (processed < total) {
        if (isJobCancelled(jobId)) {
          throw new Error("SYNC_CANCELLED");
        }
        const batch = await fetchPendingBatch(Math.min(FETCH_BATCH, total - processed), cursor);
        if (batch.length === 0) break;
        // Advance the keyset past this page before processing — reprocess may
        // leave a no-match row PENDING_REVIEW, and we must not revisit it.
        const last = batch[batch.length - 1];
        cursor = { createdAt: last.createdAt, id: last.id };

        // Bounded worker pool: N workers pull from the shared batch. Counter
        // increments are safe (single-threaded between awaits). The slow part
        // (OneDrive download) runs outside the per-import advisory lock, so
        // distinct ids never contend.
        let idx = 0;
        const worker = async () => {
          while (idx < batch.length && processed < total) {
            if (isJobCancelled(jobId)) {
              throw new Error("SYNC_CANCELLED");
            }
            const { id } = batch[idx++];
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
            if (processed % 25 === 0 || processed === total) {
              updateJobProgress(
                jobId,
                processed,
                `Procesando fichas clínicas (${processed}/${total})`,
                { phase: "running", imported, pending, errors, concurrency },
                total
              );
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker));
      }

      completeJob(
        jobId,
        { processed, imported, pending, errors },
        `Reprocesamiento completado — ${imported} importadas, ${pending} pendientes, ${errors} errores`,
        { phase: "completed", imported, pending, errors }
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

// Auto-approve every PENDING_REVIEW import whose best match candidate clears
// the score threshold. Reuses the single-row approve path (materializes the
// ClinicalRecord + ClinicalSeries) and reports progress via the same job
// status schema so the UI can poll/cancel it like the reprocess job.
export function startAutoApproveHighConfidenceJob(options: {
  minScore: number;
  reviewedBy: number;
  trigger?: string;
}): string {
  const active = getActiveJobsByType(AUTO_APPROVE_JOB_TYPE);
  if (active.length > 0) {
    return active[0].id;
  }

  const jobId = startJob(AUTO_APPROVE_JOB_TYPE, 1);
  updateJobProgress(jobId, 0, "Buscando fichas con match de alta confianza", {
    phase: "starting",
  });

  void (async () => {
    try {
      type Cand = { patientId: number; score: number };
      const rows = (
        await sql<{ id: string; cands: Cand[] | null }>`
          SELECT id, match_candidates AS cands
          FROM clinical_record_imports
          WHERE status = 'PENDING_REVIEW'
            AND match_candidates IS NOT NULL
            AND jsonb_array_length(match_candidates::jsonb) > 0
          ORDER BY created_at ASC
        `.execute(kysely)
      ).rows;

      const eligible: Array<{ id: string; patientId: number }> = [];
      for (const r of rows) {
        let best: Cand | null = null;
        for (const c of r.cands ?? []) {
          if (!best || c.score > best.score) best = c;
        }
        if (best && best.score >= options.minScore) {
          eligible.push({ id: r.id, patientId: best.patientId });
        }
      }

      const total = eligible.length;
      if (total === 0) {
        completeJob(
          jobId,
          { processed: 0, imported: 0, pending: 0, errors: 0 },
          "Sin fichas que superen el umbral",
          { phase: "completed" }
        );
        return;
      }

      updateJobProgress(
        jobId,
        0,
        `Aprobando ${total} fichas de alta confianza`,
        { phase: "running", total, minScore: options.minScore },
        total
      );

      let imported = 0;
      let errors = 0;
      let processed = 0;
      for (const e of eligible) {
        if (isJobCancelled(jobId)) {
          throw new Error("SYNC_CANCELLED");
        }
        try {
          await approveClinicalRecordImport(
            e.id,
            e.patientId,
            options.reviewedBy,
            `auto-approve ≥ ${options.minScore}`
          );
          imported += 1;
        } catch {
          errors += 1;
        }
        processed += 1;
        if (processed % 5 === 0 || processed === total) {
          updateJobProgress(
            jobId,
            processed,
            `Aprobadas ${imported} de ${total}`,
            { phase: "running", imported, errors },
            total
          );
        }
      }

      completeJob(
        jobId,
        { processed, imported, pending: 0, errors },
        `Auto-aprobación completada — ${imported} importadas, ${errors} errores`,
        { phase: "completed", imported, errors }
      );
      logEvent("clinicalRecords.autoApprove.completed", {
        processed,
        imported,
        errors,
        minScore: options.minScore,
        trigger: options.trigger ?? "intranet",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "SYNC_CANCELLED") {
        cancelJob(jobId, "Auto-aprobación cancelada por usuario");
        logEvent("clinicalRecords.autoApprove.cancelled", {});
        return;
      }
      failJob(jobId, message);
      logError("clinicalRecords.autoApprove.failed", error, {});
    }
  })();

  return jobId;
}
