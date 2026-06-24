import { db } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";

// Tipo de entrada para columnas Json de ZenStack (sin `null` en el tope: las
// columnas Json requeridas lo rechazan; las nullables se castean a `| null`).
type JsonInput =
  | string
  | number
  | boolean
  | { [key: string]: JsonInput | null }
  | Array<JsonInput | null>;

/**
 * Salud ocupacional stage-C — motor de resultado individual con los HARD GATES
 * de compliance (investigación legal primaria ISP/DT/Ley 20.584/21.719). Los
 * gates viven AQUÍ, no en la UI, para que ningún caller los pueda saltar:
 *
 *  G1. Sin POSITIVO sin confirmatorio GC-MS/LC-MS-MS. El tamizaje solo produce
 *      NEGATIVE o PRESUMPTIVE_POSITIVE; jamás "positivo".
 *  G2. Sin divulgación individual al empleador sin consentimiento EMPLOYER_
 *      DISCLOSURE vivo; detalle de sustancia exige consent SUBSTANCE_LEVEL extra.
 *  G3. El confirmatorio debe correr sobre una muestra del MISMO order (linaje del
 *      espécimen primario tamizado).
 *  G4. La cadena de custodia es append-only (solo se crean eventos).
 *  G5. Consentimiento de testeo ≠ de divulgación (filas OccConsent distintas).
 *  G6. Retención 15 años desde la última entrada (ficha clínica, Ley 20.584
 *      Art.13 + DS41 Art.11).
 */

// ── Cutoffs de TAMIZAJE adoptados por ISP (Res.0250-2024 §8, SAMHSA+EWDTS) ──
// ng/mL. El confirmatorio NO tiene cutoff fijado por ISP → se captura por lab.
export const ISP_SCREENING_CUTOFFS: Record<string, { ngMl: number; source: "SAMHSA" | "EWDTS" }> = {
  anfetaminas: { ngMl: 500, source: "SAMHSA" },
  metanfetamina: { ngMl: 500, source: "SAMHSA" },
  mdma: { ngMl: 500, source: "SAMHSA" },
  cannabinoides: { ngMl: 50, source: "SAMHSA" },
  cocaina: { ngMl: 150, source: "SAMHSA" }, // benzoilecgonina
  fenciclidina: { ngMl: 25, source: "SAMHSA" },
  opiaceos: { ngMl: 2000, source: "SAMHSA" }, // valor post-1998 (NO 300)
  barbituricos: { ngMl: 200, source: "EWDTS" },
  benzodiazepinas: { ngMl: 200, source: "EWDTS" },
  metadona: { ngMl: 300, source: "EWDTS" },
  propoxifeno: { ngMl: 300, source: "EWDTS" },
};

// Retención ficha clínica: 15 años desde la última entrada (DS41 Art.11).
export const RETENTION_YEARS = 15;

type SubjectRow = NonNullable<Awaited<ReturnType<typeof db.occTestSubject.findUnique>>>;
type OrderRow = NonNullable<Awaited<ReturnType<typeof db.occTestOrder.findUnique>>>;

// ── Sujeto seudónimo ─────────────────────────────────────────────────
export function serializeSubject(s: SubjectRow) {
  return { id: s.id, subjectCode: s.subjectCode, personId: s.personId, createdAt: s.createdAt };
}

export async function createSubject(input: { subjectCode: string }) {
  const code = input.subjectCode.trim();
  if (!code) throw new DomainError("BAD_REQUEST", "subjectCode requerido");
  const existing = await db.occTestSubject.findUnique({ where: { subjectCode: code } });
  if (existing) throw new DomainError("CONFLICT", "subjectCode ya existe");
  // SEUDÓNIMO por defecto: NO se acepta personId en la creación. El link a PII
  // exige consent IDENTITY_LINK vivo (ver linkSubjectIdentity).
  return db.occTestSubject.create({ data: { subjectCode: code } });
}

