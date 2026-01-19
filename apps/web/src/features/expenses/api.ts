import { apiClient } from "@/lib/api-client";

import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
  MonthlyExpenseStatsRow,
} from "./types";

export async function createMonthlyExpense(payload: CreateMonthlyExpensePayload) {
  return apiClient.post<{ expense: MonthlyExpenseDetail; status: "ok" }>("/api/expenses", payload);
}

export async function fetchMonthlyExpenseDetail(
  publicId: string
): Promise<{ expense: MonthlyExpenseDetail; status: "ok" }> {
  return apiClient.get(`/api/expenses/${publicId}`);
}

export async function fetchMonthlyExpenses(params?: {
  from?: string;
  serviceId?: null | number;
  status?: string;
  to?: string;
}): Promise<{ expenses: MonthlyExpense[]; status: "ok" }> {
  return apiClient.get("/api/expenses", { query: params });
}

export async function fetchMonthlyExpenseStats(params?: {
  category?: null | string;
  from?: string;
  groupBy?: "day" | "month" | "quarter" | "week" | "year";
  to?: string;
}): Promise<{ stats: MonthlyExpenseStatsRow[]; status: "ok" }> {
  return apiClient.get("/api/expenses/stats", { query: params });
}

export async function linkMonthlyExpenseTransaction(publicId: string, payload: LinkMonthlyExpenseTransactionPayload) {
  return apiClient.post<{ expense: MonthlyExpenseDetail; status: "ok" }>(`/api/expenses/${publicId}/link`, payload);
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  return apiClient.post<{ expense: MonthlyExpenseDetail; status: "ok" }>(`/api/expenses/${publicId}/unlink`, {
    transactionId,
  });
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload) {
  return apiClient.put<{ expense: MonthlyExpenseDetail; status: "ok" }>(`/api/expenses/${publicId}`, payload);
}
