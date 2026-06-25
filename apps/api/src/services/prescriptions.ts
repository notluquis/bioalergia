import crypto from "node:crypto";
import { db, kysely } from "@finanzas/db";
import type {
  generateMedicalPrescriptionInputSchema,
  listMedicalPrescriptionsInputSchema,
} from "@finanzas/orpc-contracts/certificates";
import { sql } from "kysely";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { ageFromBirthDate, parseChileDateOnly } from "../lib/time.ts";
import {
  medicalPrescriptionSchema,
  toStoredDiagnoses,
  toStoredMedications,
} from "../modules/certificates/certificate.schema.ts";
import { buildFolio } from "../modules/certificates/folio.ts";
import { createVerification, generateVerificationCode } from "./verification.ts";
import { sendEmail } from "./email/index.ts";

export type PrescriptionPdfMode = "full" | "overlay" | "template";

// JSON-safe recursivo local que ESPEJA el `JsonValue` de ZenStack: `null` solo
// es válido DENTRO de objetos/arrays, no en el top-level. Mismo enfoque que
// services/employees.ts (movido del handler oRPC sin cambios).
type JsonInput =
  | string
  | number
  | boolean
  | { [key: string]: JsonInput | null }
  | Array<JsonInput | null>;

type ListPrescriptionsFilter = z.infer<typeof listMedicalPrescriptionsInputSchema>;

// Parse "YYYY-MM-DD" as Chile-local midnight -> UTC instant (Date). Invalid -> Invalid Date.
const parseDateOnly = (value: string): Date => parseChileDateOnly(value) ?? new Date(NaN);

function formatPrescriptionDiagnoses(
  diagnoses: Array<{ code?: string; label: string }> | undefined
): string | undefined {
  if (!diagnoses || diagnoses.length === 0) return undefined;
  return diagnoses
    .map((diagnosis) =>
      diagnosis.code ? `${diagnosis.code} - ${diagnosis.label}` : diagnosis.label
    )
    .join("; ");
}

type PrescriptionRow = NonNullable<Awaited<ReturnType<typeof db.medicalPrescription.findUnique>>>;

function mapMedications(value: unknown): Array<{
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}> {
  if (!Array.isArray(value)) return [];
  return (value as Array<Record<string, unknown>>).map((m) => ({
    name: String(m.name ?? ""),
    dosage: m.dosage ? String(m.dosage) : undefined,
    frequency: m.frequency ? String(m.frequency) : undefined,
    duration: m.duration ? String(m.duration) : undefined,
    instructions: m.instructions ? String(m.instructions) : undefined,
  }));
}

/**
 * Regenera determinísticamente el PDF (PDF/A-3) de una receta guardada. Único
 * lugar que reconstruye el PDF para re-descarga (GET raw) y envío por email — no
 * persiste binario, lo deriva de la fila. Lanza NOT_FOUND si no existe.
 */
export async function buildPrescriptionPdfBytes(
  id: string,
  mode: PrescriptionPdfMode = "full"
): Promise<{ bytes: Uint8Array; prescription: PrescriptionRow }> {
  const prescription = await db.medicalPrescription.findUnique({ where: { id } });
  if (!prescription) throw new DomainError("NOT_FOUND", "Receta no encontrada");

  const patient = await db.patient.findUnique({
    where: { id: prescription.patientId },
    select: { birthDate: true, person: { select: { sex: true } } },
  });
  const clinic = await db.clinicSettings.findUnique({ where: { id: 1 } });
  // Código de verificación (vive en DocumentVerification, no en la receta) →
  // regenerar el QR. Sin esto, re-descargas/impresiones salían SIN QR.
  const verification = await db.documentVerification.findUnique({
    where: { prescriptionId: id },
    select: { code: true },
  });
  const { generateMedicalPrescriptionPdf, generateQRCode } =
    await import("../modules/certificates/certificate.service.ts");
  const qrCodeBuffer = verification?.code ? await generateQRCode(verification.code) : undefined;

  const rawPdf = await generateMedicalPrescriptionPdf(
    {
      patientId: prescription.patientId,
      // @db.Date queda anclado a medianoche UTC → slice ISO da el YYYY-MM-DD.
      date: prescription.date.toISOString().slice(0, 10),
      diagnosis: prescription.diagnosis ?? undefined,
      medications: mapMedications(prescription.medications),
      notes: prescription.notes ?? undefined,
      mode,
      status: prescription.status ?? undefined,
      folio: prescription.folio ?? undefined,
      qrCodeBuffer,
      verificationCode: verification?.code ?? undefined,
      doctorLicense: prescription.doctorLicense ?? undefined,
      patientAge: ageFromBirthDate(patient?.birthDate),
      patientBirthDate: patient?.birthDate
        ? patient.birthDate.toISOString().slice(0, 10)
        : undefined,
      patientSex: patient?.person?.sex ?? undefined,
      doctorName: prescription.doctorName ?? undefined,
      doctorSpecialty: prescription.doctorSpecialty ?? undefined,
      doctorRut: prescription.doctorRut ?? undefined,
      doctorEmail: prescription.doctorEmail ?? undefined,
      doctorAddress: prescription.doctorAddress ?? undefined,
      patient: { name: prescription.patientName, rut: prescription.patientRut },
      patientAddress: (prescription.metadata as any)?.patientAddress ?? undefined,
      clinicName: clinic?.name ?? undefined,
    },
    { primary: clinic?.logoUrl, secondary: clinic?.secondaryLogoUrl }
  );
  // NO pasamos por Ghostscript/PDF-A: GS pdfwrite ELIMINA el StructTree (tags
  // PDF/UA). La receta se sirve TAGGED (accesible) directo de pdf-lib; el PDF-A
  // (archival) es menos crítico acá porque la receta se regenera desde la DB.
  return { bytes: rawPdf, prescription };
}

