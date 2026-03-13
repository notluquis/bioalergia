import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { UnsafeORPCClient } from "@/lib/orpc-client";

const timesheetsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const timesheetsORPCClient = createORPCClient(timesheetsORPCLink, {
  path: ["api", "orpc", "timesheets", "rpc"],
}) as unknown as UnsafeORPCClient;

export type TimesheetEntryTransport = Record<string, unknown>;
export type TimesheetEntriesTransport = TimesheetEntryTransport[];

export function toTimesheetsApiError(error: unknown): ApiError {
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
