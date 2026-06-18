import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AttendanceContract } from "@finanzas/orpc-contracts/attendance";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type AttendanceORPCClient = ContractRouterClient<AttendanceContract>;

const attendanceORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const attendanceORPCClient = createORPCClient<AttendanceORPCClient>(attendanceORPCLink, {
  path: ["api", "orpc", "attendance", "rpc"],
});

export const toAttendanceApiError = toApiError;
