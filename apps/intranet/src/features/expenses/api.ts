import { z } from "zod";
import { ApiError } from "@/lib/api-client";
import { formatISO } from "@/lib/dates";
import { expensesORPCClient, toExpensesApiError } from "./orpc";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
  MonthlyExpenseStatsRow,
} from "./types";

const ExpensesResponseSchema = z.object({
  expenses: z.array(z.unknown()),
  status: z.literal("ok"),
});

const ExpenseStatsResponseSchema = z.object({
  stats: z.array(z.unknown()),
  status: z.literal("ok"),
});

export async function createMonthlyExpense(payload: CreateMonthlyExpensePayload) {
  try {
    const response = await expensesORPCClient.create({
      ...payload,
      expenseDate: formatISO(payload.expenseDate),
    });
    throw new ApiError(response.message, 501);
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchMonthlyExpenseDetail(
  publicId: string,
): Promise<{ expense: MonthlyExpenseDetail; status: "ok" }> {
  try {
    const response = await expensesORPCClient.detail({ publicId });
    throw new ApiError(response.message, 501);
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchMonthlyExpenses(params?: {
  from?: string;
  serviceId?: null | number;
  status?: string;
  to?: string;
}): Promise<{ expenses: MonthlyExpense[]; status: "ok" }> {
  try {
    return ExpensesResponseSchema.parse(await expensesORPCClient.list(params));
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchMonthlyExpenseStats(params?: {
  category?: null | string;
  from?: string;
  groupBy?: "day" | "month" | "quarter" | "week" | "year";
  to?: string;
}): Promise<{ stats: MonthlyExpenseStatsRow[]; status: "ok" }> {
  try {
    return ExpenseStatsResponseSchema.parse(await expensesORPCClient.stats(params));
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function linkMonthlyExpenseTransaction(
  publicId: string,
  payload: LinkMonthlyExpenseTransactionPayload,
) {
  try {
    const response = await expensesORPCClient.linkTransaction({ publicId, ...payload });
    throw new ApiError(response.message, 501);
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  try {
    const response = await expensesORPCClient.unlinkTransaction({ publicId, transactionId });
    throw new ApiError(response.message, 501);
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload) {
  try {
    const response = await expensesORPCClient.update({
      publicId,
      payload: {
        ...payload,
        expenseDate: formatISO(payload.expenseDate),
      },
    });
    throw new ApiError(response.message, 501);
  } catch (error) {
    throw toExpensesApiError(error);
  }
}
