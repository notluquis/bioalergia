import { db } from "@finanzas/db";
import { examReportsContract } from "@finanzas/orpc-contracts/exam-reports";
import type { z } from "zod";

// Lógica DB del update de exam reports, fuera del handler oRPC. Mantener el
// db.$transaction en el service layer (contexto de tipos liviano) evita el
// TS2321 "Excessive stack depth" que dispara el TransactionClientContract
// profundo cuando se instancia inline en el handler pesado. El handler queda
// fino: llama esto y luego lee el detalle para serializar.
type UpdateExamReportInput = z.infer<
  NonNullable<(typeof examReportsContract.update)["~orpc"]["inputSchema"]>
>;

export async function applyExamReportUpdate(input: UpdateExamReportInput): Promise<void> {
  const { id, sections, ...rest } = input;
  // Replace sections wholesale on update — simpler than diffing.
  await db.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) data[k] = v;
    }
    await tx.examReport.update({ where: { id }, data });
    if (sections) {
      await tx.examReportSection.deleteMany({ where: { examReportId: id } });
      for (const [sIdx, s] of sections.entries()) {
        await tx.examReportSection.create({
          data: {
            examReportId: id,
            sectionKey: s.sectionKey,
            label: s.label,
            position: s.position ?? sIdx,
            reactions: {
              create: s.reactions.map((rx, rxIdx) => ({
                allergenId: rx.allergenId,
                reaction: rx.reaction,
                papuleMm: rx.papuleMm ?? null,
                notes: rx.notes ?? null,
                position: rx.position ?? rxIdx,
              })),
            },
          },
        });
      }
    }
  });
}
