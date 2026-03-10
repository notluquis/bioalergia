import { createORPCClient, ORPCError } from "@orpc/client";
import type { Decimal } from "decimal.js";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { CreateCreditInput, PayInstallmentInput } from "./types";

type DecimalLike = Decimal | number;
type DateLike = Date | string;

export type PersonalCreditInstallmentTransport = {
  amount: DecimalLike;
  capitalAmount?: DecimalLike | null;
  creditId: number;
  dueDate: DateLike;
  id: number;
  installmentNumber: number;
  interestAmount?: DecimalLike | null;
  otherCharges?: DecimalLike | null;
  paidAmount?: DecimalLike | null;
  paidAmountCLP?: DecimalLike | null;
  paidAt?: DateLike | null;
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
  institution?: null | string;
  interestRate?: DecimalLike | null;
  nextPaymentAmount?: DecimalLike | null;
  nextPaymentDate?: DateLike | null;
  remainingAmount?: DecimalLike;
  startDate: DateLike;
  status: "ACTIVE" | "PAID" | "REFINANCED";
  totalAmount: DecimalLike;
  totalInstallments: number;
  updatedAt: Date;
};

type PersonalFinanceORPCClient = {
  backfillUfClp: () => Promise<{
    processed: number;
    results: Array<{
      creditId: number;
      installmentNumber: number;
      paidAmount: number;
      paidAmountCLP: number;
      paymentDate: string;
      ufValue: number;
    }>;
  }>;
  createCredit: (input: CreateCreditInput) => Promise<PersonalCreditTransport>;
  deleteCredit: (input: { id: number }) => Promise<{ success: boolean }>;
  getCredit: (input: { id: number }) => Promise<PersonalCreditTransport>;
  listCredits: () => Promise<PersonalCreditTransport[]>;
  payInstallment: (
    input: PayInstallmentInput & { creditId: number; installmentNumber: number },
  ) => Promise<PersonalCreditInstallmentTransport>;
};

const personalFinanceORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const personalFinanceORPCClient = createORPCClient<PersonalFinanceORPCClient>(
  personalFinanceORPCLink,
  {
    path: ["api", "orpc", "personal-finance", "rpc"],
  },
);

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
