import crypto from "node:crypto";
import { db } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Verificación pública unificada de documentos (recetas + certificados).
//
// El código corto BA-XXXX-XXXX se codifica en el QR del PDF y la página pública
// /verificar/<code> lo resuelve a una proyección MÍNIMA segura: NUNCA nombre
// completo ni RUT ni contenido clínico (diagnóstico / medicamentos). Solo
// iniciales del paciente, médico, fecha y un badge de integridad opcional.
//
// La regla golden-2026: handlers oRPC finos → este service hace toda la lógica
// (gen de código, colisión-retry, proyección segura) y lanza DomainError.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentType = "prescription" | "certificate";

// Crockford base32: sin I/L/O/U para no confundir al leer el código impreso.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// Especialidad por defecto (mismo texto que el handler legacy de certificados).
const DEFAULT_SPECIALTY = "Especialista en Alergología e Inmunología Clínica";

function randomGroup(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// BA-XXXX-XXXX → 8 chars Crockford base32 ≈ 32 bits de entropía. Suficiente
// para anti-enumeración; la unicidad la garantiza el índice + retry.
function generateCode(): string {
  return `BA-${randomGroup(4)}-${randomGroup(4)}`;
}

// Iniciales seguras a partir de nombres: "Juan Pablo González Soto" → "J.P. G.S."
// Nunca expone el nombre completo. Robusto a strings vacíos / parciales.
function toInitials(fullName: null | string | undefined): string {
  if (!fullName) return "—";
  const words = fullName
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0) return "—";
  return words.map((w) => `${(w[0] ?? "").toUpperCase()}.`).join("");
}

// Código corto público listo para codificar en el QR ANTES de persistir el doc.
// La FK certificate_id/prescription_id exige que el doc exista primero, así que
// el flujo es: (1) generar código → codificarlo en el QR/PDF → crear el doc →
// (2) `createVerification({ ..., code })` lo persiste con el MISMO código.
export function generateVerificationCode(): string {
  return generateCode();
}

export type CreateVerificationInput = {
  documentType: DocumentType;
  certificateId?: string;
  prescriptionId?: string;
  pdfHash?: string;
  // Código pre-generado (el que ya se codificó en el QR). Si se omite, se genera.
  code?: string;
};

// Persiste el registro de verificación y devuelve el código corto. Si recibe un
// `code` pre-generado lo usa (debe calzar con el QR ya impreso) y solo reintenta
// ante colisión cuando NO venía fijado; si venía fijado, una colisión es un
// CONFLICT real (no puede cambiar el código ya impreso en el PDF).
export async function createVerification(input: CreateVerificationInput): Promise<string> {
  const { documentType, certificateId, prescriptionId, pdfHash } = input;

  if (documentType === "certificate" && !certificateId) {
    throw new DomainError("BAD_REQUEST", "certificateId requerido para certificado");
  }
  if (documentType === "prescription" && !prescriptionId) {
    throw new DomainError("BAD_REQUEST", "prescriptionId requerido para receta");
  }

  const fixedCode = input.code;
  const MAX_RETRIES = fixedCode ? 1 : 6;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = fixedCode ?? generateCode();
    try {
      await db.documentVerification.create({
        data: {
          code,
          documentType,
          certificateId: certificateId ?? null,
          prescriptionId: prescriptionId ?? null,
          pdfHash: pdfHash ?? null,
        },
      });
      return code;
    } catch (error) {
      // Colisión de `code` (índice único) → reintentar con otro código. La
      // colisión de certificate_id/prescription_id (1 verificación por doc) NO
      // es recuperable reintentando → propagar como CONFLICT.
      if (isUniqueViolation(error) && !isDocumentAlreadyVerified(error)) {
        continue;
      }
      if (isUniqueViolation(error)) {
        throw new DomainError("CONFLICT", "El documento ya tiene una verificación");
      }
      throw error;
    }
  }
  throw new DomainError("CONFLICT", "No se pudo generar un código único de verificación");
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  // Postgres unique_violation. ZenStack envuelve pero conserva el code 23505.
  return code === "23505";
}

function isDocumentAlreadyVerified(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = String((error as { message?: unknown }).message ?? "");
  return /certificate_id|prescription_id/.test(message);
}

// ─── Proyección pública mínima ───────────────────────────────────────────────

export type VerificationResult =
  | {
      valid: true;
      documentType: DocumentType;
      documentLabel: string;
      issuedAt: Date;
      doctor: { name: string; specialty: string; license?: string };
      patientInitials: string;
      // RUT parcial (primeros + últimos dígitos) para confirmar identidad SIN
      // exponer el RUT completo. Nunca el RUT entero.
      patientRutMasked?: string;
      prescriptionType?: string;
      folio?: string;
      pdfIntact?: boolean;
    }
  | { valid: false };

