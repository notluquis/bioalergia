import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, kysely } from "@finanzas/db";
import { sql } from "kysely";
import {
  annulPrescriptionResponseSchema,
  certificateVerifyInputSchema,
  certificateVerifyResponseSchema,
  emailPrescriptionInputSchema,
  emailPrescriptionResponseSchema,
  generateMedicalCertificateInputSchema,
  generateMedicalPrescriptionInputSchema,
  listMedicalPrescriptionsInputSchema,
  medicalPrescriptionGenerateResponseSchema,
  medicalPrescriptionListResponseSchema,
  prescriptionIdInputSchema,
} from "@finanzas/orpc-contracts/certificates";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os as orpcOs } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import type * as CertificateServiceModule from "../modules/certificates/certificate.service.ts";
import {
  medicalCertificateSchema,
  medicalPrescriptionSchema,
  toStoredDiagnoses,
  toStoredMedications,
} from "../modules/certificates/certificate.schema.ts";
import { buildFolio } from "../modules/certificates/folio.ts";
// Lazy: pdf-lib weighs ~3MB+ in heap; only load on first /medical request.
type CertificateService = typeof CertificateServiceModule;
let _certificateService: CertificateService | undefined;
async function getCertificateService(): Promise<CertificateService> {
  if (!_certificateService) {
    _certificateService = await import("../modules/certificates/certificate.service.ts");
  }
  return _certificateService;
}
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { parseChileDateOnly } from "../lib/time.ts";
import { uploadCertificateToDrive } from "../services/certificates-drive.ts";
import { annulPrescription, emailPrescription } from "../services/prescriptions.ts";
import { createVerification, generateVerificationCode } from "../services/verification.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CertificatesORPCContext = {
  hono: HonoContext;
};

const base = orpcOs.$context<CertificatesORPCContext>();

// JSON-safe recursivo local que ESPEJA el `JsonValue` de ZenStack: `null` solo
// es válido DENTRO de objetos/arrays, no en el top-level (el `JsonValue`
// exportado por @finanzas/db sí permite null al tope y por eso no asigna al
// payload Json). Mismo enfoque que services/employees.ts.
type JsonInput =
  | string
  | number
  | boolean
  | { [key: string]: JsonInput | null }
  | Array<JsonInput | null>;

