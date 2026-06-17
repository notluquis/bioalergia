import { db } from "@finanzas/db";
import type {
  clinicalConsentCreateInputSchema,
  clinicalConsentDecideInputSchema,
  clinicalConsentListInputSchema,
} from "@finanzas/orpc-contracts/clinical-consent";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type ListInput = z.infer<typeof clinicalConsentListInputSchema>;
type CreateInput = z.infer<typeof clinicalConsentCreateInputSchema>;
type DecideInput = z.infer<typeof clinicalConsentDecideInputSchema>;

const patientSelect = {
  person: { select: { names: true, fatherName: true, motherName: true } },
} as const;

type ConsentRow = Awaited<ReturnType<typeof db.clinicalConsent.findFirst>> & {
  patient: {
    person: { names: string; fatherName: string | null; motherName: string | null };
  };
};

/**
 * Aplana la fila ZenStack (con include patient.person) al DTO: compone
 * `patientName`; el resto pasa 1:1.
 */
function toDto(row: ConsentRow) {
  const { patient, ...rest } = row;
  const patientName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return { ...rest, patientName };
}

/**
 * Consentimiento informado clínico (Ley 20.584). Capa admin (registro +
 * seguimiento + decisión). El texto genérico no basta: cada fila guarda el
 * snapshot del contenido + versión de plantilla del procedimiento concreto.
 */
export async function listClinicalConsents(input: ListInput) {
  const where: Record<string, unknown> = {};
  if (input.patientId !== undefined) where.patientId = input.patientId;
  if (input.status) where.status = input.status;

  const rows = await db.clinicalConsent.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: "desc" },
    include: { patient: { select: patientSelect } },
  });
  return { consents: (rows as ConsentRow[]).map(toDto) };
}

export async function createClinicalConsent(input: CreateInput, createdBy: number) {
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) throw new DomainError("NOT_FOUND", "Paciente no encontrado");

  const row = await db.clinicalConsent.create({
    data: {
      patientId: input.patientId,
      procedureType: input.procedureType,
      procedureName: input.procedureName,
      templateVersion: input.templateVersion,
      contentSnapshot: input.contentSnapshot,
      risksDisclosed: input.risksDisclosed ?? null,
      alternativesDisclosed: input.alternativesDisclosed ?? null,
      signatureMethod: input.signatureMethod,
      signerName: input.signerName,
      signerRut: input.signerRut ?? null,
      signerRelationship: input.signerRelationship ?? null,
      clinicianId: input.clinicianId ?? null,
      notes: input.notes ?? null,
      createdBy,
    },
    include: { patient: { select: patientSelect } },
  });
  return toDto(row as ConsentRow);
}

export async function decideClinicalConsent(input: DecideInput) {
  const found = await db.clinicalConsent.findUnique({
    where: { id: input.id },
    select: { id: true, status: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Consentimiento no encontrado");
  if (found.status === "REVOKED") {
    throw new DomainError("BAD_REQUEST", "El consentimiento ya fue revocado");
  }

  const now = new Date();
  const row = await db.clinicalConsent.update({
    where: { id: input.id },
    data: {
      status: input.status,
      // SIGNED sella la firma; REVOKED sella la revocación; REFUSED guarda motivo.
      signedAt: input.status === "SIGNED" ? now : undefined,
      revokedAt: input.status === "REVOKED" ? now : undefined,
      refusedReason: input.status === "REFUSED" ? (input.refusedReason ?? null) : undefined,
    },
    include: { patient: { select: patientSelect } },
  });
  return toDto(row as ConsentRow);
}
