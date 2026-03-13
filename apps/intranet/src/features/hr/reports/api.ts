import { z } from "zod";
import { zDateString } from "@/lib/api-validate";
import { timesheetsORPCClient, toTimesheetsApiError } from "../timesheets/orpc";
import type { TimesheetEntry } from "../timesheets/types";

const TimesheetEntrySchema = z.looseObject({
  comment: z.string().nullable(),
  employee_id: z.number(),
  end_time: z.string().nullable(),
  id: z.number(),
  overtime_minutes: z.number(),
  start_time: z.string().nullable(),
  work_date: zDateString,
  worked_minutes: z.number(),
});

const EmployeeTimesheetsResponseSchema = z.object({
  entries: z.array(TimesheetEntrySchema),
  from: zDateString,
  message: z.string().optional(),
  status: z.literal("ok"),
  to: zDateString,
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
    })
  ),
  message: z.string().optional(),
  status: z.literal("ok"),
});

const SalarySummarySchema = z.object({
  data: z.record(
    z.string(),
    z.array(
      z.object({
        month: z.string(),
        net: z.number(),
        retention: z.number(),
        subtotal: z.number(),
      })
    )
  ),
  from: zDateString,
  message: z.string().optional(),
  status: z.literal("ok"),
  to: zDateString,
});

function normalizeTimesheetEntry(entry: Record<string, unknown>) {
  const workDate = entry.work_date;
  return {
    ...entry,
    work_date:
      workDate instanceof Date ? workDate.toISOString().slice(0, 10) : (workDate as string),
  };
}

function normalizeTimesheetEntries(entries: Array<Record<string, unknown>>) {
  return entries.map((entry) => normalizeTimesheetEntry(entry));
}

export async function fetchEmployeeTimesheets(
  employeeId: number,
  startDate: string,
  endDate: string
) {
  let data: {
    entries: TimesheetEntry[];
    from: string;
    message?: string;
    status: "ok";
    to: string;
  };
  try {
    const response = await timesheetsORPCClient.employeeRange({
      employeeId,
      endDate,
      startDate,
    });
    data = EmployeeTimesheetsResponseSchema.parse({
      ...response,
      entries: normalizeTimesheetEntries(response.entries),
    });
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching employee timesheets");
  }

  return data;
}

export async function fetchGlobalTimesheetRange(startDate: string, endDate: string) {
  let data: {
    entries: TimesheetEntry[];
    message?: string;
    status: "ok";
  };
  try {
    const response = await timesheetsORPCClient.listRange({
      from: startDate,
      to: endDate,
    });
    data = GlobalTimesheetsResponseSchema.parse({
      ...response,
      entries: normalizeTimesheetEntries(response.entries),
    });
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    const status = data.status as string | undefined;
    throw new Error(data.message || `Error fetching global timesheets (Status: ${status})`);
  }

  return data.entries;
}

export async function fetchMultiMonthTimesheets(
  employeeIds: number[],
  startMonth: string,
  endMonth: string
) {
  let data: {
    data: Record<string, { entries: TimesheetEntry[]; month: string }>;
    message?: string;
    status: "ok";
  };
  try {
    const response = await timesheetsORPCClient.multiMonth({
      employeeIds,
      endMonth,
      startMonth,
    });
    data = MultiMonthTimesheetsResponseSchema.parse({
      ...response,
      data: Object.fromEntries(
        Object.entries(
          response.data as Record<string, { entries: Record<string, unknown>[]; month: string }>
        ).map(([employeeId, value]) => [
          employeeId,
          { ...value, entries: normalizeTimesheetEntries(value.entries) },
        ])
      ),
    });
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching multi-month timesheets");
  }

  return data;
}

export async function fetchSalarySummary(
  startDate: string,
  endDate: string,
  employeeIds: number[]
) {
  let data: {
    data: Record<
      string,
      Array<{ month: string; net: number; retention: number; subtotal: number }>
    >;
    from: string;
    message?: string;
    status: "ok";
    to: string;
  };
  try {
    data = SalarySummarySchema.parse(
      await timesheetsORPCClient.salarySummary({
        employeeIds,
        from: startDate,
        to: endDate,
      })
    );
  } catch (error) {
    throw toTimesheetsApiError(error);
  }

  if (data.status !== "ok") {
    throw new Error(data.message || "Error fetching salary summary");
  }

  return data.data;
}
