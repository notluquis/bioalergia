import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { TimesheetsORPCRouter } from "../../../../../api/src/orpc/timesheets";

export type TimesheetsORPCClient = RouterClient<TimesheetsORPCRouter>;

const timesheetsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const timesheetsORPCClient = createORPCClient<TimesheetsORPCClient>(timesheetsORPCLink, {
  path: ["api", "orpc", "timesheets", "rpc"],
});

export type TimesheetEntryTransport = Awaited<ReturnType<TimesheetsORPCClient["create"]>>["entry"];
export type TimesheetEntriesTransport = Awaited<
  ReturnType<TimesheetsORPCClient["employeeDetail"]>
>["entries"];

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
