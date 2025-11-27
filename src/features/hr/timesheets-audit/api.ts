/**
 * API client for timesheet audit features
 */

import type { TimesheetEntryWithEmployee } from "./types";

/**
 * Fetch timesheet entries for multiple employees in a date range
 * Only returns entries with start_time and end_time (excludes entries without time tracking)
 */
export async function fetchMultiEmployeeTimesheets(
  employeeIds: number[],
  from: string,
  to: string
): Promise<TimesheetEntryWithEmployee[]> {
  if (employeeIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    from,
    to,
    employeeIds: employeeIds.join(","),
  });

  const response = await fetch(`/api/timesheets/multi-detail?${params}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch timesheets: ${response.statusText}`);
  }

  const data = await response.json();
  return data.entries || [];
}