/**
 * Liga el sujeto a un Person (PII) — gateado: exige un consent IDENTITY_LINK
 * concedido y vivo en alguna orden del sujeto. Sin él, el sujeto permanece
 * seudónimo. (Codex P2: createSubject ya no persiste personId sin gate.)
 */
export async function linkSubjectIdentity(subjectId: number, personId: number) {
  const subject = await db.occTestSubject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new DomainError("NOT_FOUND", "Sujeto no encontrado");
  const consent = await db.occConsent.findFirst({
    where: {
      purpose: "IDENTITY_LINK",
      granted: true,
      revokedAt: null,
      order: { subjectId },
    },
  });
  if (!consent) {
    throw new DomainError(
      "FORBIDDEN",
      "El link a identidad requiere un consentimiento IDENTITY_LINK vivo del sujeto."
    );
  }
  return db.occTestSubject.update({ where: { id: subjectId }, data: { personId } });
}

// ── Orden de testeo ──────────────────────────────────────────────────
export function serializeOrder(o: OrderRow) {
  return {
    id: o.id,
    subjectId: o.subjectId,
    programId: o.programId,
    companyId: o.companyId,
    testingReason: o.testingReason,
    requestSource: o.requestSource,
    regulatoryBasis: o.regulatoryBasis,
    mandateType: o.mandateType,
    riohsClauseRef: o.riohsClauseRef,
    status: o.status,
    finalResult: o.finalResult,
    refusalFlag: o.refusalFlag,
    notes: o.notes,
    createdAt: o.createdAt,
    lastEntryAt: o.lastEntryAt,
  };
}

export async function createOrder(
  input: {
    subjectId: number;
    programId?: number | null;
    companyId?: number | null;
    testingReason: OrderRow["testingReason"];
    requestSource: OrderRow["requestSource"];
    regulatoryBasis: OrderRow["regulatoryBasis"];
    mandateType: OrderRow["mandateType"];
    riohsClauseRef?: string | null;
    notes?: string | null;
  },
  createdBy: number | null
) {
  const subject = await db.occTestSubject.findUnique({ where: { id: input.subjectId } });
  if (!subject) throw new DomainError("NOT_FOUND", "Sujeto no encontrado");
  // Si el programa existe, la atestación RIOHS del stage-B es precondición.
  if (input.programId != null) {
    const program = await db.occupationalProgram.findUnique({ where: { id: input.programId } });
    if (!program) throw new DomainError("NOT_FOUND", "Programa no encontrado");
    if (!program.riohsAttested) {
      throw new DomainError(
        "CONFLICT",
        "El programa no tiene atestación RIOHS — no se puede ordenar testeo."
      );
    }
  }
  return db.occTestOrder.create({
    data: {
      subjectId: input.subjectId,
      programId: input.programId ?? null,
      companyId: input.companyId ?? null,
      testingReason: input.testingReason,
      requestSource: input.requestSource,
      regulatoryBasis: input.regulatoryBasis,
      mandateType: input.mandateType,
      riohsClauseRef: input.riohsClauseRef?.trim() || null,
      notes: input.notes?.trim() || null,
      createdBy,
      status: "CONSENT_PENDING",
    },
  });
}

async function touchOrder(
  orderId: number,
  status?: OrderRow["status"],
  finalResult?: OrderRow["finalResult"]
) {
  await db.occTestOrder.update({
    where: { id: orderId },
    data: {
      ...(status ? { status } : {}),
      ...(finalResult ? { finalResult } : {}),
      lastEntryAt: new Date(),
    },
  });
}

