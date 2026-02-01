import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
  MonthlyExpenseStatsRow,
} from "./types";

const ExpenseDetailResponseSchema = z.object({
  expense: z.unknown(),
  status: z.literal("ok"),
});

const ExpensesResponseSchema = z.object({
  expenses: z.array(z.unknown()),
  status: z.literal("ok"),
});

const ExpenseStatsResponseSchema = z.object({
  stats: z.array(z.unknown()),
  status: z.literal("ok"),
});

export async function createMonthlyExpense(payload: CreateMonthlyExpensePayload) {
  return apiClient.post<{ expense: MonthlyExpenseDetail; status: "ok" }>("/api/expenses", payload, {
    responseSchema: ExpenseDetailResponseSchema,
  });
}

export async function fetchMonthlyExpenseDetail(
  publicId: string,
): Promise<{ expense: MonthlyExpenseDetail; status: "ok" }> {
  return apiClient.get(`/api/expenses/${publicId}`, {
    responseSchema: ExpenseDetailResponseSchema,
  });
}

export async function fetchMonthlyExpenses(params?: {
  from?: string;
  serviceId?: null | number;
  status?: string;
  to?: string;
}): Promise<{ expenses: MonthlyExpense[]; status: "ok" }> {
  return apiClient.get("/api/expenses", { query: params, responseSchema: ExpensesResponseSchema });
}

export async function fetchMonthlyExpenseStats(params?: {
  category?: null | string;
  from?: string;
  groupBy?: "day" | "month" | "quarter" | "week" | "year";
  to?: string;
}): Promise<{ stats: MonthlyExpenseStatsRow[]; status: "ok" }> {
  return apiClient.get("/api/expenses/stats", {
    query: params,
    responseSchema: ExpenseStatsResponseSchema,
  });
}

export async function linkMonthlyExpenseTransaction(
  publicId: string,
  payload: LinkMonthlyExpenseTransactionPayload,
) {
  return apiClient.post<{ expense: MonthlyExpenseDetail; status: "ok" }>(
    `/api/expenses/${publicId}/link`,
    payload,
    { responseSchema: ExpenseDetailResponseSchema },
  );
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  return apiClient.post<{ expense: MonthlyExpenseDetail; status: "ok" }>(
    `/api/expenses/${publicId}/unlink`,
    {
      transactionId,
    },
    { responseSchema: ExpenseDetailResponseSchema },
  );
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload) {
  return apiClient.put<{ expense: MonthlyExpenseDetail; status: "ok" }>(
    `/api/expenses/${publicId}`,
    payload,
    { responseSchema: ExpenseDetailResponseSchema },
  );
}
