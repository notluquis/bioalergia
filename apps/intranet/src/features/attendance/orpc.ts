import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AttendanceContract } from "@finanzas/orpc-contracts/attendance";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type AttendanceORPCClient = ContractRouterClient<AttendanceContract>;

const attendanceORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const attendanceORPCClient = createORPCClient<AttendanceORPCClient>(attendanceORPCLink, {
  path: ["api", "orpc", "attendance", "rpc"],
});

export function toAttendanceApiError(error: unknown): ApiError {
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