// ── G4: cadena de custodia (append-only) ─────────────────────────────
export async function addCustodyEvent(
  input: {
    orderId: number;
    sampleId?: number | null;
    action: NonNullable<Awaited<ReturnType<typeof db.occCustodyEvent.findFirst>>>["action"];
    actorRole?: string | null;
    signatureRef?: string | null;
    sealIntact?: boolean | null;
    location?: string | null;
    notes?: string | null;
  },
  actorId: number | null
) {
  const order = await db.occTestOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  // Codex P1: el FK solo prueba que la muestra existe, no que sea de esta orden.
  // Verificar pertenencia evita contaminar el timeline append-only con eventos
  // de muestras ajenas.
  if (input.sampleId != null) {
    const sample = await db.occSample.findUnique({ where: { id: input.sampleId } });
    if (!sample || sample.orderId !== input.orderId) {
      throw new DomainError("BAD_REQUEST", "La muestra no pertenece a esta orden.");
    }
  }
  return db.occCustodyEvent.create({
    data: {
      orderId: input.orderId,
      sampleId: input.sampleId ?? null,
      action: input.action,
      actorId,
      actorRole: input.actorRole?.trim() || null,
      signatureRef: input.signatureRef?.trim() || null,
      sealIntact: input.sealIntact ?? null,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
}

// ── Muestra / contramuestra ──────────────────────────────────────────
export async function addSample(input: {
  orderId: number;
  kind: "MUESTRA" | "CONTRAMUESTRA";
  containerCode: string;
  matrix?: "ORINA" | "SANGRE" | "SALIVA" | "ALIENTO";
  sealId?: string | null;
  primaryAliquotOf?: number | null;
}) {
  const order = await db.occTestOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  const code = input.containerCode.trim();
  if (!code) throw new DomainError("BAD_REQUEST", "containerCode requerido");
  const dup = await db.occSample.findUnique({ where: { containerCode: code } });
  if (dup) throw new DomainError("CONFLICT", "containerCode ya existe");
  return db.occSample.create({
    data: {
      orderId: input.orderId,
      kind: input.kind,
      containerCode: code,
      matrix: input.matrix ?? "ORINA",
      sealId: input.sealId?.trim() || null,
      primaryAliquotOf: input.primaryAliquotOf ?? null,
    },
  });
}

// ── Tamizaje (G1: solo NEGATIVE | PRESUMPTIVE_POSITIVE) ───────────────
export async function recordScreening(input: {
  orderId: number;
  method?: string;
  panel: unknown;
  outcome: "NEGATIVE" | "PRESUMPTIVE_POSITIVE";
  labId?: string | null;
}) {
  const order = await db.occTestOrder.findUnique({
    where: { id: input.orderId },
    include: { screening: true },
  });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  if (order.screening) throw new DomainError("CONFLICT", "El tamizaje ya fue registrado");
  const result = await db.occScreeningResult.create({
    data: {
      orderId: input.orderId,
      method: input.method?.trim() || "inmunoensayo",
      panel: input.panel as unknown as JsonInput,
      outcome: input.outcome,
      labId: input.labId?.trim() || null,
    },
  });
  // NEGATIVE → resultado final negativo. PRESUMPTIVE → espera confirmatorio.
  if (input.outcome === "NEGATIVE") {
    await touchOrder(input.orderId, "RESULTED", "NEGATIVE");
  } else {
    await touchOrder(input.orderId, "PRESUMPTIVE_POSITIVE");
  }
  return result;
}

// ── Confirmatorio (G1 + G3) ──────────────────────────────────────────
export async function recordConfirmatory(input: {
  orderId: number;
  method: "GC_MS" | "LC_MS_MS"; // G1: enum — no hay otra vía a positivo
  sampleId: number;
  analytes: unknown;
  outcome: "NEGATIVE" | "POSITIVE";
  confirmingLabId?: string | null;
  isoAccredited?: boolean;
}) {
  const order = await db.occTestOrder.findUnique({
    where: { id: input.orderId },
    include: { screening: true, confirmatory: true },
  });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  // G1: solo se confirma un tamizaje presuntivo.
  if (!order.screening || order.screening.outcome !== "PRESUMPTIVE_POSITIVE") {
    throw new DomainError(
      "BAD_REQUEST",
      "No hay tamizaje presuntivo positivo que confirmar para esta orden."
    );
  }
  if (order.confirmatory) throw new DomainError("CONFLICT", "El confirmatorio ya fue registrado");
  // G3: el confirmatorio corre sobre el espécimen PRIMARIO tamizado — la MUESTRA
  // (o una alícuota de ella), NUNCA la contramuestra (sellada para contra-análisis)
  // ni una muestra ajena (Codex P1: acotar el linaje, no "cualquier muestra del order").
  const sample = await db.occSample.findUnique({ where: { id: input.sampleId } });
  if (!sample || sample.orderId !== input.orderId) {
    throw new DomainError(
      "BAD_REQUEST",
      "El confirmatorio debe correr sobre una muestra de la misma orden."
    );
  }
  let isPrimaryLineage = sample.kind === "MUESTRA";
  if (!isPrimaryLineage && sample.primaryAliquotOf != null) {
    const parent = await db.occSample.findUnique({ where: { id: sample.primaryAliquotOf } });
    isPrimaryLineage =
      parent != null && parent.orderId === input.orderId && parent.kind === "MUESTRA";
  }
  if (!isPrimaryLineage) {
    throw new DomainError(
      "BAD_REQUEST",
      "El confirmatorio debe correr sobre la muestra primaria o su alícuota, no la contramuestra."
    );
  }
  const result = await db.occConfirmatoryResult.create({
    data: {
      orderId: input.orderId,
      method: input.method,
      sampleId: input.sampleId,
      analytes: input.analytes as unknown as JsonInput,
      outcome: input.outcome,
      confirmingLabId: input.confirmingLabId?.trim() || null,
      isoAccredited: input.isoAccredited ?? false,
    },
  });
  if (input.outcome === "NEGATIVE") {
    await touchOrder(input.orderId, "RESULTED", "NEGATIVE");
  } else {
    // POSITIVO confirmado → pasa a revisión médica antes de ser resultado final.
    await touchOrder(input.orderId, "MEDICAL_REVIEW");
  }
  return result;
}

// ── Revisión médica (best-practice; G1: solo sobre positivo confirmado) ──
export async function recordMedicalReview(
  input: {
    orderId: number;
    declaredMeds?: unknown;
    decision: "CONFIRMED_POSITIVE" | "EXPLAINED_BY_RX";
    rationale: string;
  },
  reviewerId: number | null
) {
  const order = await db.occTestOrder.findUnique({
    where: { id: input.orderId },
    include: { confirmatory: true, medicalReview: true },
  });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  // G1: la revisión médica solo aplica a un positivo CONFIRMADO por GC-MS/LC-MS.
  if (!order.confirmatory || order.confirmatory.outcome !== "POSITIVE") {
    throw new DomainError(
      "BAD_REQUEST",
      "La revisión médica solo aplica a un positivo confirmado."
    );
  }
  if (order.medicalReview)
    throw new DomainError("CONFLICT", "La revisión médica ya fue registrada");
  const rationale = input.rationale.trim();
  if (!rationale) throw new DomainError("BAD_REQUEST", "rationale requerido");
  const review = await db.occMedicalReview.create({
    data: {
      orderId: input.orderId,
      reviewerId,
      declaredMeds:
        input.declaredMeds == null ? undefined : (input.declaredMeds as unknown as JsonInput),
      decision: input.decision,
      rationale,
    },
  });
  // Una receta legítima explica el positivo → resultado NEGATIVO médicamente explicado.
  if (input.decision === "EXPLAINED_BY_RX") {
    await touchOrder(input.orderId, "RESULTED", "NEGATIVE_MEDICALLY_EXPLAINED");
  } else {
    await touchOrder(input.orderId, "RESULTED", "POSITIVE");
  }
  return review;
}

// ── G5: consentimientos separados por finalidad ──────────────────────
export async function recordConsent(input: {
  orderId: number;
  purpose: "TEST" | "EMPLOYER_DISCLOSURE" | "SUBSTANCE_LEVEL_DISCLOSURE" | "IDENTITY_LINK";
  granted: boolean;
  scope?: unknown;
  evidenceRef?: string | null;
}) {
  const order = await db.occTestOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  return db.occConsent.create({
    data: {
      orderId: input.orderId,
      purpose: input.purpose,
      granted: input.granted,
      scope: input.scope == null ? undefined : (input.scope as unknown as JsonInput),
      grantedAt: input.granted ? new Date() : null,
      evidenceRef: input.evidenceRef?.trim() || null,
    },
  });
}

export async function revokeConsent(consentId: number) {
  const existing = await db.occConsent.findUnique({ where: { id: consentId } });
  if (!existing) throw new DomainError("NOT_FOUND", "Consentimiento no encontrado");
  return db.occConsent.update({
    where: { id: consentId },
    data: { granted: false, revokedAt: new Date() },
  });
}

async function hasLiveConsent(
  orderId: number,
  purpose: "EMPLOYER_DISCLOSURE" | "SUBSTANCE_LEVEL_DISCLOSURE"
): Promise<boolean> {
  const c = await db.occConsent.findFirst({
    where: { orderId, purpose, granted: true, revokedAt: null },
  });
  return c != null;
}

// ── G2: divulgación al empleador consent-gated ───────────────────────
export async function discloseToEmployer(
  input: {
    orderId: number;
    payloadKind: "AGGREGATE" | "FITNESS_OUTCOME" | "SUBSTANCE_DETAIL";
  },
  releasedBy: number | null
) {
  const order = await db.occTestOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");

  // Agregado/despersonalizado: siempre permitido (no es dato individual).
  if (input.payloadKind !== "AGGREGATE") {
    // G2: individual al empleador exige consent EMPLOYER_DISCLOSURE vivo.
    if (!(await hasLiveConsent(input.orderId, "EMPLOYER_DISCLOSURE"))) {
      throw new DomainError(
        "FORBIDDEN",
        "Divulgación individual al empleador requiere consentimiento expreso del trabajador (Art. 154 bis)."
      );
    }
    // Detalle de sustancia exige consent adicional SUBSTANCE_LEVEL.
    if (
      input.payloadKind === "SUBSTANCE_DETAIL" &&
      !(await hasLiveConsent(input.orderId, "SUBSTANCE_LEVEL_DISCLOSURE"))
    ) {
      throw new DomainError(
        "FORBIDDEN",
        "El detalle de sustancia requiere un consentimiento separado adicional."
      );
    }
  }
  // El empleador NUNCA recibe el resultado clínico crudo (FULL_RESULT bloqueado aquí).
  const consent =
    input.payloadKind === "AGGREGATE"
      ? null
      : await db.occConsent.findFirst({
          where: {
            orderId: input.orderId,
            purpose: "EMPLOYER_DISCLOSURE",
            granted: true,
            revokedAt: null,
          },
        });
  return db.occDisclosure.create({
    data: {
      orderId: input.orderId,
      audience: "EMPLOYER",
      payloadKind: input.payloadKind,
      consentId: consent?.id ?? null,
      releasedBy,
    },
  });
}

// ── Lectura ──────────────────────────────────────────────────────────
export async function getOrderDetail(orderId: number) {
  const order = await db.occTestOrder.findUnique({
    where: { id: orderId },
    include: {
      subject: true,
      samples: true,
      custodyEvents: { orderBy: { occurredAt: "asc" } },
      consents: true,
      screening: true,
      confirmatory: true,
      medicalReview: true,
      disclosures: true,
    },
  });
  if (!order) throw new DomainError("NOT_FOUND", "Orden no encontrada");
  return order;
}

export async function listOrders(programId?: number) {
  return db.occTestOrder.findMany({
    where: programId != null ? { programId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}
