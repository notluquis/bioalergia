import Decimal from "decimal.js";
import { patientsORPCClient, toPatientsApiError } from "./orpc";
import {
  BudgetSchema,
  PatientBudgetListSchema,
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
      Object.entries(value).map(([key, entry]) => [key, normalizeDecimalValues(entry)]),
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

export async function fetchPatientBudgets(patientId: number) {
  try {
    const response = await patientsORPCClient.listBudgets({ patientId });
    return PatientBudgetListSchema.parse(normalizeDecimalValues(response.budgets));
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
