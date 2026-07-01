import type {
  Consultation,
  MedicalCertificate,
  MedicalPrescription,
  Patient,
  PatientAttachment,
  PatientPayment,
  Person,
} from "@finanzas/db/models";
import { z } from "zod";
import type { SchemaCoversModel } from "@/lib/api-validate";
import { zApiDateOnly, zDateString } from "@/lib/api-validate";

const DecimalSchema = z.union([z.number(), z.string()]);

export const PersonSchema = z.object({
  createdAt: z.coerce.date(),
  email: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  id: z.number(),
  motherName: z.string().nullable().optional(),
  names: z.string(),
  personType: z.string(),
  phone: z.string().nullable().optional(),
  rut: z.string().nullable(),
  sex: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export const PatientListItemSchema = z.object({
  birthDate: zApiDateOnly.nullable().optional(),
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

export const MedicalPrescriptionSchema = z.strictObject({
  date: z.coerce.date(),
  diagnosis: z.string().nullable().optional(),
  diagnoses: z.unknown().nullable().optional(),
  doctorAddress: z.string().nullable().optional(),
  doctorEmail: z.string().nullable().optional(),
  doctorLicense: z.string().nullable().optional(),
  doctorName: z.string().nullable().optional(),
  doctorRut: z.string().nullable().optional(),
  doctorSpecialty: z.string().nullable().optional(),
  driveFileId: z.string().nullable().optional(),
  folio: z.string().nullable().optional(),
  folioSeq: z.number().nullable().optional(),
  id: z.string(),
  issuedAt: z.coerce.date(),
  issuedBy: z.number(),
  medications: z.unknown(),
  metadata: z.unknown().nullable().optional(),
  notes: z.string().nullable().optional(),
  patientId: z.number(),
  patientName: z.string(),
  patientRut: z.string().nullable().optional(),
  pdfHash: z.string().nullable().optional(),
  status: z.string(),
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
  birthDate: zApiDateOnly.nullable().optional(),
  bloodType: z.string().nullable().optional(),
  budgets: z.array(BudgetSchema),
  consultations: z.array(ConsultationSchema),
  createdAt: z.coerce.date(),
  id: z.number(),
  medicalCertificates: z.array(MedicalCertificateSchema),
  medicalPrescriptions: z.array(MedicalPrescriptionSchema),
  notes: z.string().nullable().optional(),
  payments: z.array(PatientPaymentSchema),
  person: PersonSchema,
  personId: z.number(),
  updatedAt: z.coerce.date(),
});

export const PatientBudgetListSchema = z.array(BudgetSchema);
export const PatientPaymentListSchema = z.array(PatientPaymentSchema);
export const PatientAttachmentListSchema = z.array(AttachmentSchema);

// --- Drift guards (type-only, zero runtime/bundle) ---------------------------
// Bind each response schema to its ZenStack model: if the model gains/renames a
// field the server now sends, `tsgo` fails type-check in CI instead of the SPA
// crashing at runtime with a Zod "unrecognized_keys"/"invalid_type" navigation
// error (the MedicalPrescription folio/status drift, 2026-06). The server's
// output schema is already model-derived (db `makeModelSchema`); this keeps the
// hand-written client schemas honest without shipping the 1MB ZenStack runtime
// into the bundle. PersonSchema intentionally projects a subset (the patient
// view never reads marketing/legacy columns), encoded via Omit so a *new*
// non-omitted Person field still trips the guard.
type PersonProjected = Omit<
  Person,
  | "doctoraliaExternalId"
  | "emailMarketingOptIn"
  | "emailMarketingOptInAt"
  | "emailUnsubscribeToken"
  | "emailUnsubscribedAt"
  | "rutLegacyInvalid"
>;

// Guardian link is written by the identity feeder, not surfaced in the patient
// detail view yet — projected out so the drift guard stays honest for the
// fields this view actually reads.
type PatientProjected = Omit<Patient, "guardianPersonId" | "guardianRelationship">;

const _driftGuards: [
  SchemaCoversModel<PersonProjected, z.infer<typeof PersonSchema>>,
  SchemaCoversModel<PatientProjected, z.infer<typeof PatientDetailSchema>>,
  SchemaCoversModel<Consultation, z.infer<typeof ConsultationSchema>>,
  SchemaCoversModel<MedicalCertificate, z.infer<typeof MedicalCertificateSchema>>,
  SchemaCoversModel<MedicalPrescription, z.infer<typeof MedicalPrescriptionSchema>>,
  SchemaCoversModel<PatientPayment, z.infer<typeof PatientPaymentSchema>>,
  SchemaCoversModel<PatientAttachment, z.infer<typeof AttachmentSchema>>,
] = [true, true, true, true, true, true, true];
void _driftGuards;
