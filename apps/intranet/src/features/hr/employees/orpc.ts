import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";

type EmployeesORPCClient = {
  create: (
    input: EmployeePayload & { names: string; rut: string },
  ) => Promise<{ employee: Employee }>;
  deactivate: (input: { id: number }) => Promise<{ status: "ok" }>;
  detail: (input: { id: number }) => Promise<{ employee: Employee }>;
  list: (input?: { includeInactive?: boolean }) => Promise<{ employees: Employee[] }>;
  update: (input: {
    id: number;
    payload: EmployeeUpdatePayload;
  }) => Promise<{ employee: Employee }>;
};

const employeesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const employeesORPCClient = createORPCClient<EmployeesORPCClient>(employeesORPCLink, {
  path: ["api", "orpc", "employees", "rpc"],
});

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