// "20.275.995-5" → "20·····95-5": muestra primeros 2 + últimos 2 dígitos + DV.
function maskRut(rut: null | string | undefined): string | undefined {
  if (!rut) return undefined;
  const clean = rut.replace(/[.\-\s]/g, "");
  if (clean.length < 4) return undefined;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.slice(0, 2)}·····${body.slice(-2)}-${dv}`;
}

const PRESCRIPTION_TYPE_LABEL: Record<string, string> = {
  SIMPLE: "Receta simple",
  RETENIDA: "Receta retenida",
  CHEQUE: "Receta cheque",
};

const INVALID: VerificationResult = { valid: false };

// Resuelve un código (BA-XXXX-XXXX) o un cuid legacy de certificado (compat con
// los QR antiguos /verify/<id>) a la proyección pública segura. `expectedHash`
// (opcional) habilita el badge de integridad del PDF.
export async function verifyByCode(
  code: string,
  expectedHash?: string
): Promise<VerificationResult> {
  const trimmed = code.trim();
  if (!trimmed) return INVALID;

  // 1) Camino unificado: código corto BA-XXXX-XXXX.
  const verification = await db.documentVerification.findUnique({
    where: { code: trimmed },
  });

  if (verification) {
    if (verification.revokedAt) return INVALID;
    if (verification.documentType === "certificate" && verification.certificateId) {
      return projectCertificate(verification.certificateId, verification.pdfHash, expectedHash);
    }
    if (verification.documentType === "prescription" && verification.prescriptionId) {
      return projectPrescription(verification.prescriptionId, verification.pdfHash, expectedHash);
    }
    return INVALID;
  }

  // 2) Compat legacy: los QR antiguos codifican el cuid del certificado directo.
  return projectCertificate(trimmed, undefined, expectedHash);
}

async function projectCertificate(
  certificateId: string,
  storedHash: null | string | undefined,
  expectedHash: string | undefined
): Promise<VerificationResult> {
  const certificate = await db.medicalCertificate.findUnique({
    where: { id: certificateId },
    include: { issuer: { include: { person: true } } },
  });
  if (!certificate) return INVALID;

  const doctorName = certificate.issuer?.person?.names ?? "Equipo médico Bioalergia";
  return {
    valid: true,
    documentType: "certificate",
    documentLabel: "Certificado médico",
    issuedAt: certificate.issuedAt,
    doctor: { name: doctorName, specialty: DEFAULT_SPECIALTY },
    patientInitials: toInitials(certificate.patientName),
    ...(maskRut(certificate.patientRut)
      ? { patientRutMasked: maskRut(certificate.patientRut) }
      : {}),
    ...integrityBadge(storedHash ?? certificate.pdfHash, expectedHash),
  };
}

async function projectPrescription(
  prescriptionId: string,
  storedHash: null | string | undefined,
  expectedHash: string | undefined
): Promise<VerificationResult> {
  const prescription = await db.medicalPrescription.findUnique({
    where: { id: prescriptionId },
    include: { issuer: { include: { person: true } } },
  });
  if (!prescription) return INVALID;
  if (prescription.status === "ANNULLED") return INVALID;

  const doctorName =
    prescription.doctorName?.trim() ||
    prescription.issuer?.person?.names ||
    "Equipo médico Bioalergia";
  const specialty = prescription.doctorSpecialty?.trim() || DEFAULT_SPECIALTY;
  return {
    valid: true,
    documentType: "prescription",
    documentLabel: "Receta médica",
    issuedAt: prescription.issuedAt,
    doctor: {
      name: doctorName,
      specialty,
      ...(prescription.doctorLicense?.trim() ? { license: prescription.doctorLicense.trim() } : {}),
    },
    patientInitials: toInitials(prescription.patientName),
    ...(maskRut(prescription.patientRut)
      ? { patientRutMasked: maskRut(prescription.patientRut) }
      : {}),
    prescriptionType:
      PRESCRIPTION_TYPE_LABEL[prescription.prescriptionType] ?? prescription.prescriptionType,
    ...(prescription.folio ? { folio: prescription.folio } : {}),
    ...integrityBadge(storedHash ?? prescription.pdfHash, expectedHash),
  };
}

// Devuelve { pdfIntact } solo cuando hay un hash esperado para comparar; si no
// se entrega `expectedHash`, omite el badge (no afirma ni niega integridad).
function integrityBadge(
  storedHash: null | string | undefined,
  expectedHash: string | undefined
): { pdfIntact?: boolean } {
  if (!expectedHash || !storedHash) return {};
  return { pdfIntact: storedHash === expectedHash };
}
