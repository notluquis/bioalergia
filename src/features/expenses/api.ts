import { apiClient } from "../../lib/apiClient";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
  MonthlyExpenseStatsRow,
} from "./types";

export async function fetchMonthlyExpenses(params?: {
  from?: string;
  to?: string;
  status?: string;
  serviceId?: number | null;
}): Promise<{ status: "ok"; expenses: MonthlyExpense[] }> {
  return apiClient.get("/api/expenses", { query: params });
}

export async function fetchMonthlyExpenseDetail(
  publicId: string
): Promise<{ status: "ok"; expense: MonthlyExpenseDetail }> {
  return apiClient.get(`/api/expenses/${publicId}`);
}

export async function createMonthlyExpense(payload: CreateMonthlyExpensePayload) {
  return apiClient.post<{ status: "ok"; expense: MonthlyExpenseDetail }>("/api/expenses", payload);
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload) {
  return apiClient.put<{ status: "ok"; expense: MonthlyExpenseDetail }>(`/api/expenses/${publicId}`, payload);
}

export async function linkMonthlyExpenseTransaction(publicId: string, payload: LinkMonthlyExpenseTransactionPayload) {
  return apiClient.post<{ status: "ok"; expense: MonthlyExpenseDetail }>(`/api/expenses/${publicId}/link`, payload);
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  return apiClient.post<{ status: "ok"; expense: MonthlyExpenseDetail }>(`/api/expenses/${publicId}/unlink`, {
    transactionId,
  });
}

export async function fetchMonthlyExpenseStats(params?: {
  from?: string;
  to?: string;
  groupBy?: "day" | "week" | "month" | "quarter" | "year";
  category?: string | null;
}): Promise<{ status: "ok"; stats: MonthlyExpenseStatsRow[] }> {
  return apiClient.get("/api/expenses/stats", { query: params });
}
