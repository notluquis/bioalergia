import { db } from "@finanzas/db";
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
  let q = db.$qb
    .selectFrom("ClinicalRecordImport as cri")
    .select(["cri.id as id", "cri.createdAt as createdAt"])
    .where("cri.status", "in", ["PENDING_REVIEW", "ERROR"]);
  if (after) {
    // Keyset tuple comparison kept as a raw fragment (Kysely's tuple ops don't
    // express row-value `>` cleanly): physical snake_case columns inside `sql`.
    q = q.where(
      sql<boolean>`(cri.created_at, cri.id) > (${after.createdAt}::timestamptz, ${after.id})`
    );
  }
  const rows = await q
    .orderBy("cri.createdAt", "asc")
    .orderBy("cri.id", "asc")
    .limit(limit)
    .execute();
  // $qb tipa la columna timestamp como string; el parser pg la entrega Date en
  // runtime — coercionar mantiene el tipo de retorno (Date) y el cursor keyset.
  return rows.map((r) => ({ id: r.id, createdAt: new Date(r.createdAt) }));
}

async function countPending(): Promise<number> {
  return db.clinicalRecordImport.count({
    where: { status: { in: ["PENDING_REVIEW", "ERROR"] } },
  });
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
      // ORM equivalent of the old raw select. The DB-side
      // `jsonb_array_length(match_candidates) > 0` filter is folded into the JS
      // loop below: an empty/null array yields best=null and is never pushed to
      // `eligible`, so the eligible set is identical.
      // El filtro jsonb_array_length>0 se pliega al loop JS (empty/null → best=null
      // → nunca se pushea a `eligible`), así evitamos el filtro Json-null del ORM.
      const rows = (await db.clinicalRecordImport.findMany({
        where: { status: "PENDING_REVIEW" },
        select: { id: true, matchCandidates: true },
        orderBy: { createdAt: "asc" },
      })) as Array<{ id: string; matchCandidates: Cand[] | null }>;

      const eligible: Array<{ id: string; patientId: number }> = [];
      for (const r of rows) {
        let best: Cand | null = null;
        for (const c of r.matchCandidates ?? []) {
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
