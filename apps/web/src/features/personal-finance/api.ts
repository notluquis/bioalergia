import { apiClient } from "@/lib/apiClient";

import type { CreateCreditInput, PayInstallmentInput, PersonalCredit } from "./types";

export const personalFinanceApi = {
  // List
  listCredits: async () => {
    return apiClient.get<PersonalCredit[]>("/api/personal-finance/credits");
  },

  // Get Detail
  getCredit: async (id: number) => {
    return apiClient.get<PersonalCredit>(`/api/personal-finance/credits/${id}`);
  },

  // Create
  createCredit: async (data: CreateCreditInput) => {
    return apiClient.post<PersonalCredit>("/api/personal-finance/credits", {
      ...data,
      startDate: data.startDate.toISOString(),
      installments: data.installments?.map((i) => ({
        ...i,
        dueDate: i.dueDate.toISOString(),
      })),
    });
  },

  // Pay Installment
  payInstallment: async (creditId: number, installmentNumber: number, data: PayInstallmentInput) => {
    return apiClient.post<any>(`/api/personal-finance/credits/${creditId}/installments/${installmentNumber}/pay`, {
      ...data,
      paymentDate: data.paymentDate.toISOString(),
    });
  },

  // Delete
  deleteCredit: async (id: number) => {
    return apiClient.delete<{ success: boolean }>(`/api/personal-finance/credits/${id}`);
  },
};
