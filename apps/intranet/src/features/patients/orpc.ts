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

type PatientsORPCClient = {
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
  listPayments: (input: { patientId: number }) => Promise<{
    payments: PatientPayment[];
    status: "ok";
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
