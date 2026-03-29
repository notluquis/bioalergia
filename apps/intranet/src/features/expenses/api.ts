import { formatISO } from "@/lib/dates";
import { compactORPCInput } from "@/lib/orpc-input";
import { expensesORPCClient, toExpensesApiError } from "./orpc";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseStatsRow,
} from "./types";

export async function createMonthlyExpense(payload: CreateMonthlyExpensePayload) {
  try {
    return await expensesORPCClient.create({
      ...payload,
      expenseDate: formatISO(payload.expenseDate),
    });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchMonthlyExpenseDetail(publicId: string) {
  try {
    return await expensesORPCClient.detail({ publicId });
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
    const result = await expensesORPCClient.list(compactORPCInput(params) ?? {});
    return { expenses: result.expenses as MonthlyExpense[], status: "ok" };
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
    const result = await expensesORPCClient.stats(compactORPCInput(params) ?? {});
    return { stats: result.stats as MonthlyExpenseStatsRow[], status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function linkMonthlyExpenseTransaction(
  publicId: string,
  payload: LinkMonthlyExpenseTransactionPayload
) {
  try {
    return await expensesORPCClient.linkTransaction({ publicId, ...payload });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function unlinkMonthlyExpenseTransaction(publicId: string, transactionId: number) {
  try {
    return await expensesORPCClient.unlinkTransaction({ publicId, transactionId });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function updateMonthlyExpense(publicId: string, payload: CreateMonthlyExpensePayload) {
  try {
    return await expensesORPCClient.update({
      publicId,
      payload: {
        ...payload,
        expenseDate: formatISO(payload.expenseDate),
      },
    });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}
