import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseStatsRow,
} from "./types";

type ExpensesORPCClient = {
  create: (
    input: Omit<CreateMonthlyExpensePayload, "expenseDate"> & { expenseDate: string },
  ) => Promise<{ message: string; status: "error" }>;
  detail: (input: { publicId: string }) => Promise<{ message: string; status: "error" }>;
  linkTransaction: (input: LinkMonthlyExpenseTransactionPayload & { publicId: string }) => Promise<{
    message: string;
    status: "error";
  }>;
  list: (input?: {
    from?: string;
    serviceId?: null | number;
    status?: string;
    to?: string;
  }) => Promise<{ expenses: MonthlyExpense[]; status: "ok" }>;
  stats: (input?: {
    category?: null | string;
    from?: string;
    groupBy?: "day" | "month" | "quarter" | "week" | "year";
    to?: string;
  }) => Promise<{ stats: MonthlyExpenseStatsRow[]; status: "ok" }>;
  unlinkTransaction: (input: { publicId: string; transactionId: number }) => Promise<{
    message: string;
    status: "error";
  }>;
  update: (input: {
    payload: Omit<CreateMonthlyExpensePayload, "expenseDate"> & { expenseDate: string };
    publicId: string;
  }) => Promise<{ message: string; status: "error" }>;
};

const expensesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const expensesORPCClient = createORPCClient<ExpensesORPCClient>(expensesORPCLink, {
  path: ["api", "orpc", "expenses", "rpc"],
});

export function toExpensesApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
