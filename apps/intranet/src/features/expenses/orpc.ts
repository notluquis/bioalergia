import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ExpensesContract } from "@finanzas/orpc-contracts/expenses";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const expensesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type ExpensesORPCClient = ContractRouterClient<ExpensesContract>;

export const expensesORPCClient = createORPCClient(expensesORPCLink, {
  path: ["api", "orpc", "expenses", "rpc"],
}) as ExpensesORPCClient;

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
