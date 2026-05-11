import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { EmployeesContract } from "@finanzas/orpc-contracts/employees";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const employeesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type EmployeesORPCClient = ContractRouterClient<EmployeesContract>;

export const employeesORPCClient = createORPCClient(employeesORPCLink, {
  path: ["api", "orpc", "employees", "rpc"],
}) as EmployeesORPCClient;

export function toEmployeesApiError(error: unknown): ApiError {
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
