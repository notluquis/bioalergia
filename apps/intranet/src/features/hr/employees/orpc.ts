import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { EmployeesContract } from "@finanzas/orpc-contracts/employees";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const employeesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type EmployeesORPCClient = ContractRouterClient<EmployeesContract>;

export const employeesORPCClient = createORPCClient(employeesORPCLink, {
  path: ["api", "orpc", "employees", "rpc"],
}) as EmployeesORPCClient;

export const toEmployeesApiError = toApiError;
