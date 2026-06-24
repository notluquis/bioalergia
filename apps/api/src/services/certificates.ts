import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "@finanzas/db";
import type {
  certificateVerifyResponseSchema,
  generateMedicalCertificateInputSchema,
  listMedicalCertificatesInputSchema,
  medicalCertificateListResponseSchema,
} from "@finanzas/orpc-contracts/certificates";
import type { z } from "zod";
import { medicalCertificateSchema } from "../modules/certificates/certificate.schema.ts";
import { parseChileDateOnly } from "../lib/time.ts";
import { uploadCertificateToDrive } from "./certificates-drive.ts";
import { createVerification, generateVerificationCode } from "./verification.ts";

// Lógica de negocio de certificados médicos, fuera de los handlers oRPC. Los
// servicios validan y lanzan (DomainError mapeado por orpc/error.ts; el caso de
// integridad sin emisor queda como Error nativo → 500 real). Los handlers quedan
// finos: authz (en el handler) → servicio → return.

type ListCertificatesFilter = z.infer<typeof listMedicalCertificatesInputSchema>;
type CertificateVerifyResponse = z.infer<typeof certificateVerifyResponseSchema>;
type CertificateListResponse = z.infer<typeof medicalCertificateListResponseSchema>;

// Parse "YYYY-MM-DD" as Chile-local midnight -> UTC instant (Date). Invalid -> Invalid Date.
const parseDateOnly = (value: string): Date => parseChileDateOnly(value) ?? new Date(NaN);

/**
 * Genera un certificado médico firmado: PDF → PDF/A-3 (ANTES de firmar) → firma
 * → hash → sube a Drive → persiste fila + verificación. Devuelve el File.
 *
 * Movido desde el handler oRPC SIN alterar el orden ni la ruta criptográfica:
 * PDF/A-3 se aplica antes de firmar (firmar después conserva validez; convertir
 * después invalidaría la firma). El temp file se limpia siempre (finally).
 */
export async function generateMedicalCertificate(
  input: z.infer<typeof generateMedicalCertificateInputSchema>,
  issuedBy: number
): Promise<File> {
  const parsed = medicalCertificateSchema.parse(input);
  const certificateId = crypto.randomUUID();
  const { generateMedicalCertificatePdf, generateQRCode, signPdf } =
    await import("../modules/certificates/certificate.service.ts");
  const verificationCode = generateVerificationCode();
  const qrCode = await generateQRCode(verificationCode);
  const clinic = await db.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const pdfBytes = await generateMedicalCertificatePdf(parsed, qrCode, {
    primary: clinic.logoUrl,
    secondary: clinic.secondaryLogoUrl,
  });
  // PDF/A-3 ANTES de firmar (firmar después conserva validez; convertir
  // después de firmar invalidaría la firma). PDF/A-2+ admite firmas.
  const { toPdfA3 } = await import("../modules/pdf/pdf-a.ts");
  const pdfaBytes = await toPdfA3(pdfBytes, "Certificado médico");
  const signedPdfBytes = await signPdf(pdfaBytes);
  const pdfHash = crypto.createHash("sha256").update(signedPdfBytes).digest("hex");
  const tempPath = path.join(os.tmpdir(), `${certificateId}.pdf`);
  const fileName = `certificado_medico_${parsed.rut.replace(/\./g, "")}.pdf`;

  fs.writeFileSync(tempPath, signedPdfBytes);

  try {
    const { fileId } = await uploadCertificateToDrive(
      tempPath,
      `certificado_${parsed.rut.replace(/\./g, "")}_${Date.now()}.pdf`,
      parsed,
      pdfHash
    );

    await db.medicalCertificate.create({
      data: {
        address: parsed.address,
        birthDate: parseDateOnly(parsed.birthDate),
        diagnosis: parsed.diagnosis,
        driveFileId: fileId,
        id: certificateId,
        issuedBy,
        metadata: parsed,
        patientName: parsed.patientName,
        patientRut: parsed.rut,
        pdfHash,
        purpose: parsed.purpose,
        purposeDetail: parsed.purposeDetail,
        restDays: parsed.restDays,
        restEndDate: parsed.restEndDate ? parseDateOnly(parsed.restEndDate) : null,
        restStartDate: parsed.restStartDate ? parseDateOnly(parsed.restStartDate) : null,
        symptoms: parsed.symptoms,
      },
    });

    await createVerification({
      documentType: "certificate",
      certificateId,
      code: verificationCode,
      pdfHash,
    });
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }

  return new File([Buffer.from(signedPdfBytes)], fileName, { type: "application/pdf" });
}

/**
 * Lista certificados médicos con filtros (rango de fechas / búsqueda libre).
 * Where-builder movido del handler oRPC sin cambios.
 */
export async function listMedicalCertificates(
  filter: ListCertificatesFilter
): Promise<CertificateListResponse> {
  const f = filter ?? {};
  const where: Record<string, unknown> = {};

  if (f.from || f.to) {
    const range: { gte?: Date; lt?: Date } = {};
    if (f.from) range.gte = parseDateOnly(f.from);
    if (f.to) {
      const toMid = parseDateOnly(f.to);
      range.lt = new Date(toMid.getTime() + 86_400_000);
    }
    where.issuedAt = range;
  }

  if (f.search?.trim()) {
    const q = f.search.trim();
    where.OR = [
      { patientName: { contains: q, mode: "insensitive" as const } },
      { patientRut: { contains: q, mode: "insensitive" as const } },
      { diagnosis: { contains: q, mode: "insensitive" as const } },
    ];
  }

  const certificates = await db.medicalCertificate.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: f.limit ?? 200,
  });

  return { items: certificates, total: certificates.length };
}

/**
 * Borra un certificado médico por id. Devuelve { ok: true }.
 */
export async function deleteMedicalCertificate(id: string): Promise<{ ok: boolean }> {
  await db.medicalCertificate.delete({
    where: { id },
  });
  return { ok: true };
}

/**
 * Verifica autenticidad de un certificado: proyección pública segura. Devuelve
 * `{ valid: false, error }` si no existe (sin throw). Lanza Error nativo (→ 500)
 * si el certificado existe pero perdió su emisor (violación de integridad, no es
 * un error de usuario). Movido del handler sin cambiar la semántica.
 */
export async function verifyMedicalCertificate(id: string): Promise<CertificateVerifyResponse> {
  const certificate = await db.medicalCertificate.findUnique({
    where: { id },
    include: {
      issuer: {
        include: {
          person: true,
        },
      },
    },
  });

  if (!certificate) {
    return {
      error: "Certificado no encontrado",
      valid: false as const,
    };
  }

  if (!certificate.issuer?.person) {
    throw new Error("Certificado sin emisor válido");
  }

  return {
    diagnosis: certificate.diagnosis,
    doctor: {
      name: certificate.issuer.person.names,
      specialty: "Especialista en Alergología e Inmunología Clínica",
    },
    issuedAt: certificate.issuedAt,
    patient: {
      name: certificate.patientName,
    },
    purpose: certificate.purpose,
    restDays: certificate.restDays,
    restEndDate: certificate.restEndDate,
    restStartDate: certificate.restStartDate,
    valid: true as const,
  };
}
