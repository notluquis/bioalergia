import { dbClinicalSeries as db } from "@finanzas/db/slices";

import { refreshClinicalSeriesMetadata } from "../metadata.ts";

export async function mergeClinicalSeries(params: {
  isAuto?: boolean;
  mergeReason?: string;
  mergedBy?: number;
  sourceId: number;
  targetId: number;
}): Promise<{ eventsMovedCount: number; recordsMovedCount: number; skinTestsMovedCount: number }> {
  const [source, target] = await Promise.all([
    db.clinicalSeries.findUnique({
      select: { id: true, kind: true },
      where: { id: params.sourceId },
    }),
    db.clinicalSeries.findUnique({
      select: { id: true, kind: true },
      where: { id: params.targetId },
    }),
  ]);

  if (!source) throw new Error(`Serie fuente #${params.sourceId} no encontrada`);
  if (!target) throw new Error(`Serie destino #${params.targetId} no encontrada`);
  if (source.kind !== target.kind) {
    throw new Error(
      `No se pueden fusionar series de distinto tipo (${source.kind} vs ${target.kind})`
    );
  }

  const moveCounts = await db.$transaction(async (tx) => {
    const events = await tx.event.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });
    const skinTests = await tx.$queryRaw<Array<{ count: number }>>`
      WITH moved AS (
        UPDATE clinical_skin_tests
        SET clinical_series_id = ${params.targetId}, updated_at = now()
        WHERE clinical_series_id = ${params.sourceId}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM moved
    `;
    const records = await tx.$queryRaw<Array<{ count: number }>>`
      WITH moved AS (
        UPDATE clinical_records
        SET clinical_series_id = ${params.targetId}, updated_at = now()
        WHERE clinical_series_id = ${params.sourceId}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM moved
    `;
    await tx.$executeRaw`
      UPDATE clinical_document_imports
      SET clinical_series_id = ${params.targetId}, updated_at = now()
      WHERE clinical_series_id = ${params.sourceId}
    `;
    await tx.$executeRaw`
      UPDATE clinical_record_imports
      SET matched_clinical_series_id = ${params.targetId}, updated_at = now()
      WHERE matched_clinical_series_id = ${params.sourceId}
    `;
    await tx.$executeRaw`
      UPDATE abandonment_contacts
      SET series_id = ${params.targetId}
      WHERE series_id = ${params.sourceId}
    `;

    await tx.$executeRaw`
      INSERT INTO clinical_series_merge_log
        (source_id, target_id, events_moved, merged_by, merge_reason, is_auto)
      VALUES
        (${params.sourceId}, ${params.targetId}, ${events.count},
         ${params.mergedBy ?? null}, ${params.mergeReason ?? null}, ${params.isAuto ?? false})
    `;

    await tx.clinicalSeries.delete({ where: { id: params.sourceId } });

    return {
      eventsMovedCount: events.count,
      recordsMovedCount: records[0]?.count ?? 0,
      skinTestsMovedCount: skinTests[0]?.count ?? 0,
    };
  });

  await refreshClinicalSeriesMetadata(params.targetId);

  return moveCounts;
}
