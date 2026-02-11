import { z } from "zod";
import { zDateString } from "@/lib/api-validate";

const DecimalSchema = z.union([z.number(), z.string()]);

export const PersonSchema = z.strictObject({
  address: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  email: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  id: z.number(),
  motherName: z.string().nullable().optional(),
  names: z.string(),
  personType: z.string(),
  phone: z.string().nullable().optional(),
  rut: z.string(),
  updatedAt: z.coerce.date(),
});

export const PatientListItemSchema = z.strictObject({
  birthDate: zDateString.nullable().optional(),
  bloodType: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  id: z.number(),
  notes: z.string().nullable().optional(),
  person: PersonSchema,
  personId: z.number(),
  updatedAt: z.coerce.date(),
});

export const PatientListSchema = z.array(PatientListItemSchema);

export const ConsultationSchema = z.strictObject({
  createdAt: z.coerce.date(),
  date: zDateString,
  diagnosis: z.string().nullable().optional(),
  eventId: z.number().nullable().optional(),
  id: z.number(),
  notes: z.string().nullable().optional(),
  patientId: z.number(),
  reason: z.string(),
  treatment: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export const MedicalCertificateSchema = z.strictObject({
  address: z.string(),
  birthDate: zDateString,
  diagnosis: z.string(),
  driveFileId: z.string(),
  id: z.string(),
  issuedAt: zDateString,
  issuedBy: z.number(),
  metadata: z.unknown().nullable().optional(),
  patientId: z.number().nullable().optional(),
  patientName: z.string(),
  patientRut: z.string(),
  pdfHash: z.string(),
  purpose: z.string(),
  purposeDetail: z.string().nullable().optional(),
  restDays: z.number().nullable().optional(),
  restEndDate: zDateString.nullable().optional(),
  restStartDate: zDateString.nullable().optional(),
  symptoms: z.string().nullable().optional(),
});

export const BudgetItemSchema = z.strictObject({
  budgetId: z.number(),
  description: z.string(),
  id: z.number(),
  quantity: z.number(),
  totalPrice: DecimalSchema,
  unitPrice: DecimalSchema,
});

export const PatientPaymentSchema = z.strictObject({
  amount: DecimalSchema,
  budgetId: z.number().nullable().optional(),
  createdAt: z.coerce.date(),
  id: z.number(),
  notes: z.string().nullable().optional(),
  patientId: z.number(),
  paymentDate: zDateString,
  paymentMethod: z.string(),
  reference: z.string().nullable().optional(),
});

export const BudgetSchema = z.strictObject({
  createdAt: z.coerce.date(),
  discount: DecimalSchema,
  finalAmount: DecimalSchema,
  id: z.number(),
  items: z.array(BudgetItemSchema),
  notes: z.string().nullable().optional(),
  patientId: z.number(),
  payments: z.array(PatientPaymentSchema).optional(),
  status: z.string(),
  title: z.string(),
  totalAmount: DecimalSchema,
  updatedAt: z.coerce.date(),
});

export const AttachmentSchema = z.strictObject({
  driveFileId: z.string(),
  id: z.string(),
  mimeType: z.string().nullable().optional(),
  name: z.string(),
  patientId: z.number(),
  type: z.string(),
  uploadedAt: z.coerce.date(),
  uploadedBy: z.number(),
  webViewLink: z.string().optional(),
});

export const PatientDetailSchema = z.strictObject({
  attachments: z.array(AttachmentSchema),
  birthDate: zDateString.nullable().optional(),
  bloodType: z.string().nullable().optional(),
  budgets: z.array(BudgetSchema),
  consultations: z.array(ConsultationSchema),
  createdAt: z.coerce.date(),
  id: z.number(),
  medicalCertificates: z.array(MedicalCertificateSchema),
  notes: z.string().nullable().optional(),
  payments: z.array(PatientPaymentSchema),
  person: PersonSchema,
  personId: z.number(),
  updatedAt: z.coerce.date(),
});

export const PatientBudgetListSchema = z.array(BudgetSchema);
export const PatientPaymentListSchema = z.array(PatientPaymentSchema);
export const PatientAttachmentListSchema = z.array(AttachmentSchema);
