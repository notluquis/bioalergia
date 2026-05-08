import { oc } from "@orpc/contract";
import { z } from "zod";

const decimalSchema = z.union([z.number(), z.string()]);

export const budgetItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

export const createBudgetInputSchema = z.object({
  discount: z.number().min(0),
  items: z.array(budgetItemInputSchema).min(1),
  notes: z.string().optional(),
  patientId: z.number().int(),
  title: z.string().min(1),
});

export const createPatientInputSchema = z.object({
  birthDate: z.string().optional(),
  bloodType: z.string().optional(),
  email: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  names: z.string().min(1),
  notes: z.string().optional(),
  phone: z.string().optional(),
  rut: z.string().min(1),
});

export const createConsultationInputSchema = z.object({
  date: z.string().min(1),
  diagnosis: z.string().optional(),
  eventId: z.number().int().optional(),
  notes: z.string().optional(),
  patientId: z.number().int(),
  reason: z.string().min(1),
  treatment: z.string().optional(),
});

export const patientIdInputSchema = z.object({
  patientId: z.number().int(),
});

export const createPaymentInputSchema = z.object({
  amount: z.number().positive(),
  budgetId: z.number().int().optional(),
  notes: z.string().optional(),
  patientId: z.number().int(),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"]),
  reference: z.string().optional(),
});

export const listPatientsInputSchema = z.object({
  q: z.string().optional(),
});

export const listPatientDteSourcesInputSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
  period: z.string().optional(),
  q: z.string().optional(),
});

export const syncPatientDteSourcesInputSchema = z.object({
  documentTypes: z.array(z.number().int().positive()).optional(),
  dryRun: z.boolean().optional(),
  limit: z.number().int().positive().max(5000).optional(),
  period: z.string().optional(),
});

export const uploadPatientAttachmentInputSchema = z.object({
  file: z.file(),
  name: z.string().optional(),
  patientId: z.number().int().positive(),
  type: z.string().min(1),
});

