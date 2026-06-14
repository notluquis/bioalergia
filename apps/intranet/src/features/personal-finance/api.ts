import { z } from "zod";
import {
  type PersonalCreditInstallmentTransport,
  type PersonalCreditTransport,
  personalFinanceORPCClient,
  toPersonalFinanceApiError,
} from "./orpc";

import type {
  CreateCreditInput,
  PayInstallmentInput,
  PersonalCredit,
  PersonalCreditInstallment,
} from "./types";

// Real schemas matching the POST-normalize shape (amounts coerced to number,
// dates coerced to YYYY-MM-DD strings by normalizeCredit/normalizeInstallment).
// These are NOT no-ops: a `z.custom<T>()` with no predicate passes ANY value at
// runtime (it's a compile-time assertion only). Parsing the normalized shape
// catches backend payload drift — the exact gap that let the `institution` vs
// `bankName` mismatch slip through historically.
//
// We validate AFTER normalize (not the raw oRPC response against the contract)
// because the real backend ships Decimal-like (`{ toNumber() }`) amounts and
// superjson Date objects that the contract's `z.number()`/date fields don't all
// accept verbatim — coercion is normalizeCredit's whole job, so the post-normalize
// layer is where a meaningful invariant exists.
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const PersonalCreditInstallmentSchema = z
  .object({
    amount: z.number(),
    capitalAmount: z.number().nullable().optional(),
    creditId: z.number().int(),
    dueDate: dateOnly,
    id: z.number().int(),
    installmentNumber: z.number().int(),
    interestAmount: z.number().nullable().optional(),
    otherCharges: z.number().nullable().optional(),
    paidAmount: z.number().nullable().optional(),
    paidAmountCLP: z.number().nullable().optional(),
    paidAt: dateOnly.nullable().optional(),
    status: z.enum(["PAID", "PENDING"]),
  })
  .passthrough() satisfies z.ZodType<PersonalCreditInstallment>;

const PersonalCreditSchema = z
  .object({
    bankName: z.string(),
    createdAt: z.date(),
    creditNumber: z.string(),
    currency: z.string(),
    description: z.string().nullable().optional(),
    id: z.number().int(),
    installments: z.array(PersonalCreditInstallmentSchema).optional(),
    institution: z.string().nullable().optional(),
    interestRate: z.number().nullable().optional(),
    nextPaymentAmount: z.number().nullable().optional(),
    nextPaymentDate: dateOnly.nullable().optional(),
    remainingAmount: z.number().optional(),
    startDate: dateOnly,
    status: z.enum(["ACTIVE", "PAID", "REFINANCED"]),
    totalAmount: z.number(),
    totalInstallments: z.number().int(),
    updatedAt: z.date(),
  })
  .passthrough() satisfies z.ZodType<PersonalCredit>;

const PersonalCreditsSchema = z.array(PersonalCreditSchema);
const DeleteCreditResponseSchema = z.object({ success: z.boolean() });
const PayInstallmentResponseSchema = PersonalCreditInstallmentSchema;

function toDateOnlyString(value: Date | null | string | undefined): null | string | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.includes("T") ? value.slice(0, 10) : value;
  }

  return value.toISOString().slice(0, 10);
}

function toNumberValue(value: null | number | { toNumber: () => number } | undefined) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

function normalizeInstallment(
  installment: PersonalCreditInstallmentTransport
): NonNullable<PersonalCredit["installments"]>[number] {
  return {
    ...installment,
    amount: toNumberValue(installment.amount) ?? 0,
    capitalAmount: toNumberValue(installment.capitalAmount),
    dueDate: toDateOnlyString(installment.dueDate) ?? "",
    interestAmount: toNumberValue(installment.interestAmount),
    otherCharges: toNumberValue(installment.otherCharges),
    paidAmount: toNumberValue(installment.paidAmount),
    paidAmountCLP: toNumberValue(installment.paidAmountCLP),
    paidAt: toDateOnlyString(installment.paidAt),
  };
}

function normalizeCredit(credit: PersonalCreditTransport): PersonalCredit {
  return {
    ...credit,
    installments: credit.installments?.map(normalizeInstallment),
    interestRate: toNumberValue(credit.interestRate),
    nextPaymentAmount: toNumberValue(credit.nextPaymentAmount),
    nextPaymentDate: toDateOnlyString(credit.nextPaymentDate),
    remainingAmount: (toNumberValue(credit.remainingAmount) ?? undefined) as number | undefined,
    startDate: toDateOnlyString(credit.startDate) ?? "",
    totalAmount: toNumberValue(credit.totalAmount) ?? 0,
  };
}

export const personalFinanceApi = {
  // Create
  createCredit: async (data: CreateCreditInput) => {
    try {
      const response = await personalFinanceORPCClient.createCredit(data);
      return PersonalCreditSchema.parse(normalizeCredit(response));
    } catch (error) {
      throw toPersonalFinanceApiError(error);
    }
  },

  // Delete
  deleteCredit: async (id: number) => {
    try {
      return DeleteCreditResponseSchema.parse(await personalFinanceORPCClient.deleteCredit({ id }));
    } catch (error) {
      throw toPersonalFinanceApiError(error);
    }
  },

  // Get Detail
  getCredit: async (id: number) => {
    try {
      const response = await personalFinanceORPCClient.getCredit({ id });
      return PersonalCreditSchema.parse(normalizeCredit(response));
    } catch (error) {
      throw toPersonalFinanceApiError(error);
    }
  },

  // List
  listCredits: async () => {
    try {
      return PersonalCreditsSchema.parse(
        (await personalFinanceORPCClient.listCredits()).map((credit: PersonalCreditTransport) =>
          normalizeCredit(credit as PersonalCreditTransport)
        )
      );
    } catch (error) {
      throw toPersonalFinanceApiError(error);
    }
  },

  // Pay Installment
  payInstallment: async (
    creditId: number,
    installmentNumber: number,
    data: PayInstallmentInput
  ) => {
    try {
      return PayInstallmentResponseSchema.parse(
        normalizeInstallment(
          await personalFinanceORPCClient.payInstallment({
            ...data,
            creditId,
            installmentNumber,
          })
        )
      );
    } catch (error) {
      throw toPersonalFinanceApiError(error);
    }
  },
};
