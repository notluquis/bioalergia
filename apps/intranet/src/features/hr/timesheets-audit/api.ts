/**
 * API client for timesheet audit features
 */

import { z } from "zod";
import { TimesheetEntryWithEmployeeSchema, normalizeTimesheetEntry } from "../timesheets/schemas";
import { timesheetsORPCClient, toTimesheetsApiError } from "../timesheets/orpc";
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

  let response: { entries: TimesheetEntryWithEmployee[] };
  try {
    const data = await timesheetsORPCClient.multiDetail({
      employeeIds,
      from,
      to,
    });
    response = z
      .object({
        entries: z.array(TimesheetEntryWithEmployeeSchema),
      })
      .parse({
        entries: data.entries.map((entry) => normalizeTimesheetEntry(entry)),
      });
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  return response.entries || [];
}
