import { db } from "@finanzas/db";
import type { createImmunoAdministrationInputSchema } from "@finanzas/orpc-contracts/immunotherapy";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type CreateInput = z.infer<typeof createImmunoAdministrationInputSchema>;

/**
 * Registra una dosis administrada en el carnet de inmunoterapia (capa de
 * seguridad: vial/lote/sitio + observación 30 min + reacción WAO). Lanza
 * NOT_FOUND si el paciente no existe.
 */
export async function createImmunoAdministration(
  input: CreateInput,
  administeredBy: number
): Promise<{ id: string }> {
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) throw new DomainError("NOT_FOUND", "Paciente no encontrado");

  if (input.clinicalSeriesId != null) {
    const series = await db.clinicalSeries.findUnique({
      where: { id: input.clinicalSeriesId },
      select: { id: true },
    });
    if (!series) throw new DomainError("NOT_FOUND", "Serie clínica no encontrada");
  }

  const created = await db.immunotherapyAdministration.create({
    data: {
      patientId: input.patientId,
      clinicalSeriesId: input.clinicalSeriesId ?? null,
      eventId: input.eventId ?? null,
      administeredAt: input.administeredAt,
      doseLabel: input.doseLabel,
      doseMl: input.doseMl,
      vialDescription: input.vialDescription,
      vialLot: input.vialLot,
      vialExpiry: input.vialExpiry ?? null,
      injectionSite: input.injectionSite,
      observationMinutes: input.observationMinutes,
      observationCompleted: input.observationCompleted,
      hadLocalReaction: input.hadLocalReaction,
      localReactionNote: input.localReactionNote,
      systemicReactionGrade: input.systemicReactionGrade ?? null,
      reactionNote: input.reactionNote,
      premedication: input.premedication,
      notes: input.notes,
      administeredBy,
    },
    select: { id: true },
  });

  return { id: created.id };
}

/** Carnet del paciente: dosis administradas, más reciente primero. */
export async function listImmunoAdministrationsByPatient(
  patientId: number
): Promise<{ items: Awaited<ReturnType<typeof db.immunotherapyAdministration.findMany>> }> {
  const items = await db.immunotherapyAdministration.findMany({
    where: { patientId },
    orderBy: { administeredAt: "desc" },
    take: 200,
  });
  return { items };
}
