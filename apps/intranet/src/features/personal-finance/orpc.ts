import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { UnsafeORPCClient } from "@/lib/orpc-client";

const personalFinanceORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const personalFinanceORPCClient = createORPCClient(personalFinanceORPCLink, {
  path: ["api", "orpc", "personal-finance", "rpc"],
}) as unknown as UnsafeORPCClient;

export type PersonalCreditInstallmentTransport = {
  amount: null | number | { toNumber: () => number } | undefined;
  capitalAmount?: null | number | { toNumber: () => number } | undefined;
  creditId: number;
  dueDate: Date | string;
  id: number;
  installmentNumber: number;
  interestAmount?: null | number | { toNumber: () => number } | undefined;
  otherCharges?: null | number | { toNumber: () => number } | undefined;
  paidAmount?: null | number | { toNumber: () => number } | undefined;
  paidAmountCLP?: null | number | { toNumber: () => number } | undefined;
  paidAt?: Date | null | string;
  status: "PAID" | "PENDING";
};

export type PersonalCreditTransport = {
  bankName: string;
  createdAt: Date;
  creditNumber: string;
  currency: string;
  description?: null | string;
  id: number;
  installments?: PersonalCreditInstallmentTransport[];
  interestRate?: null | number | { toNumber: () => number } | undefined;
  nextPaymentAmount?: null | number | { toNumber: () => number } | undefined;
  nextPaymentDate?: Date | null | string;
  remainingAmount?: null | number | { toNumber: () => number } | undefined;
  startDate: Date | string;
  status: "ACTIVE" | "PAID" | "REFINANCED";
  totalAmount: null | number | { toNumber: () => number } | undefined;
  totalInstallments: number;
  updatedAt: Date;
} & Record<string, unknown>;

export function toPersonalFinanceApiError(error: unknown): ApiError {
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
