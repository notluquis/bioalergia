import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { TimesheetEntry } from "../timesheets/types";

const TimesheetEntrySchema = z.looseObject({
  comment: z.string().nullable(),
  created_at: z.coerce.date(),
  employee_id: z.number(),
  end_time: z.string().nullable(),
  extra_amount: z.number(),
  id: z.number(),
  overtime_minutes: z.number(),
  start_time: z.string().nullable(),
  updated_at: z.coerce.date(),
  work_date: z.coerce.date(),
  worked_minutes: z.number(),
});

const EmployeeTimesheetsResponseSchema = z.object({
  entries: z.array(TimesheetEntrySchema),
  from: z.coerce.date(),
  message: z.string().optional(),
  status: z.literal("ok"),
  to: z.coerce.date(),
});

const GlobalTimesheetsResponseSchema = z.object({
  entries: z.array(TimesheetEntrySchema),
  message: z.string().optional(),
  status: z.literal("ok"),
});

const MultiMonthTimesheetsResponseSchema = z.object({
  data: z.record(
    z.string(),
    z.object({
      entries: z.array(TimesheetEntrySchema),
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
