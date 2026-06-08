import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "@finanzas/db";
import {
  certificateVerifyInputSchema,
  certificateVerifyResponseSchema,
  generateMedicalCertificateInputSchema,
  generateMedicalPrescriptionInputSchema,
  listMedicalPrescriptionsInputSchema,
  medicalPrescriptionListResponseSchema,
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
} from "../modules/certificates/certificate.schema.ts";
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
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CertificatesORPCContext = {
  hono: HonoContext;
};

const base = orpcOs.$context<CertificatesORPCContext>();

// Parse "YYYY-MM-DD" as Chile-local midnight -> UTC instant (Date). Invalid -> Invalid Date.
const parseDateOnly = (value: string) => parseChileDateOnly(value) ?? new Date(NaN);

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
      const qrCode = await generateQRCode(certificateId);
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
    .output(z.file())
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
      const { generateMedicalPrescriptionPdf } = await getCertificateService();
      const fullName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
        .filter(Boolean)
        .join(" ");
      const rawPdf = await generateMedicalPrescriptionPdf(
        {
          ...parsed,
          patient: { name: fullName, rut: patient.person.rut },
        },
        {
          primary: clinic.logoUrl,
          secondary: clinic.secondaryLogoUrl,
        }
      );
      const { toPdfA3 } = await import("../modules/pdf/pdf-a.ts");
      const pdfBytes = await toPdfA3(rawPdf, "Receta médica");
      const pdfHash = crypto.createHash("sha256").update(pdfBytes).digest("hex");
      const fileName = `receta_medica_${(patient.person.rut ?? "sin_rut").replace(/\./g, "")}.pdf`;
      const prescriptionId = crypto.randomUUID();
      const tempPath = path.join(os.tmpdir(), `${prescriptionId}.pdf`);

      fs.writeFileSync(tempPath, pdfBytes);

      try {
        const { fileId } = await uploadCertificateToDrive(
          tempPath,
          `receta_${(patient.person.rut ?? "sin_rut").replace(/\./g, "")}_${Date.now()}.pdf`,
          {
            ...parsed,
            documentType: "medical_prescription",
            patientName: fullName,
            patientRut: patient.person.rut,
          },
          pdfHash,
          "prescription"
        );

        await db.medicalPrescription.create({
          data: {
            date: parseDateOnly(parsed.date),
            diagnosis: parsed.diagnosis,
            doctorAddress: parsed.doctorAddress,
            doctorEmail: parsed.doctorEmail,
            doctorName: parsed.doctorName,
            doctorRut: parsed.doctorRut,
            doctorSpecialty: parsed.doctorSpecialty,
            driveFileId: fileId,
            id: prescriptionId,
            issuedBy: context.user.id,
            medications: parsed.medications,
            metadata: {
              ...parsed,
              patientName: fullName,
              patientRut: patient.person.rut,
            },
            notes: parsed.notes,
            patientId: parsed.patientId,
            patientName: fullName,
            patientRut: patient.person.rut,
            pdfHash,
          },
        });
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }

      return new File([Buffer.from(pdfBytes)], fileName, { type: "application/pdf" });
    }),

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
      const prescriptions = await db.medicalPrescription.findMany({
        where: input?.patientId ? { patientId: input.patientId } : {},
        orderBy: { issuedAt: "desc" },
        take: input?.limit ?? 100,
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
