/**
 * API client for timesheet audit features
 */

import { apiClient } from "@/lib/api-client";

import type { TimesheetEntryWithEmployee } from "./types";

/**
 * Fetch timesheet entries for multiple employees in a date range
 * Only returns entries with start_time and end_time (excludes entries without time tracking)
 */
export async function fetchMultiEmployeeTimesheets(
  employeeIds: number[],
  from: string,
  to: string,
): Promise<TimesheetEntryWithEmployee[]> {
  if (employeeIds.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    employeeIds: employeeIds.join(","),
    from,
    to,
  });

  const response = await apiClient.get<{ entries: TimesheetEntryWithEmployee[] }>(
    `/api/timesheets/multi-detail?${params.toString()}`,
  );

  return response.entries || [];
}