/**
 * Anula una receta (soft, status=ANNULLED). Documento regulatorio: se conserva
 * la fila y el folio (auditoría), no se borra. Re-descarga estampa "ANULADA".
 */
export async function annulPrescription(id: string): Promise<{ id: string; status: string }> {
  const found = await db.medicalPrescription.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Receta no encontrada");
  if (found.status === "ANNULLED") {
    throw new DomainError("CONFLICT", "La receta ya está anulada");
  }
  const updated = await db.medicalPrescription.update({
    where: { id },
    data: { status: "ANNULLED" },
    select: { id: true, status: true },
  });
  return updated;
}

/**
 * Crea una receta médica (folio + verificación). El PDF NO se genera ni sube a
 * Drive acá: es función pura de esta fila y se regenera al descargar/imprimir/
 * enviar (buildPrescriptionPdfBytes) → la fila es la única fuente de verdad y la
 * receta queda inmutable. Lanza NOT_FOUND si el paciente no existe.
 *
 * Movido desde el handler oRPC sin alterar el ORDEN: validar paciente → upsert
 * clínica → asignar folio (nextval correlativo + sufijo) → crear fila →
 * verificación → anular la receta superseded (re-emisión).
 */
export async function createMedicalPrescription(
  input: z.infer<typeof generateMedicalPrescriptionInputSchema>,
  issuedBy: number
): Promise<{ id: string }> {
  const parsed = medicalPrescriptionSchema.parse(input);
  const patient = await db.patient.findUnique({
    where: { id: parsed.patientId },
    select: {
      person: {
        select: {
          fatherName: true,
          motherName: true,
          names: true,
          rut: true,
          addresses: {
            where: { isPrimary: true },
            take: 1,
            select: { street: true, number: true, supplement: true, comuna: true },
          },
        },
      },
    },
  });
  if (!patient) throw new DomainError("NOT_FOUND", "Paciente no encontrado");

  const clinic = await db.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const fullName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
    .filter(Boolean)
    .join(" ");
  const primaryAddress = patient.person.addresses?.[0];
  const addressStr = primaryAddress
    ? [
        primaryAddress.street,
        primaryAddress.number,
        primaryAddress.supplement,
        primaryAddress.comuna,
      ]
        .filter(Boolean)
        .join(", ")
    : "No registrado";
  const diagnosisText = parsed.diagnosis?.trim() || formatPrescriptionDiagnoses(parsed.diagnoses);

  // Folio: correlativo desde la secuencia (auditoría) + sufijo aleatorio.
  const folioRes = await sql<{
    v: number;
  }>`SELECT nextval('medical_prescription_folio_seq')::int AS v`.execute(kysely);
  const folioSeq = folioRes.rows[0]?.v ?? 0;
  const folio = buildFolio(folioSeq, Number(parsed.date.slice(0, 4)));
  const doctorLicense = clinic.superintendenciaNumber ?? undefined;
  const prescriptionId = crypto.randomUUID();
  const verificationCode = generateVerificationCode();

  // Normalización tipada → fila JSON-safe (sin claves `undefined`, que ZenStack
  // rechaza en columnas Json).
  const storedMedications = toStoredMedications(parsed.medications);
  const storedDiagnoses = parsed.diagnoses ? toStoredDiagnoses(parsed.diagnoses) : undefined;

  // SIN Drive ni PDF al crear: el PDF es función pura de esta fila y se genera al
  // descargar/imprimir/enviar (buildPrescriptionPdfBytes). Esto hace el create
  // instantáneo y mantiene la receta inmutable.
  await db.medicalPrescription.create({
    data: {
      date: parseDateOnly(parsed.date),
      folio,
      folioSeq,
      doctorLicense,
      diagnosis: diagnosisText,
      diagnoses: storedDiagnoses,
      doctorAddress: parsed.doctorAddress,
      doctorEmail: parsed.doctorEmail,
      doctorName: parsed.doctorName,
      doctorRut: parsed.doctorRut,
      doctorSpecialty: parsed.doctorSpecialty,
      id: prescriptionId,
      issuedBy,
      medications: storedMedications,
      // Metadata = respaldo Json plano. Optativos ausentes → `null` (JSON
      // válido), nunca `undefined`. Diagnoses van a su columna dedicada.
      metadata: {
        medications: storedMedications,
        diagnosis: diagnosisText ?? null,
        notes: parsed.notes ?? null,
        patientName: fullName,
        patientRut: patient.person.rut ?? null,
        patientAddress: addressStr,
        ...(storedDiagnoses ? { diagnoses: storedDiagnoses } : {}),
        ...(parsed.supersedesId ? { supersedesId: parsed.supersedesId } : {}),
      } as unknown as JsonInput,
      notes: parsed.notes,
      patientId: parsed.patientId,
      patientName: fullName,
      patientRut: patient.person.rut,
    },
  });

  await createVerification({
    documentType: "prescription",
    prescriptionId,
    code: verificationCode,
  });

  // Modificar = re-emitir: anula la receta original (folio viejo queda como
  // ANULADA en auditoría), la nueva ya quedó creada con folio fresco.
  if (parsed.supersedesId) {
    try {
      await annulPrescription(parsed.supersedesId);
    } catch (error) {
      // No romper la emisión si la vieja ya estaba anulada / no existe.
      logError("prescription.supersede.annul", error, { supersedesId: parsed.supersedesId });
    }
  }

  // El PDF se descarga aparte (GET raw) — devolver el File por oRPC/SuperJSON
  // corrompe el binario. Devolvemos solo el id.
  return { id: prescriptionId };
}

