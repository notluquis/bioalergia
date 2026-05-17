import { dbClinicalSeries as db } from "@finanzas/db/slices";

import { refreshClinicalSeriesMetadata } from "../metadata.ts";

export async function mergeClinicalSeries(params: {
  isAuto?: boolean;
  mergeReason?: string;
  mergedBy?: number;
  sourceId: number;
  targetId: number;
}): Promise<{ eventsMovedCount: number }> {
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

  const eventsMovedCount = await db.$transaction(async (tx) => {
    const { count } = await tx.event.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });

    await tx.$executeRaw`
      INSERT INTO clinical_series_merge_log
        (source_id, target_id, events_moved, merged_by, merge_reason, is_auto)
      VALUES
        (${params.sourceId}, ${params.targetId}, ${count},
         ${params.mergedBy ?? null}, ${params.mergeReason ?? null}, ${params.isAuto ?? false})
    `;

    await tx.clinicalSeries.delete({ where: { id: params.sourceId } });

    return count;
  });

  await refreshClinicalSeriesMetadata(params.targetId);

  return { eventsMovedCount };
}