// Parse "YYYY-MM-DD" as Chile-local midnight -> UTC instant (Date). Invalid -> Invalid Date.
const parseDateOnly = (value: string) => parseChileDateOnly(value) ?? new Date(NaN);

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

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const createMedicalCertificates = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "MedicalCertificate");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const readMedicalCertificates = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "MedicalCertificate");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const certificatesORPCRouterBase = {
  generateMedical: createMedicalCertificates
    .route({
      method: "POST",
      path: "/medical",
      summary: "Generate a signed medical certificate PDF",
      tags: ["Certificates"],
    })
    .input(generateMedicalCertificateInputSchema)
    .output(z.file())
    .handler(async ({ context, input }) => {
      const parsed = medicalCertificateSchema.parse(input);
      const certificateId = crypto.randomUUID();
      const { generateMedicalCertificatePdf, generateQRCode, signPdf } =
        await getCertificateService();
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
            issuedBy: context.user.id,
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
    }),

  generatePrescription: createMedicalCertificates
    .route({
      method: "POST",
      path: "/prescription",
      summary: "Generate a medical prescription PDF",
      tags: ["Certificates"],
    })
    .input(generateMedicalPrescriptionInputSchema)
    .output(medicalPrescriptionGenerateResponseSchema)
    .handler(async ({ context, input }) => {
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
            },
          },
        },
      });
      if (!patient) throw new ORPCError("NOT_FOUND", { message: "Paciente no encontrado" });

      const clinic = await db.clinicSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
      const fullName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
        .filter(Boolean)
        .join(" ");
      const diagnosisText =
        parsed.diagnosis?.trim() || formatPrescriptionDiagnoses(parsed.diagnoses);

      // Folio: correlativo desde la secuencia (auditoría) + sufijo aleatorio.
      const folioRes = await sql<{
        v: number;
      }>`SELECT nextval('medical_prescription_folio_seq')::int AS v`.execute(kysely);
      const folioSeq = folioRes.rows[0]?.v ?? 0;
      const folio = buildFolio(folioSeq, Number(parsed.date.slice(0, 4)));
      const doctorLicense = clinic.superintendenciaNumber ?? undefined;
      const prescriptionType = parsed.prescriptionType ?? "SIMPLE";
      const prescriptionId = crypto.randomUUID();
      const verificationCode = generateVerificationCode();

      // Normalización tipada → fila JSON-safe (sin claves `undefined`, que
      // ZenStack rechaza en columnas Json).
      const storedMedications = toStoredMedications(parsed.medications);
      const storedDiagnoses = parsed.diagnoses
        ? toStoredDiagnoses(parsed.diagnoses)
        : undefined;

      // SIN Drive ni PDF al crear: el PDF es función pura de esta fila y se
      // genera al descargar/imprimir/enviar (services/prescriptions.ts). Esto
      // hace el create instantáneo y mantiene la receta inmutable (la fila es la
      // única fuente de verdad; el documento solo se anula, nunca se edita).
      await db.medicalPrescription.create({
        data: {
          date: parseDateOnly(parsed.date),
          folio,
          folioSeq,
          prescriptionType,
          doctorLicense,
          diagnosis: diagnosisText,
          diagnoses: storedDiagnoses,
          doctorAddress: parsed.doctorAddress,
          doctorEmail: parsed.doctorEmail,
          doctorName: parsed.doctorName,
          doctorRut: parsed.doctorRut,
          doctorSpecialty: parsed.doctorSpecialty,
          id: prescriptionId,
          issuedBy: context.user.id,
          medications: storedMedications,
          // Metadata = respaldo Json plano. Optativos ausentes → `null` (JSON
          // válido), nunca `undefined`. Diagnoses van a su columna dedicada.
          metadata: {
            prescriptionType,
            medications: storedMedications,
            diagnosis: diagnosisText ?? null,
            notes: parsed.notes ?? null,
            patientName: fullName,
            patientRut: patient.person.rut ?? null,
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
    }),

  annulPrescription: createMedicalCertificates
    .route({
      method: "POST",
      path: "/prescription/{id}/annul",
      summary: "Annul a medical prescription (soft, keeps audit record)",
      tags: ["Certificates"],
    })
    .input(prescriptionIdInputSchema)
    .output(annulPrescriptionResponseSchema)
    .handler(async ({ input }) => annulPrescription(input.id)),

  emailPrescription: createMedicalCertificates
    .route({
      method: "POST",
      path: "/prescription/{id}/email",
      summary: "Email a medical prescription PDF to the patient",
      tags: ["Certificates"],
    })
    .input(emailPrescriptionInputSchema)
    .output(emailPrescriptionResponseSchema)
    .handler(async ({ input }) =>
      emailPrescription({ id: input.id, to: input.to, message: input.message })
    ),

  listPrescriptions: readMedicalCertificates
    .route({
      method: "GET",
      path: "/prescriptions",
      summary: "List medical prescriptions",
      tags: ["Certificates"],
    })
    .input(listMedicalPrescriptionsInputSchema)
    .output(medicalPrescriptionListResponseSchema)
    .handler(async ({ input }) => {
      const f = input ?? {};
      const where: Record<string, unknown> = {};
      if (f.patientId) where.patientId = f.patientId;
      if (f.prescriptionType) where.prescriptionType = f.prescriptionType;
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
    }),

  verify: base
    .route({
      method: "GET",
      path: "/verify/{id}",
      summary: "Verify medical certificate authenticity",
      tags: ["Certificates"],
    })
    .input(certificateVerifyInputSchema)
    .output(certificateVerifyResponseSchema)
    .handler(async ({ input }) => {
      const certificate = await db.medicalCertificate.findUnique({
        where: { id: input.id },
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
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Certificado sin emisor válido",
        });
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
    }),
};

export const certificatesORPCRouter = base
  .prefix("/api/orpc/certificates")
  .router(certificatesORPCRouterBase);

export const certificatesORPCHandler = new SuperJSONRPCHandler(certificatesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.certificates",
      });
    }),
  ],
});

export const certificatesOpenAPIHandler = new OpenAPIHandler(certificatesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Certificates oRPC",
          description: "Contratos oRPC/OpenAPI para certificados médicos.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.certificates",
      });
    }),
  ],
});

export type CertificatesORPCRouter = typeof certificatesORPCRouter;
