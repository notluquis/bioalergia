import { createORPCClient, ORPCError } from "@orpc/client";
import type Decimal from "decimal.js";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type DecimalLike = Decimal | number | string;

type PatientPayment = {
  amount: DecimalLike;
  budgetId?: number | null;
  createdAt: Date;
  id: number;
  notes?: string | null;
  patientId: number;
  paymentDate: Date;
  paymentMethod: string;
  reference?: string | null;
};

type PatientBudget = {
  createdAt: Date;
  discount: DecimalLike;
  finalAmount: DecimalLike;
  id: number;
  items: unknown[];
  notes?: string | null;
  patientId: number;
  payments?: PatientPayment[];
  status: string;
  title: string;
  totalAmount: DecimalLike;
  updatedAt: Date;
};

type Person = {
  address?: string | null;
  createdAt: Date;
  email?: string | null;
  fatherName?: string | null;
  id: number;
  motherName?: string | null;
  names: string;
  personType: string;
  phone?: string | null;
  rut: string;
  updatedAt: Date;
};

type Consultation = {
  createdAt: Date;
  date: Date;
  diagnosis?: string | null;
  eventId?: number | null;
  id: number;
  notes?: string | null;
  patientId: number;
  reason: string;
  treatment?: string | null;
  updatedAt: Date;
};

type Attachment = {
  driveFileId: string;
  id: string;
  mimeType?: string | null;
  name: string;
  patientId: number;
  type: string;
  uploadedAt: Date;
  uploadedBy: number;
  webViewLink?: string;
};

type MedicalCertificate = {
  address: string;
  birthDate: Date;
  diagnosis: string;
  driveFileId: string;
  id: string;
  issuedAt: Date;
  issuedBy: number;
  metadata?: unknown;
  patientId?: number | null;
  patientName: string;
  patientRut: string;
  pdfHash: string;
  purpose: string;
  purposeDetail?: string | null;
  restDays?: number | null;
  restEndDate?: Date | null;
  restStartDate?: Date | null;
  symptoms?: string | null;
};

type PatientListItem = {
  birthDate?: Date | null;
  bloodType?: string | null;
  createdAt: Date;
  id: number;
  notes?: string | null;
  person: Person;
  personId: number;
  updatedAt: Date;
};

type PatientDetail = PatientListItem & {
  attachments: Attachment[];
  budgets: PatientBudget[];
  consultations: Consultation[];
  medicalCertificates: MedicalCertificate[];
  payments: PatientPayment[];
};

type PatientDteSource = {
  clientName: string;
  clientRUT: string;
  documentDate?: Date | null;
  documentType: number;
  folio?: string | null;
  period?: string | null;
  sourceUpdatedAt?: Date | null;
  updatedAt?: Date | null;
};

type PatientsORPCClient = {
  create: (input: {
    address?: string;
    birthDate?: string;
    bloodType?: string;
    email?: string;
    fatherName?: string;
    motherName?: string;
    names: string;
    notes?: string;
    phone?: string;
    rut: string;
  }) => Promise<{ patient: PatientListItem; status: "ok" }>;
  createBudget: (input: {
    discount: number;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
    patientId: number;
    title: string;
  }) => Promise<{ budget: PatientBudget; status: "ok" }>;
  createConsultation: (input: {
    date: string;
    diagnosis?: string;
    eventId?: number;
    notes?: string;
    patientId: number;
    reason: string;
    treatment?: string;
  }) => Promise<{ consultation: Consultation; status: "ok" }>;
  createPayment: (input: {
    amount: number;
    budgetId?: number;
    notes?: string;
    patientId: number;
    paymentDate: string;
    paymentMethod: "Efectivo" | "Otro" | "Tarjeta" | "Transferencia";
    reference?: string;
  }) => Promise<{ payment: PatientPayment; status: "ok" }>;
  listBudgets: (input: { patientId: number }) => Promise<{
    budgets: PatientBudget[];
    status: "ok";
  }>;
  detail: (input: { patientId: number }) => Promise<{
    patient: PatientDetail;
    status: "ok";
  }>;
  list: (input?: { q?: string }) => Promise<{
    patients: PatientListItem[];
    status: "ok";
  }>;
  listDteSources: (input?: { limit?: number; period?: string; q?: string }) => Promise<{
    rows: PatientDteSource[];
    status: "ok";
  }>;
  listPayments: (input: { patientId: number }) => Promise<{
    payments: PatientPayment[];
    status: "ok";
  }>;
  syncDteSources: (input: {
    documentTypes?: number[];
    dryRun?: boolean;
    limit?: number;
    period?: string;
  }) => Promise<{
    dryRun: boolean;
    inserted: number;
    message: string;
    selected: number;
    skipped: number;
    status: "ok";
    updated: number;
  }>;
};

const patientsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const patientsORPCClient = createORPCClient<PatientsORPCClient>(patientsORPCLink, {
  path: ["api", "orpc", "patients", "rpc"],
});

export function toPatientsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
