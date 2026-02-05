import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { CreateCreditInput, PayInstallmentInput, PersonalCredit } from "./types";

const PersonalCreditSchema = z.looseObject({});
const PersonalCreditsSchema = z.array(PersonalCreditSchema);
const DeleteCreditResponseSchema = z.object({ success: z.boolean() });
const PayInstallmentResponseSchema = z.looseObject({});

type PayInstallmentResponse = z.infer<typeof PayInstallmentResponseSchema>;

export const personalFinanceApi = {
  // Create
  createCredit: async (data: CreateCreditInput) => {
    return apiClient.post<PersonalCredit>(
      "/api/personal-finance/credits",
      {
        ...data,
        installments: data.installments?.map((i) => ({
          ...i,
          dueDate: i.dueDate,
        })),
        startDate: data.startDate,
      },
      { responseSchema: PersonalCreditSchema },
    );
  },

  // Delete
  deleteCredit: async (id: number) => {
    return apiClient.delete<{ success: boolean }>(`/api/personal-finance/credits/${id}`, {
      responseSchema: DeleteCreditResponseSchema,
    });
  },

  // Get Detail
  getCredit: async (id: number) => {
    return apiClient.get<PersonalCredit>(`/api/personal-finance/credits/${id}`, {
      responseSchema: PersonalCreditSchema,
    });
  },

  // List
  listCredits: async () => {
    return apiClient.get<PersonalCredit[]>("/api/personal-finance/credits", {
      responseSchema: PersonalCreditsSchema,
    });
  },

  // Pay Installment
  payInstallment: async (
    creditId: number,
    installmentNumber: number,
    data: PayInstallmentInput,
  ) => {
    return apiClient.post<PayInstallmentResponse>(
      `/api/personal-finance/credits/${creditId}/installments/${installmentNumber}/pay`,
      {
        ...data,
        paymentDate: data.paymentDate,
      },
      { responseSchema: PayInstallmentResponseSchema },
    );
  },
};
