/**
 * Shared zod response schema + normalizer for timesheet entries.
 *
 * These validate API responses (see feedback_intranet_local_response_schemas):
 * the shape mirrors the server contract; this module only dedupes the three
 * copies that previously lived in timesheets/api.ts, reports/api.ts and
 * timesheets-audit/api.ts. Do not change the shape — only reuse.
 */

import { z } from "zod";
import { zDateString } from "@/lib/api-validate";

/**
 * Base timesheet entry as returned by the API. `work_date` arrives as a
 * `YYYY-MM-DD` string (superjson may also surface it as a Date — see
 * normalizeTimesheetEntry). Used by the timesheets + reports features.
 */
export const TimesheetEntrySchema = z.looseObject({
  comment: z.string().nullable(),
  employee_id: z.number(),
  end_time: z.string().nullable(),
  id: z.number(),
  overtime_minutes: z.number(),
  start_time: z.string().nullable(),
  work_date: zDateString,
  worked_minutes: z.number(),
});

/**
 * Audit variant: every entry carries the employee identity and guarantees
 * non-null start/end times (the audit endpoint excludes entries without time
 * tracking). Extends the base shape so the extra columns are never dropped.
 */
export const TimesheetEntryWithEmployeeSchema = TimesheetEntrySchema.extend({
  employee_name: z.string(),
  employee_role: z.string().nullable(),
  end_time: z.string(),
  start_time: z.string(),
});

/**
 * Normalize a timesheet entry's `work_date` to a `YYYY-MM-DD` string. Generic
 * so it preserves any extra fields (e.g. employee_name on the audit variant)
 * instead of narrowing to the base shape.
 */
export function normalizeTimesheetEntry<T extends { work_date: Date | string }>(
  entry: T
): T & { work_date: string } {
  const workDate = entry.work_date;
  // `T & { work_date: string }` (no `Omit`): narrowing only `work_date` keeps the
  // element's explicit fields intact. `Omit<T,…>` over a loose/index-signature
  // schema collapses the named fields to `unknown` and breaks the downstream
  // `as TimesheetEntry` cast. The return cast covers the generic-spread limitation.
  return {
    ...entry,
    work_date:
      workDate instanceof Date ? workDate.toISOString().slice(0, 10) : (workDate as string),
  } as T & { work_date: string };
}

/**
 * Map normalizeTimesheetEntry over a list, preserving the element shape.
 */
export function normalizeTimesheetEntries<T extends { work_date: Date | string }>(entries: T[]) {
  return entries.map((entry) => normalizeTimesheetEntry(entry));
}
