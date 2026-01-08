import { apiClient } from "@/lib/apiClient";

import type { TimesheetEntry } from "../timesheets/types";

export async function fetchMultiMonthTimesheets(employeeIds: number[], startMonth: string, endMonth: string) {
  const data = await apiClient.get<{
    status: "ok";
    data: Record<string, { month: string; entries: TimesheetEntry[] }>;
    message?: string;
  }>("/api/timesheets/multi-month", {
    query: {
      employeeIds: employeeIds.join(","),
      startMonth,
      endMonth,
    },
  });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching multi-month timesheets");
  }

  return data;
}

export async function fetchEmployeeTimesheets(employeeId: number, startDate: string, endDate: string) {
  const data = await apiClient.get<{
    status: "ok";
    entries: TimesheetEntry[];
    from: string;
    to: string;
    message?: string;
  }>(`/api/timesheets/${employeeId}/range`, {
    query: {
      startDate,
      endDate,
    },
  });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching employee timesheets");
  }

  return data;
}

export async function fetchGlobalTimesheetRange(startDate: string, endDate: string) {
  const data = await apiClient.get<{
    status: "ok";
    entries: TimesheetEntry[];
    message?: string;
  }>("/api/timesheets", {
    query: {
      from: startDate,
      to: endDate,
    },
  });

  if (data.status !== "ok") {
    throw new Error(data.message || `Error fetching global timesheets (Status: ${data.status})`);
  }

  return data.entries;
}
