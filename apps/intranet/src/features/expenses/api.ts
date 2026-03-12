import { z } from "zod";
import { formatISO } from "@/lib/dates";
import { compactORPCInput } from "@/lib/orpc-input";
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
    return (await expensesORPCClient.create({
      ...payload,
      expenseDate: formatISO(payload.expenseDate),
    })) as unknown as { expense: MonthlyExpenseDetail; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchMonthlyExpenseDetail(
  publicId: string
): Promise<{ expense: MonthlyExpenseDetail; status: "ok" }> {
  try {
    return (await expensesORPCClient.detail({ publicId })) as unknown as {
      expense: MonthlyExpenseDetail;
      status: "ok";
    };
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
    const parsed = ExpensesResponseSchema.parse(
      await expensesORPCClient.list(compactORPCInput(params) ?? {})
    );
    return { ...parsed, expenses: (parsed.expenses ?? []) as MonthlyExpense[] };
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
    const parsed = ExpenseStatsResponseSchema.parse(
      await expensesORPCClient.stats(compactORPCInput(params) ?? {})
    );
    return { ...parsed, stats: (parsed.stats ?? []) as MonthlyExpenseStatsRow[] };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function linkMonthlyExpenseTransaction(
  publicId: string,
  payload: LinkMonthlyExpenseTransactionPayload
) {
  try {
    return (await expensesORPCClient.linkTransaction({ publicId, ...payload })) as unknown as {
      status: string;
      message?: string;
    };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  try {
    return (await expensesORPCClient.unlinkTransaction({ publicId, transactionId })) as unknown as {
      status: string;
      message?: string;
    };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload) {
  try {
    return (await expensesORPCClient.update({
      publicId,
      payload: {
        ...payload,
        expenseDate: formatISO(payload.expenseDate),
      },
    })) as unknown as { expense: MonthlyExpenseDetail; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}
