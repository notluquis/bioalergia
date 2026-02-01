/**
 * API client for timesheet audit features
 */

import { z } from "zod";
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
    {
      responseSchema: z.object({
        entries: z.array(
          z.looseObject({
            comment: z.string().nullable(),
            employee_id: z.number(),
            employee_name: z.string(),
            employee_role: z.string().nullable(),
            end_time: z.string(),
            id: z.number(),
            overtime_minutes: z.number(),
            start_time: z.string(),
            work_date: z.coerce.date(),
            worked_minutes: z.number(),
          }),
        ),
      }),
    },
  );

  return response.entries || [];
}
