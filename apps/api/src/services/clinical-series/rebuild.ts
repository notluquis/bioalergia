import { dbClinicalSeries as db } from "@finanzas/db/slices";

import {
  clearRebuildJobAfter,
  patchRebuildJob,
  setRebuildJob,
} from "../clinical-series-rebuild-status.ts";

import { syncClinicalSeriesForEventIds } from "./assignment/sync.ts";
import { TIMEZONE } from "./constants.ts";
import { detectDuplicateSeries } from "./duplicates/detect.ts";
import { mergeClinicalSeries } from "./duplicates/merge.ts";
import { updateAllSeriesStatuses } from "./status.ts";

export async function rebuildClinicalSeries(
  params?: { autoMerge?: boolean; from?: string; to?: string },
  onProgress?: (processed: number, total: number) => void
): Promise<{
  deleted: number;
  deduped: number;
  from: null | string;
  processed: number;
  to: null | string;
}> {
  const rows = await db.$queryRaw<Array<{ eventId: number }>>`
    SELECT e.id AS "eventId"
    FROM events e
    WHERE (
      e.category IN ('Test y exámenes', 'Tratamiento subcutáneo')
      OR e.clinical_series_id IS NOT NULL
    )
      AND (
        ${params?.from ?? null}::date IS NULL
        OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) >= ${params?.from ?? null}::date
      )
      AND (
        ${params?.to ?? null}::date IS NULL
        OR COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) <= ${params?.to ?? null}::date
      )
    ORDER BY COALESCE(e.start_date, (e.start_date_time AT TIME ZONE ${TIMEZONE})::date) ASC, e.id ASC
  `;

  const total = rows.length;
  // Signal total is now known before processing starts
  onProgress?.(0, total);
  await syncClinicalSeriesForEventIds(
    rows.map((row) => row.eventId),
    onProgress
  );

  // Cleanup: delete series that ended up with no events after reassignment.
  const { count: deleted } = await db.clinicalSeries.deleteMany({
    where: { events: { none: {} } },
  });

  // Dedup pass: merge duplicates only when explicitly requested
  let deduped = 0;
  if (params?.autoMerge) {
    const duplicates = await detectDuplicateSeries();
    for (const dup of duplicates) {
      await mergeClinicalSeries({
        isAuto: true,
        mergeReason: dup.reason,
        sourceId: dup.sourceId,
        targetId: dup.targetId,
      });
    }
    deduped = duplicates.length;
  }

  // Update derived statuses for all series based on event dates.
  await updateAllSeriesStatuses();

  return {
    deleted,
    deduped,
    from: params?.from ?? null,
    processed: total,
    to: params?.to ?? null,
  };
}

// ─── Rebuild Job State (SSE progress) ────────────────────────────────────────
//
// `RebuildJob` interface, the live job singleton, and the read-only
// `getCurrentRebuildJob()` accessor live in
// `../clinical-series-rebuild-status.ts` so consumers that only need
// to observe progress (e.g. `app.ts`'s SSE endpoint) don't drag this
// module into their type-check closure. This module mutates state
// via the imported `setRebuildJob` / `patchRebuildJob` /
// `clearRebuildJobAfter` helpers.

export function startRebuildClinicalSeries(params?: {
  autoMerge?: boolean;
  from?: string;
  to?: string;
}): string {
  const jobId = `rebuild-${Date.now()}`;
  setRebuildJob({
    jobId,
    status: "running",
    progress: 0,
    processed: 0,
    total: 0,
    currentStep: "Consultando eventos...",
    from: params?.from ?? null,
    to: params?.to ?? null,
  });

  rebuildClinicalSeries(params, (processed, total) => {
    patchRebuildJob(jobId, {
      processed,
      total,
      progress: total > 0 ? Math.round((processed / total) * 100) : 0,
      currentStep:
        processed === 0
          ? `${total} eventos encontrados, reorganizando...`
          : `Reorganizando ${processed} de ${total}...`,
    });
  })
    .then((result) => {
      patchRebuildJob(jobId, {
        status: "completed",
        progress: 100,
        processed: result.processed,
        currentStep:
          result.deduped > 0
            ? `${result.processed} eventos procesados · ${result.deduped} serie${result.deduped !== 1 ? "s" : ""} fusionada${result.deduped !== 1 ? "s" : ""}`
            : `${result.processed} eventos procesados`,
      });
      clearRebuildJobAfter(jobId, 8000);
    })
    .catch((err: unknown) => {
      patchRebuildJob(jobId, {
        status: "failed",
        error: err instanceof Error ? err.message : "Error desconocido",
      });
      clearRebuildJobAfter(jobId, 8000);
    });

  return jobId;
}
