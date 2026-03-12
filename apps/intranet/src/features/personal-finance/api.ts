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

const PersonalCreditSchema = z.custom<PersonalCredit>();
const PersonalCreditsSchema = z.array(PersonalCreditSchema);
const DeleteCreditResponseSchema = z.object({ success: z.boolean() });
const PayInstallmentResponseSchema = z.custom<PersonalCreditInstallment>();

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
        (await personalFinanceORPCClient.listCredits()).map((credit) =>
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
