import { dbClinicalSeries as db } from "@finanzas/db/slices";

import { DomainError } from "../../../lib/errors.ts";
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

  if (!source) throw new DomainError("NOT_FOUND", `Serie fuente #${params.sourceId} no encontrada`);
  if (!target)
    throw new DomainError("NOT_FOUND", `Serie destino #${params.targetId} no encontrada`);
  if (source.kind !== target.kind) {
    throw new DomainError(
      "BAD_REQUEST",
      `No se pueden fusionar series de distinto tipo (${source.kind} vs ${target.kind})`
    );
  }

  const moveCounts = await db.$transaction(async (tx) => {
    const events = await tx.event.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });
    const skinTests = await tx.clinicalSkinTest.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });
    const records = await tx.clinicalRecord.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });
    await tx.clinicalDocumentImport.updateMany({
      where: { clinicalSeriesId: params.sourceId },
      data: { clinicalSeriesId: params.targetId },
    });
    await tx.clinicalRecordImport.updateMany({
      where: { matchedClinicalSeriesId: params.sourceId },
      data: { matchedClinicalSeriesId: params.targetId },
    });
    await tx.abandonmentContact.updateMany({
      where: { seriesId: params.sourceId },
      data: { seriesId: params.targetId },
    });

    await tx.clinicalSeriesMergeLog.create({
      data: {
        sourceId: params.sourceId,
        targetId: params.targetId,
        eventsMoved: events.count,
        mergedBy: params.mergedBy ?? null,
        mergeReason: params.mergeReason ?? null,
        isAuto: params.isAuto ?? false,
      },
    });

    await tx.clinicalSeries.delete({ where: { id: params.sourceId } });

    return {
      eventsMovedCount: events.count,
      recordsMovedCount: records.count,
      skinTestsMovedCount: skinTests.count,
    };
  });

  await refreshClinicalSeriesMetadata(params.targetId);

  return moveCounts;
}
