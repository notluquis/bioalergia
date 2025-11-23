import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client";
import { formatDateOnly } from "../lib/time.js";

// Types
export interface TimesheetEntry {
  id: number;
  employee_id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  extra_amount: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertTimesheetPayload {
  employee_id: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  overtime_minutes: number;
  extra_amount: number;
  comment?: string | null;
}

export interface UpdateTimesheetPayload {
  start_time?: string | null;
  end_time?: string | null;
  worked_minutes?: number;
  overtime_minutes?: number;
  extra_amount?: number;
  comment?: string | null;
}

export interface ListTimesheetOptions {
  employee_id?: number;
  from: string;
  to: string;
}

// Helper Functions

/**
 * Convert time string (HH:MM or HH:MM:SS) to minutes since midnight.
 */
function timeToMinutes(time: string): number | null {
  if (!/^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/.test(time)) return null;
  const parts = time.split(":").map(Number);
  const [hours, minutes] = parts;
  if (hours === undefined || minutes === undefined) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes >= 60) return null;
  return hours * 60 + minutes;
}

/**
 * Format time for database (Prisma expects Time as string in HH:MM:SS format)
 */
function formatTimeForDb(time: string | null): string | null {
  if (!time) return null;
  // If already in HH:MM:SS format, return as is
  if (/^[0-9]{1,2}:[0-9]{2}:[0-9]{2}$/.test(time)) return time;
  // If in HH:MM format, add :00
  if (/^[0-9]{1,2}:[0-9]{2}$/.test(time)) return `${time}:00`;
  return null;
}

/**
 * Format time from database (strip seconds for display)
 */
function formatTimeFromDb(time: unknown): string | null {
  if (!time) return null;
  const str = String(time);
  // Return HH:MM format
  return str.slice(0, 5);
}

/**
 * Map Prisma timesheet to TimesheetEntry type.
 */
function mapTimesheetEntry(entry: Prisma.EmployeeTimesheetGetPayload<{}>): TimesheetEntry {
  return {
    id: Number(entry.id),
    employee_id: entry.employeeId,
    work_date: formatDateOnly(entry.workDate),
    start_time: formatTimeFromDb(entry.startTime),
    end_time: formatTimeFromDb(entry.endTime),
    worked_minutes: entry.workedMinutes,
    overtime_minutes: entry.overtimeMinutes,
    extra_amount: Number(entry.extraAmount),
    comment: entry.comment,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
  };
}

// Repository Functions

/**
 * List timesheet entries within a date range, optionally filtered by employee.
 */
export async function listTimesheetEntries(options: ListTimesheetOptions): Promise<TimesheetEntry[]> {
  const where: Prisma.EmployeeTimesheetWhereInput = {
    workDate: {
      gte: new Date(options.from),
      lte: new Date(options.to),
    },
  };

  if (options.employee_id) {
    where.employeeId = options.employee_id;
  }

  const entries = await prisma.employeeTimesheet.findMany({
    where,
    orderBy: { workDate: "asc" },
  });

  return entries.map(mapTimesheetEntry);
}

/**
 * Get a single timesheet entry by ID.
 */
export async function getTimesheetEntryById(id: number): Promise<TimesheetEntry> {
  const entry = await prisma.employeeTimesheet.findUnique({
    where: { id: BigInt(id) },
  });

  if (!entry) throw new Error("Timesheet entry not found");
  return mapTimesheetEntry(entry);
}

/**
 * Get a timesheet entry by employee_id and work_date.
 */
export async function getTimesheetEntryByEmployeeAndDate(
  employeeId: number,
  workDate: string
): Promise<TimesheetEntry | null> {
  const entry = await prisma.employeeTimesheet.findUnique({
    where: {
      employeeId_workDate: {
        employeeId,
        workDate: new Date(workDate),
      },
    },
  });

  return entry ? mapTimesheetEntry(entry) : null;
}

/**
 * Upsert (insert or update) a timesheet entry.
 * Automatically calculates worked_minutes from start_time and end_time.
 */
export async function upsertTimesheetEntry(payload: UpsertTimesheetPayload): Promise<TimesheetEntry> {
  const startTime = formatTimeForDb(payload.start_time ?? null);
  const endTime = formatTimeForDb(payload.end_time ?? null);

  // Calculate worked_minutes from start_time and end_time
  let workedMinutes = 0;
  if (payload.start_time && payload.end_time) {
    const start = timeToMinutes(payload.start_time);
    const end = timeToMinutes(payload.end_time);
    if (start !== null && end !== null) {
      workedMinutes = end >= start ? end - start : 24 * 60 + (end - start);
    }
  }

  const entry = await prisma.employeeTimesheet.upsert({
    where: {
      employeeId_workDate: {
        employeeId: payload.employee_id,
        workDate: new Date(payload.work_date),
      },
    },
    create: {
      employeeId: payload.employee_id,
      workDate: new Date(payload.work_date),
      startTime,
      endTime,
      workedMinutes,
      overtimeMinutes: payload.overtime_minutes,
      extraAmount: payload.extra_amount,
      comment: payload.comment ?? null,
    },
    update: {
      startTime,
      endTime,
      workedMinutes,
      overtimeMinutes: payload.overtime_minutes,
      extraAmount: payload.extra_amount,
      comment: payload.comment ?? null,
    },
  });

  return mapTimesheetEntry(entry);
}

/**
 * Update a timesheet entry by ID.
 */
export async function updateTimesheetEntry(id: number, data: UpdateTimesheetPayload): Promise<TimesheetEntry> {
  const updateData: Prisma.EmployeeTimesheetUpdateInput = {};

  if (data.start_time !== undefined) {
    updateData.startTime = formatTimeForDb(data.start_time);
  }
  if (data.end_time !== undefined) {
    updateData.endTime = formatTimeForDb(data.end_time);
  }
  if (data.worked_minutes != null) {
    updateData.workedMinutes = data.worked_minutes;
  }
  if (data.overtime_minutes != null) {
    updateData.overtimeMinutes = data.overtime_minutes;
  }
  if (data.extra_amount != null) {
    updateData.extraAmount = data.extra_amount;
  }
  if (data.comment !== undefined) {
    updateData.comment = data.comment;
  }

  // If no fields to update, just return the current entry
  if (Object.keys(updateData).length === 0) {
    return getTimesheetEntryById(id);
  }

  const entry = await prisma.employeeTimesheet.update({
    where: { id: BigInt(id) },
    data: updateData,
  });

  return mapTimesheetEntry(entry);
}

/**
 * Delete a timesheet entry by ID.
 */
export async function deleteTimesheetEntry(id: number): Promise<void> {
  await prisma.employeeTimesheet.delete({
    where: { id: BigInt(id) },
  });
}
