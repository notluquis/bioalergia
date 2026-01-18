import { apiClient } from "@/lib/apiClient";

import type { TimesheetEntry } from "../timesheets/types";

export async function fetchEmployeeTimesheets(employeeId: number, startDate: string, endDate: string) {
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
  });

  if (data.status !== "ok") {
    throw new Error(data.message || `Error fetching global timesheets (Status: ${data.status})`);
  }

  return data.entries;
}

export async function fetchMultiMonthTimesheets(employeeIds: number[], startMonth: string, endMonth: string) {
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
  });

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching multi-month timesheets");
  }

  return data;
}