/**
 * Lista recetas médicas con filtros (paciente / estado / rango de fechas /
 * búsqueda libre). Where-builder movido del handler oRPC sin cambios.
 */
export async function listMedicalPrescriptions(
  filter: ListPrescriptionsFilter
): Promise<{ items: Awaited<ReturnType<typeof db.medicalPrescription.findMany>> }> {
  const f = filter ?? {};
  const where: Record<string, unknown> = {};
  if (f.patientId) where.patientId = f.patientId;
  if (f.status) where.status = f.status;

  // Rango de fechas sobre `date` (receta) o `issuedAt` (emisión, default).
  if (f.from || f.to) {
    const range: { gte?: Date; lt?: Date } = {};
    if (f.from) range.gte = parseDateOnly(f.from);
    if (f.to) {
      // `lt` al día siguiente → incluye todo el día `to` (cubre timestamps).
      const toMid = parseDateOnly(f.to);
      range.lt = new Date(toMid.getTime() + 86_400_000);
    }
    if (f.dateField === "date") where.date = range;
    else where.issuedAt = range;
  }

  // Búsqueda libre: paciente / RUT / diagnóstico / medicamento (Json).
  if (f.search?.trim()) {
    const q = f.search.trim();
    where.OR = [
      { patientName: { contains: q, mode: "insensitive" as const } },
      { patientRut: { contains: q, mode: "insensitive" as const } },
      { diagnosis: { contains: q, mode: "insensitive" as const } },
      { medications: { string_contains: q } },
    ];
  }

  const prescriptions = await db.medicalPrescription.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: f.limit ?? 200,
    include: {
      patient: {
        include: {
          person: true,
        },
      },
    },
  });

  return { items: prescriptions };
}

/**
 * Envía la receta por email con el PDF adjunto (Resend). Regenera el PDF al
 * vuelo desde la fila guardada. Lanza CONFLICT si email no está configurado.
 */
export async function emailPrescription(args: {
  id: string;
  to: string;
  message?: string;
}): Promise<{ ok: boolean; id: string | null }> {
  const { bytes, prescription } = await buildPrescriptionPdfBytes(args.id, "full");
  const pdfBase64 = Buffer.from(bytes).toString("base64");
  const safeRut = (prescription.patientRut ?? "sin_rut").replace(/\./g, "");
  const folioLine = prescription.folio ? ` (folio ${prescription.folio})` : "";
  const extra = args.message?.trim()
    ? `<p style="white-space:pre-wrap">${args.message.trim()}</p>`
    : "";

  const html = `<!doctype html><html lang="es"><body style="font-family:system-ui,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:520px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;color:#0e64b7;margin:0 0 16px">Receta médica</h1>
<p>Hola ${prescription.patientName},</p>
<p>Adjuntamos tu receta médica${folioLine} emitida por Bioalergia.</p>
${extra}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af">Bioalergia · Este es un correo automático, no respondas a esta dirección.</p>
</body></html>`;

  try {
    const result = await sendEmail({
      to: args.to,
      subject: `Receta médica${folioLine} — Bioalergia`,
      html,
      text: `Hola ${prescription.patientName}, adjuntamos tu receta médica${folioLine} emitida por Bioalergia.`,
      attachments: [
        { filename: `receta_${safeRut}.pdf`, content: pdfBase64, contentType: "application/pdf" },
      ],
      idempotencyKey: `prescription/${prescription.id}/${args.to}`,
    });
    return { ok: result.ok, id: result.id };
  } catch (error) {
    logError("prescription.email", error, { id: args.id });
    throw error;
  }
}
