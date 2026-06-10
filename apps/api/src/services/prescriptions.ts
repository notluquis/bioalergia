import { db } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { ageFromBirthDate } from "../lib/time.ts";
import { sendEmail } from "./email/index.ts";

export type PrescriptionPdfMode = "full" | "overlay" | "template";

type PrescriptionRow = NonNullable<
  Awaited<ReturnType<typeof db.medicalPrescription.findUnique>>
>;

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
  const { generateMedicalPrescriptionPdf, generateQRCode } = await import(
    "../modules/certificates/certificate.service.ts"
  );
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
      prescriptionType: (prescription.prescriptionType ?? "SIMPLE") as
        | "SIMPLE"
        | "RETENIDA",
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