export const patientPaymentSchema = z.object({
  amount: decimalSchema,
  budgetId: z.number().nullable().optional(),
  createdAt: z.coerce.date(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  paymentDate: z.coerce.date(),
  paymentMethod: z.string(),
  reference: z.string().nullable().optional(),
});

export const budgetItemSchema = z.object({
  budgetId: z.number(),
  description: z.string(),
  id: z.number(),
  quantity: z.number(),
  totalPrice: decimalSchema,
  unitPrice: decimalSchema,
});

export const budgetSchema = z.object({
  createdAt: z.coerce.date(),
  discount: decimalSchema,
  finalAmount: decimalSchema,
  id: z.number().int(),
  items: z.array(budgetItemSchema),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  payments: z.array(patientPaymentSchema).optional(),
  status: z.string(),
  title: z.string(),
  totalAmount: decimalSchema,
  updatedAt: z.coerce.date(),
});

export const personSchema = z.object({
  createdAt: z.coerce.date(),
  email: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  id: z.number().int(),
  motherName: z.string().nullable().optional(),
  names: z.string(),
  personType: z.string(),
  phone: z.string().nullable().optional(),
  rut: z.string().nullable(),
  updatedAt: z.coerce.date(),
});

export const consultationSchema = z.object({
  createdAt: z.coerce.date(),
  date: z.coerce.date(),
  diagnosis: z.string().nullable().optional(),
  eventId: z.number().nullable().optional(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  reason: z.string(),
  treatment: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export const attachmentSchema = z.object({
  driveFileId: z.string(),
  id: z.string(),
  mimeType: z.string().nullable().optional(),
  name: z.string(),
  patientId: z.number().int(),
  type: z.string(),
  uploadedAt: z.coerce.date(),
  uploadedBy: z.number().int(),
  webViewLink: z.string().optional(),
});

export const medicalCertificateSchema = z.object({
  address: z.string(),
  birthDate: z.coerce.date(),
  diagnosis: z.string(),
  driveFileId: z.string(),
  id: z.string(),
  issuedAt: z.coerce.date(),
  issuedBy: z.number().int(),
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

export const patientListItemSchema = z.object({
  birthDate: z.coerce.date().nullable().optional(),
  bloodType: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  person: personSchema,
  personId: z.number().int(),
  updatedAt: z.coerce.date(),
});

export const patientDetailSchema = z.object({
  attachments: z.array(attachmentSchema),
  birthDate: z.coerce.date().nullable().optional(),
  bloodType: z.string().nullable().optional(),
  budgets: z.array(budgetSchema),
  consultations: z.array(consultationSchema),
  createdAt: z.coerce.date(),
  id: z.number().int(),
  medicalCertificates: z.array(medicalCertificateSchema),
  notes: z.string().nullable().optional(),
  payments: z.array(patientPaymentSchema),
  person: personSchema,
  personId: z.number().int(),
  updatedAt: z.coerce.date(),
});

export const patientDteSourceSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  documentDate: z.coerce.date().nullable().optional(),
  documentType: z.number(),
  folio: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  sourceUpdatedAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
});

export const budgetListResponseSchema = z.object({
  budgets: z.array(budgetSchema),
  status: z.literal("ok"),
});

export const budgetResponseSchema = z.object({
  budget: budgetSchema,
  status: z.literal("ok"),
});

export const paymentResponseSchema = z.object({
  payment: patientPaymentSchema,
  status: z.literal("ok"),
});

export const paymentListResponseSchema = z.object({
  payments: z.array(patientPaymentSchema),
  status: z.literal("ok"),
});

export const patientListResponseSchema = z.object({
  patients: z.array(patientListItemSchema),
  status: z.literal("ok"),
});

export const patientDetailResponseSchema = z.object({
  patient: patientDetailSchema,
  status: z.literal("ok"),
});

export const patientResponseSchema = z.object({
  patient: patientListItemSchema,
  status: z.literal("ok"),
});

export const attachmentResponseSchema = z.object({
  attachment: attachmentSchema,
  status: z.literal("ok"),
});

export const consultationResponseSchema = z.object({
  consultation: consultationSchema,
  status: z.literal("ok"),
});

export const patientDteSourceListResponseSchema = z.object({
  rows: z.array(patientDteSourceSchema),
  status: z.literal("ok"),
});

export const patientDteSyncResponseSchema = z.object({
  dryRun: z.boolean(),
  inserted: z.number(),
  message: z.string(),
  selected: z.number(),
  skipped: z.number(),
  status: z.literal("ok"),
  updated: z.number(),
});

export const patientsContract = {
  create: oc.route({ method: "POST", path: "/" }).input(createPatientInputSchema).output(patientResponseSchema),
  createAttachment: oc
    .route({ method: "POST", path: "/attachments" })
    .input(uploadPatientAttachmentInputSchema)
    .output(attachmentResponseSchema),
  createBudget: oc.route({ method: "POST", path: "/budgets" }).input(createBudgetInputSchema).output(budgetResponseSchema),
  createConsultation: oc
    .route({ method: "POST", path: "/consultations" })
    .input(createConsultationInputSchema)
    .output(consultationResponseSchema),
  createPayment: oc.route({ method: "POST", path: "/payments" }).input(createPaymentInputSchema).output(paymentResponseSchema),
  detail: oc.route({ method: "GET", path: "/{patientId}" }).input(patientIdInputSchema).output(patientDetailResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).input(listPatientsInputSchema).output(patientListResponseSchema),
  listBudgets: oc
    .route({ method: "GET", path: "/{patientId}/budgets" })
    .input(patientIdInputSchema)
    .output(budgetListResponseSchema),
  listDteSources: oc
    .route({ method: "GET", path: "/sources/dte" })
    .input(listPatientDteSourcesInputSchema)
    .output(patientDteSourceListResponseSchema),
  listPayments: oc
    .route({ method: "GET", path: "/{patientId}/payments" })
    .input(patientIdInputSchema)
    .output(paymentListResponseSchema),
  syncDteSources: oc
    .route({ method: "POST", path: "/sources/dte/sync" })
    .input(syncPatientDteSourcesInputSchema)
    .output(patientDteSyncResponseSchema),
  getClinicalSeries: oc
    .route({ method: "GET", path: "/{patientId}/clinical-series" })
    .input(z.object({ patientId: z.number().int() }))
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.number(),
            kind: z.string(),
            status: z.string(),
            displayName: z.string().nullable(),
            patientName: z.string().nullable(),
            patientRut: z.string().nullable(),
            skinTestsCount: z.number(),
            eventsCount: z.number(),
            createdAt: z.string(),
          }),
        ),
      }),
    ),
  getSkinTests: oc
    .route({ method: "GET", path: "/{patientId}/skin-tests" })
    .input(z.object({ patientId: z.number().int() }))
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            testDate: z.string(),
            patientName: z.string().nullable(),
            patientRut: z.string().nullable(),
            panelTitle: z.string().nullable(),
            physicianName: z.string().nullable(),
            resultsCount: z.number(),
            seriesId: z.number(),
            seriesKind: z.string(),
          }),
        ),
      }),
    ),
};

export type PatientsContract = typeof patientsContract;
