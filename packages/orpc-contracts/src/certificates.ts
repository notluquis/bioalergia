import { oc } from "@orpc/contract";
import { z } from "zod";

export const certificateVerifyInputSchema = z.object({
  id: z.string().min(1),
});

export const generateMedicalCertificateInputSchema = z.object({
  address: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  diagnosis: z.string().min(1),
  doctorAddress: z.string().optional(),
  doctorEmail: z.string().optional(),
  doctorName: z.string().optional(),
  doctorRut: z.string().optional(),
  doctorSpecialty: z.string().optional(),
  patientName: z.string().min(1),
  purpose: z.enum(["trabajo", "estudio", "otro"]).default("trabajo"),
  purposeDetail: z.string().optional(),
  restDays: z.number().int().min(0).optional(),
  restEndDate: z.string().optional(),
  restStartDate: z.string().optional(),
  rut: z.string().min(1),
  symptoms: z.string().optional(),
});

export const certificateVerifyResponseSchema = z.union([
  z.object({
    diagnosis: z.string(),
    doctor: z.object({
      name: z.string(),
      specialty: z.string().optional(),
    }),
    issuedAt: z.coerce.date(),
    patient: z.object({
      name: z.string(),
    }),
    purpose: z.string(),
    restDays: z.number().nullable().optional(),
    restEndDate: z.coerce.date().nullable().optional(),
    restStartDate: z.coerce.date().nullable().optional(),
    valid: z.literal(true),
  }),
  z.object({
    error: z.string().optional(),
    valid: z.literal(false),
  }),
]);

export const certificatesContract = {
  generateMedical: oc
    .route({ method: "POST", path: "/medical" })
    .input(generateMedicalCertificateInputSchema)
    .output(z.file()),
  verify: oc
    .route({ method: "GET", path: "/verify/{id}" })
    .input(certificateVerifyInputSchema)
    .output(certificateVerifyResponseSchema),
};

export type CertificatesContract = typeof certificatesContract;
