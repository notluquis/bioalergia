import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { TimesheetEntry } from "../timesheets/types";

const EmployeeTimesheetsResponseSchema = z.object({
  entries: z.array(z.unknown()),
  from: z.string(),
  message: z.string().optional(),
  status: z.literal("ok"),
  to: z.string(),
});

const GlobalTimesheetsResponseSchema = z.object({
  entries: z.array(z.unknown()),
  message: z.string().optional(),
  status: z.literal("ok"),
});

const MultiMonthTimesheetsResponseSchema = z.object({
  data: z.record(
    z.string(),
    z.object({
      entries: z.array(z.unknown()),
      month: z.string(),
    }),
  ),
  message: z.string().optional(),
  status: z.literal("ok"),
});

export async function fetchEmployeeTimesheets(
  employeeId: number,
  startDate: string,
  endDate: string,
) {
  const data = await apiClient.get<{
    entries: TimesheetEntry[];
    from: string;
    message?: string;
    status: "ok";
    to: string;
  }>(`/api/timesheets/${employeeId}/range`, {
    query: {
      endDate,
      startDate,
    },
    responseSchema: EmployeeTimesheetsResponseSchema,
  });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching employee timesheets");
  }

  return data;
}

export async function fetchGlobalTimesheetRange(startDate: string, endDate: string) {
  const data = await apiClient.get<{
    entries: TimesheetEntry[];
    message?: string;
    status: "ok";
  }>("/api/timesheets", {
    query: {
      from: startDate,
      to: endDate,
    },
    responseSchema: GlobalTimesheetsResponseSchema,
  });

  if (data.status !== "ok") {
    throw new Error(data.message || `Error fetching global timesheets (Status: ${data.status})`);
  }

  return data.entries;
}

export async function fetchMultiMonthTimesheets(
  employeeIds: number[],
  startMonth: string,
  endMonth: string,
) {
  const data = await apiClient.get<{
    data: Record<string, { entries: TimesheetEntry[]; month: string }>;
    message?: string;
    status: "ok";
  }>("/api/timesheets/multi-month", {
    query: {
      employeeIds: employeeIds.join(","),
      endMonth,
      startMonth,
    },
    responseSchema: MultiMonthTimesheetsResponseSchema,
  });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching multi-month timesheets");
  }

  return data;
}
