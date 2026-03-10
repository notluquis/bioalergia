/**
 * API client for timesheet audit features
 */

import { z } from "zod";
import { zDateString } from "@/lib/api-validate";
import { timesheetsORPCClient, toTimesheetsApiError } from "../timesheets/orpc";
import type { TimesheetEntryWithEmployee } from "./types";

function normalizeTimesheetEntry(entry: Record<string, unknown>) {
  const workDate = entry.work_date;
  return {
    ...entry,
    work_date:
      workDate instanceof Date ? workDate.toISOString().slice(0, 10) : (workDate as string),
  };
}

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

  let response: { entries: TimesheetEntryWithEmployee[] };
  try {
    const data = await timesheetsORPCClient.multiDetail({
      employeeIds,
      from,
      to,
    });
    response = z
      .object({
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
            work_date: zDateString,
            worked_minutes: z.number(),
          }),
        ),
      })
      .parse({
        entries: data.entries.map((entry) => normalizeTimesheetEntry(entry)),
      });
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  return response.entries || [];
}
