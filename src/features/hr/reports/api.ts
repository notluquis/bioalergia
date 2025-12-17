import type { TimesheetEntry } from "../timesheets/types";

export async function fetchMultiMonthTimesheets(employeeIds: number[], startMonth: string, endMonth: string) {
  const params = new URLSearchParams({
    employeeIds: employeeIds.join(","),
    startMonth,
    endMonth,
  });

  const res = await fetch(`/api/timesheets/multi-month?${params.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Error fetching multi-month timesheets");
  }

  const data = await res.json();
  return data as {
    status: "ok";
    data: Record<string, { month: string; entries: TimesheetEntry[] }>;
  };
}

export async function fetchEmployeeTimesheets(employeeId: number, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  const res = await fetch(`/api/timesheets/${employeeId}/range?${params.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Error fetching employee timesheets");
  }

  const data = await res.json();
  return data as {
    status: "ok";
    entries: TimesheetEntry[];
    from: string;
    to: string;
  };
}

export async function fetchGlobalTimesheetRange(startDate: string, endDate: string) {
  const params = new URLSearchParams({
    from: startDate,
    to: endDate,
  });

  const res = await fetch(`/api/timesheets?${params.toString()}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Error fetching global timesheets");
  }

  const data = await res.json();
  return data.entries as TimesheetEntry[];
}
