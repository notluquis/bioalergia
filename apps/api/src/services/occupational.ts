import { db } from "@finanzas/db";
import type {
  CreateOccupationalLeadInput,
  CreateOccupationalProgramInput,
  CreateTestBatchInput,
  OccupationalLeadStatus,
  OccupationalProgramStatus2,
  UpdateOccupationalProgramInput,
} from "@finanzas/orpc-contracts/occupational";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { loadSettings } from "../lib/settings.ts";
import { dbDateToISO, isoToDbDate } from "../lib/time.ts";
import { sendReactivoLeadNotification } from "./email/transactional.ts";

type OccLeadRow = NonNullable<Awaited<ReturnType<typeof db.occupationalLead.findFirst>>>;

export function serializeOccupationalLead(l: OccLeadRow) {
  return {
    id: l.id,
    empresa: l.empresa,
    contactName: l.contactName,
    email: l.email,
    phone: l.phone,
    rut: l.rut,
    sector: l.sector,
    headcount: l.headcount,
    message: l.message,
    status: l.status,
    source: l.source,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

/**
 * Crea un lead de salud ocupacional desde el landing público. Honeypot: si
 * `website` trae contenido se descarta silencioso. El email al equipo es
 * best-effort (reusa la notificación de leads B2B + el destinatario configurado).
 */
export async function createOccupationalLead(input: CreateOccupationalLeadInput) {
  if (input.website && input.website.length > 0) {
    return { ok: true as const, id: 0 };
  }
  const lead = await db.occupationalLead.create({
    data: {
      empresa: input.empresa.trim(),
      contactName: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      rut: input.rut?.trim() || null,
      sector: input.sector,
      headcount: input.headcount ?? null,
      message: input.message?.trim() || null,
      source: "salud-ocupacional",
    },
  });

  try {
    const settings = await loadSettings();
    const context = [
      `Salud ocupacional · sector ${lead.sector}`,
      lead.headcount ? `${lead.headcount} trabajadores` : null,
      lead.message,
    ]
      .filter(Boolean)
      .join(" · ");
    await sendReactivoLeadNotification({
      to: settings.reactivoLeadsEmail,
      lead: {
        id: lead.id,
        empresa: lead.empresa,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        rut: lead.rut,
        message: context,
        productsOfInterest: [],
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "occupational.lead.notify", leadId: lead.id });
  }
  logEvent("[occupational] lead created", { id: lead.id, empresa: lead.empresa });
  return { ok: true as const, id: lead.id };
}

export async function listOccupationalLeads() {
  return db.occupationalLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
}

export async function updateOccupationalLeadStatus(id: number, status: OccupationalLeadStatus) {
  const existing = await db.occupationalLead.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Lead no encontrado");
  return db.occupationalLead.update({ where: { id }, data: { status } });
}

// ── Programa ocupacional (stage-B seguro) ────────────────────────────
// Cohorte mínima para no reidentificar (k-anonimato). Si un lote tiene menos
// personas testeadas que esto, sus conteos no se exponen.
const MIN_COHORT = 5;

const programInclude = { company: { select: { razonSocial: true } } } as const;
type ProgramRow = Awaited<
  ReturnType<typeof db.occupationalProgram.findMany<{ include: typeof programInclude }>>
>[number];
type BatchRow = NonNullable<Awaited<ReturnType<typeof db.occupationalTestBatch.findUnique>>>;

export function serializeProgram(p: ProgramRow) {
  return {
    id: p.id,
    companyId: p.companyId,
    companyName: p.company?.razonSocial ?? null,
    sector: p.sector,
    testingScope: p.testingScope,
    status: p.status,
    riohsAttested: p.riohsAttested,
    riohsClauseRef: p.riohsClauseRef,
    riohsAttestedAt: p.riohsAttestedAt,
    riohsAttestedBy: p.riohsAttestedBy,
    workerConsentBasis: p.workerConsentBasis,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Supresión por cohorte mínima: bajo el umbral, no se devuelven conteos.
export function serializeBatch(b: BatchRow) {
  const suppressed = b.totalTested < MIN_COHORT;
  return {
    id: b.id,
    programId: b.programId,
    batchDate: b.batchDate,
    suppressed,
    totalTested: suppressed ? null : b.totalTested,
    passedCount: suppressed ? null : b.passedCount,
    presumptivePositiveCount: suppressed ? null : b.presumptivePositiveCount,
    notes: b.notes,
    createdAt: b.createdAt,
  };
}

export async function listPrograms() {
  return db.occupationalProgram.findMany({
    include: programInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function createProgram(input: CreateOccupationalProgramInput) {
  const company = await db.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new DomainError("NOT_FOUND", "Empresa no encontrada");
  const created = await db.occupationalProgram.create({
    data: {
      companyId: input.companyId,
      sector: input.sector,
      testingScope: input.testingScope,
      workerConsentBasis: input.workerConsentBasis?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  return db.occupationalProgram.findUniqueOrThrow({
    where: { id: created.id },
    include: programInclude,
  });
}

export async function updateProgram(input: UpdateOccupationalProgramInput) {
  const existing = await db.occupationalProgram.findUnique({ where: { id: input.id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Programa no encontrado");
  await db.occupationalProgram.update({
    where: { id: input.id },
    data: {
      sector: input.sector,
      testingScope: input.testingScope,
      workerConsentBasis:
        input.workerConsentBasis === undefined
          ? undefined
          : input.workerConsentBasis?.trim() || null,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
    },
  });
  return db.occupationalProgram.findUniqueOrThrow({
    where: { id: input.id },
    include: programInclude,
  });
}

/** Atestación RIOHS del cliente — precondición para activar el programa. */
export async function attestRiohs(id: number, riohsClauseRef: string, attestedBy: number | null) {
  const existing = await db.occupationalProgram.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Programa no encontrado");
  await db.occupationalProgram.update({
    where: { id },
    data: {
      riohsAttested: true,
      riohsClauseRef: riohsClauseRef.trim(),
      riohsAttestedAt: new Date(),
      riohsAttestedBy: attestedBy,
    },
  });
  return db.occupationalProgram.findUniqueOrThrow({ where: { id }, include: programInclude });
}

/**
 * Gate RIOHS BLOQUEANTE: un programa NO puede activarse (ACTIVE) sin atestación
 * RIOHS (CdT Art. 153/154; DT Ord. 3032/47). Sin la cláusula, el testeo es
 * ilícito y Bioalergia comparte la exposición.
 */
export async function setProgramStatus(id: number, status: OccupationalProgramStatus2) {
  const existing = await db.occupationalProgram.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Programa no encontrado");
  if (status === "ACTIVE" && !existing.riohsAttested) {
    throw new DomainError(
      "CONFLICT",
      "No se puede activar el programa sin atestación RIOHS (cláusula del Reglamento Interno del cliente)."
    );
  }
  await db.occupationalProgram.update({ where: { id }, data: { status } });
  return db.occupationalProgram.findUniqueOrThrow({ where: { id }, include: programInclude });
}

export async function listTestBatches(programId: number) {
  return db.occupationalTestBatch.findMany({
    where: { programId },
    orderBy: { batchDate: "desc" },
    take: 500,
  });
}

export async function createTestBatch(input: CreateTestBatchInput, createdBy: number | null) {
  const program = await db.occupationalProgram.findUnique({ where: { id: input.programId } });
  if (!program) throw new DomainError("NOT_FOUND", "Programa no encontrado");
  if (input.passedCount + input.presumptivePositiveCount > input.totalTested) {
    throw new DomainError(
      "BAD_REQUEST",
      "passedCount + presumptivePositiveCount no puede exceder totalTested."
    );
  }
  const iso = dbDateToISO(input.batchDate);
  if (!iso) throw new DomainError("BAD_REQUEST", "batchDate inválida");
  return db.occupationalTestBatch.create({
    data: {
      programId: input.programId,
      batchDate: isoToDbDate(iso),
      totalTested: input.totalTested,
      passedCount: input.passedCount,
      presumptivePositiveCount: input.presumptivePositiveCount,
      notes: input.notes?.trim() || null,
      createdBy,
    },
  });
}
