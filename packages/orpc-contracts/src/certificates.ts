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

export const prescriptionMedicationSchema = z.object({
  dosage: z.string().max(160).optional(),
  duration: z.string().max(160).optional(),
  frequency: z.string().max(160).optional(),
  instructions: z.string().max(300).optional(),
  name: z.string().min(1).max(180),
});

export const generateMedicalPrescriptionInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  diagnosis: z.string().max(500).optional(),
  doctorAddress: z.string().optional(),
  doctorEmail: z.string().optional(),
  doctorName: z.string().optional(),
  doctorRut: z.string().optional(),
  doctorSpecialty: z.string().optional(),
  medications: z.array(prescriptionMedicationSchema).min(1).max(12),
  notes: z.string().max(1000).optional(),
  patientId: z.number().int().positive(),
});

export const listMedicalPrescriptionsInputSchema = z
  .object({
    limit: z.number().int().positive().max(200).optional(),
    patientId: z.number().int().positive().optional(),
  })
  .optional();

export const medicalPrescriptionSchema = z.object({
  date: z.coerce.date(),
  diagnosis: z.string().nullable(),
  doctorName: z.string().nullable(),
  driveFileId: z.string(),
  id: z.string(),
  issuedAt: z.coerce.date(),
  medications: z.unknown(),
  notes: z.string().nullable(),
  patient: z.object({
    id: z.number().int(),
    person: z.object({
      fatherName: z.string().nullable().optional(),
      motherName: z.string().nullable().optional(),
      names: z.string(),
      rut: z.string().nullable().optional(),
    }),
  }),
  patientId: z.number().int(),
  patientName: z.string(),
  patientRut: z.string().nullable(),
  pdfHash: z.string(),
});

export const medicalPrescriptionListResponseSchema = z.object({
  items: z.array(medicalPrescriptionSchema),
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
  generatePrescription: oc
    .route({ method: "POST", path: "/prescription" })
    .input(generateMedicalPrescriptionInputSchema)
    .output(z.file()),
  listPrescriptions: oc
    .route({ method: "GET", path: "/prescriptions" })
    .input(listMedicalPrescriptionsInputSchema)
    .output(medicalPrescriptionListResponseSchema),
  verify: oc
    .route({ method: "GET", path: "/verify/{id}" })
    .input(certificateVerifyInputSchema)
    .output(certificateVerifyResponseSchema),
};

export type CertificatesContract = typeof certificatesContract;
export type GenerateMedicalPrescriptionInput = z.infer<
  typeof generateMedicalPrescriptionInputSchema
>;
export type MedicalPrescription = z.infer<typeof medicalPrescriptionSchema>;
