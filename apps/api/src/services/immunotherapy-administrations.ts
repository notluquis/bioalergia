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

function fullPatientName(person: {
  names: string | null;
  fatherName: string | null;
  motherName: string | null;
}): string {
  return [person.names, person.fatherName, person.motherName].filter(Boolean).join(" ") || "—";
}

interface AdverseReactionRow {
  id: string;
  patientId: number;
  patientName: string;
  administeredAt: Date;
  doseLabel: string | null;
  vialDescription: string | null;
  vialLot: string | null;
  injectionSite: string | null;
  systemicReactionGrade: number | null;
  hadLocalReaction: boolean;
  localReactionNote: string | null;
  reactionNote: string | null;
  reportedToIsp: boolean;
  ispReportedAt: Date | null;
  ispNotes: string | null;
}

/**
 * Farmacovigilancia: dosis con reacción adversa (sistémica WAO ≥ 1 o local), de
 * todos los pacientes, para el registro de notificación al ISP (Norma 140).
 */
export async function listAdverseReactions(): Promise<{ items: AdverseReactionRow[] }> {
  const rows = await db.immunotherapyAdministration.findMany({
    where: {
      OR: [{ systemicReactionGrade: { gte: 1 } }, { hadLocalReaction: true }],
    },
    orderBy: { administeredAt: "desc" },
    take: 500,
    include: {
      patient: {
        select: {
          person: { select: { names: true, fatherName: true, motherName: true } },
        },
      },
    },
  });

  const items = rows.map(
    (r): AdverseReactionRow => ({
      id: r.id,
      patientId: r.patientId,
      patientName: fullPatientName(r.patient.person),
      administeredAt: r.administeredAt,
      doseLabel: r.doseLabel,
      vialDescription: r.vialDescription,
      vialLot: r.vialLot,
      injectionSite: r.injectionSite,
      systemicReactionGrade: r.systemicReactionGrade,
      hadLocalReaction: r.hadLocalReaction,
      localReactionNote: r.localReactionNote,
      reactionNote: r.reactionNote,
      reportedToIsp: r.reportedToIsp,
      ispReportedAt: r.ispReportedAt,
      ispNotes: r.ispNotes,
    })
  );

  return { items };
}

/** Marca/desmarca una RAM como notificada al ISP. */
export async function markIspReported(
  id: string,
  reportedToIsp: boolean,
  ispNotes?: string
): Promise<AdverseReactionRow> {
  const found = await db.immunotherapyAdministration.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Registro no encontrado");

  const updated = await db.immunotherapyAdministration.update({
    where: { id },
    data: {
      reportedToIsp,
      ispReportedAt: reportedToIsp ? new Date() : null,
      ispNotes: ispNotes ?? null,
    },
    include: {
      patient: {
        select: { person: { select: { names: true, fatherName: true, motherName: true } } },
      },
    },
  });

  return {
    id: updated.id,
    patientId: updated.patientId,
    patientName: fullPatientName(updated.patient.person),
    administeredAt: updated.administeredAt,
    doseLabel: updated.doseLabel,
    vialDescription: updated.vialDescription,
    vialLot: updated.vialLot,
    injectionSite: updated.injectionSite,
    systemicReactionGrade: updated.systemicReactionGrade,
    hadLocalReaction: updated.hadLocalReaction,
    localReactionNote: updated.localReactionNote,
    reactionNote: updated.reactionNote,
    reportedToIsp: updated.reportedToIsp,
    ispReportedAt: updated.ispReportedAt,
    ispNotes: updated.ispNotes,
  };
}
