import { apiClient } from "@/lib/api-client";

import type { CreateCreditInput, PayInstallmentInput, PersonalCredit } from "./types";

export const personalFinanceApi = {
  // Create
  createCredit: async (data: CreateCreditInput) => {
    return apiClient.post<PersonalCredit>("/api/personal-finance/credits", {
      ...data,
      installments: data.installments?.map((i) => ({
        ...i,
        dueDate: i.dueDate.toISOString(),
      })),
      startDate: data.startDate.toISOString(),
    });
  },

  // Delete
  deleteCredit: async (id: number) => {
    return apiClient.delete<{ success: boolean }>(`/api/personal-finance/credits/${id}`);
  },

  // Get Detail
  getCredit: async (id: number) => {
    return apiClient.get<PersonalCredit>(`/api/personal-finance/credits/${id}`);
  },

  // List
  listCredits: async () => {
    return apiClient.get<PersonalCredit[]>("/api/personal-finance/credits");
  },

  // Pay Installment
  payInstallment: async (
    creditId: number,
    installmentNumber: number,
    data: PayInstallmentInput,
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: unknown response
    return apiClient.post<any>(
      `/api/personal-finance/credits/${creditId}/installments/${installmentNumber}/pay`,
      {
        ...data,
        paymentDate: data.paymentDate.toISOString(),
      },
    );
  },
};
