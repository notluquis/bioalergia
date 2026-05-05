import Decimal from "decimal.js";
import { patientsORPCClient, toPatientsApiError } from "./orpc";
import {
  AttachmentSchema,
  BudgetSchema,
  ConsultationSchema,
  PatientBudgetListSchema,
  PatientDetailSchema,
  PatientListSchema,
  PatientPaymentListSchema,
  PatientPaymentSchema,
} from "./schemas";

function normalizeDecimalValues<T>(value: T): T {
  if (Decimal.isDecimal(value)) {
    return value.toNumber() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDecimalValues(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeDecimalValues(entry)])
    ) as T;
  }

  return value;
}

export async function createPatientBudget(input: {
  discount: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
  patientId: number;
  title: string;
}) {
  try {
    const response = await patientsORPCClient.createBudget(input);
    return BudgetSchema.parse(normalizeDecimalValues(response.budget));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function createPatient(input: {
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
}) {
  try {
    const response = await patientsORPCClient.create(input);
    return PatientListSchema.element.parse(normalizeDecimalValues(response.patient));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function createPatientConsultation(input: {
  date: string;
  diagnosis?: string;
  eventId?: number;
  notes?: string;
  patientId: number;
  reason: string;
  treatment?: string;
}) {
  try {
    const response = await patientsORPCClient.createConsultation(input);
    return ConsultationSchema.parse(normalizeDecimalValues(response.consultation));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function createPatientPayment(input: {
  amount: number;
  budgetId?: number;
  notes?: string;
  patientId: number;
  paymentDate: string;
  paymentMethod: "Efectivo" | "Otro" | "Tarjeta" | "Transferencia";
  reference?: string;
}) {
  try {
    const response = await patientsORPCClient.createPayment(input);
    return PatientPaymentSchema.parse(normalizeDecimalValues(response.payment));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function uploadPatientAttachment(input: {
  file: File;
  name?: string;
  patientId: string;
  type: string;
}) {
  try {
    const response = await patientsORPCClient.createAttachment({
      file: input.file,
      name: input.name || input.file.name,
      patientId: Number(input.patientId),
      type: input.type,
    });
    return AttachmentSchema.parse(normalizeDecimalValues(response.attachment));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatient(patientId: number) {
  try {
    const response = await patientsORPCClient.detail({ patientId });
    return PatientDetailSchema.parse(normalizeDecimalValues(response.patient));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatientBudgets(patientId: number) {
  try {
    const response = await patientsORPCClient.listBudgets({ patientId });
    return PatientBudgetListSchema.parse(normalizeDecimalValues(response.budgets));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatientDteSources(
  input: { limit?: number; period?: string; q?: string } = {}
) {
  try {
    const response = await patientsORPCClient.listDteSources(input);
    return normalizeDecimalValues(response.rows);
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatients(q?: string) {
  try {
    const response = await patientsORPCClient.list(q ? { q } : {});
    return PatientListSchema.parse(normalizeDecimalValues(response.patients));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatientPayments(patientId: number) {
  try {
    const response = await patientsORPCClient.listPayments({ patientId });
    return PatientPaymentListSchema.parse(normalizeDecimalValues(response.payments));
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function syncPatientDteSources(input: {
  documentTypes?: number[];
  dryRun?: boolean;
  limit?: number;
  period?: string;
}) {
  try {
    return await patientsORPCClient.syncDteSources(input);
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatientClinicalSeries(patientId: number) {
  try {
    return await patientsORPCClient.getClinicalSeries({ patientId });
  } catch (error) {
    throw toPatientsApiError(error);
  }
}

export async function fetchPatientSkinTests(patientId: number) {
  try {
    return await patientsORPCClient.getSkinTests({ patientId });
  } catch (error) {
    throw toPatientsApiError(error);
  }
}
