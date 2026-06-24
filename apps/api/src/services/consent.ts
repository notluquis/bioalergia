import { db } from "@finanzas/db";
import type {
  consentListInputSchema,
  consentRecordInputSchema,
} from "@finanzas/orpc-contracts/consent";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type ListInput = z.infer<typeof consentListInputSchema>;
type RecordInput = z.infer<typeof consentRecordInputSchema>;

// Solo los campos de Person necesarios para etiquetar el consentimiento.
const personSelect = {
  names: true,
  fatherName: true,
  motherName: true,
  email: true,
} as const;

type ConsentRow = Awaited<ReturnType<typeof db.consentRecord.findFirst>> & {
  person: {
    names: string;
    fatherName: string | null;
    motherName: string | null;
    email: string | null;
  };
};

/**
 * Aplana la fila ZenStack (con `include: { person }`) al DTO del contrato:
 * compone `personName` y expone `personEmail`. El resto pasa 1:1.
 */
function toDto(row: ConsentRow) {
  const { person, ...rest } = row;
  const personName = [person.names, person.fatherName, person.motherName]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return { ...rest, personName, personEmail: person.email };
}

/**
 * Registro de consentimiento de DATOS personales (Ley 21.719). Historia
 * auditable consumida por la intranet. NO es el consentimiento informado
 * clínico de un procedimiento.
 */
export async function listConsentRecords(input: ListInput) {
  const where: Record<string, unknown> = {};
  if (input.personId !== undefined) where.personId = input.personId;
  if (input.purpose) where.purpose = input.purpose;
  if (input.status) where.status = input.status;

  const rows = await db.consentRecord.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { grantedAt: "desc" },
    include: { person: { select: personSelect } },
  });
  return { records: (rows as ConsentRow[]).map(toDto) };
}

export async function recordConsent(input: RecordInput, recordedBy: number) {
  const person = await db.person.findUnique({
    where: { id: input.personId },
    select: { id: true },
  });
  if (!person) throw new DomainError("NOT_FOUND", "Persona no encontrada");

  const row = await db.consentRecord.create({
    data: {
      personId: input.personId,
      purpose: input.purpose,
      channel: input.channel,
      policyVersion: input.policyVersion,
      evidenceText: input.evidenceText ?? null,
      source: input.source ?? null,
      recordedBy,
    },
    include: { person: { select: personSelect } },
  });
  return toDto(row as ConsentRow);
}

export async function withdrawConsent(id: string) {
  const found = await db.consentRecord.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Consentimiento no encontrado");
  if (found.status === "WITHDRAWN") {
    throw new DomainError("BAD_REQUEST", "El consentimiento ya fue revocado");
  }

  const row = await db.consentRecord.update({
    where: { id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    include: { person: { select: personSelect } },
  });
  return toDto(row as ConsentRow);
}
