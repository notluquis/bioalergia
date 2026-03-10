import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type {
  TimesheetEntry,
  TimesheetPayload,
  TimesheetSummaryResponse,
  TimesheetUpsertEntry,
} from "./types";

type TimesheetsORPCClient = {
  bulkUpsert: (input: {
    employee_id: number;
    entries?: TimesheetUpsertEntry[];
    remove_ids?: Array<number | string>;
  }) => Promise<{ inserted?: number; removed?: number; status: "ok" }>;
  create: (input: TimesheetPayload) => Promise<{ entry: TimesheetEntry; status: "ok" }>;
  employeeDetail: (input: {
    employeeId: number;
    month?: string;
  }) => Promise<{ entries: TimesheetEntry[]; from: string; status: "ok"; to: string }>;
  employeeRange: (input: {
    employeeId: number;
    endDate?: string;
    startDate?: string;
  }) => Promise<{ entries: TimesheetEntry[]; from: string; status: "ok"; to: string }>;
  listRange: (input?: { from?: string; to?: string }) => Promise<{
    entries: TimesheetEntry[];
    status: "ok";
  }>;
  months: () => Promise<{ months: string[]; monthsWithData: string[]; status: "ok" }>;
  multiDetail: (input: {
    employeeIds: number[];
    from?: string;
    to?: string;
  }) => Promise<{ entries: Array<Record<string, unknown>> }>;
  multiMonth: (input: {
    employeeIds: number[];
    endMonth?: string;
    startMonth?: string;
  }) => Promise<{
    data: Record<string, { entries: TimesheetEntry[]; month: string }>;
    status: "ok";
  }>;
  prepareEmailPayload: (input: {
    employeeEmail: string;
    employeeId: number;
    employeeName: string;
    month: string;
    monthLabel: string;
    pdfBase64: string;
    summary: Record<string, number | string | undefined>;
  }) => Promise<{
    payload: {
      attachments: Array<{ contentBase64: string; contentType: string; filename: string }>;
      from: string;
      html: string;
      subject: string;
      to: string;
    };
    status: "ok";
  }>;
  salarySummary: (input?: {
    employeeIds?: number[];
    from?: null | string;
    mode?: "auto" | "range";
    to?: null | string;
  }) => Promise<{
    data: Record<
      string,
      Array<{ month: string; net: number; retention: number; subtotal: number }>
    >;
    from: string;
    status: "ok";
    to: string;
  }>;
  summary: (input?: {
    employeeId?: number;
    month?: string;
  }) => Promise<
    TimesheetSummaryResponse & { from: string; month: string; status: "ok"; to: string }
  >;
  remove: (input: { id: number }) => Promise<{ status: "ok" }>;
  update: (input: { id: number; payload: Partial<TimesheetPayload> }) => Promise<{
    entry: TimesheetEntry;
    status: "ok";
  }>;
};

const timesheetsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const timesheetsORPCClient = createORPCClient<TimesheetsORPCClient>(timesheetsORPCLink, {
  path: ["api", "orpc", "timesheets", "rpc"],
});

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
