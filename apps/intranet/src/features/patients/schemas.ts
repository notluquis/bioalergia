import { z } from "zod";

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
  birthDate: z.coerce.date(),
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
  date: z.coerce.date(),
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
  birthDate: z.coerce.date(),
  diagnosis: z.string(),
  driveFileId: z.string(),
  id: z.string(),
  issuedAt: z.coerce.date(),
  issuedBy: z.number(),
  metadata: z.unknown().nullable().optional(),
  patientId: z.number().nullable().optional(),
  patientName: z.string(),
  patientRut: z.string(),
  pdfHash: z.string(),
  purpose: z.string(),
  purposeDetail: z.string().nullable().optional(),
  restDays: z.number().nullable().optional(),
  restEndDate: z.coerce.date().nullable().optional(),
  restStartDate: z.coerce.date().nullable().optional(),
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
  paymentDate: z.coerce.date(),
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
  birthDate: z.coerce.date(),
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
