import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import { formatDateOnly } from "../lib/time.js";
import dayjs from "dayjs";

// Types
export interface TimesheetEntry {
  id: number;
  employee_id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  comment: string | null;
}

export interface UpsertTimesheetPayload {
  employee_id: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  worked_minutes?: number;
  overtime_minutes: number;
  comment?: string | null;
}

export interface UpdateTimesheetPayload {
  start_time?: string | null;
  end_time?: string | null;
  worked_minutes?: number;
  overtime_minutes?: number;
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
 * Convert "HH:MM" string to Date object for Prisma @db.Time
 */
function timeStringToDate(time: string | null): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

/**
 * Format Date object from Prisma to "HH:MM" string
 */
function dateToTimeString(date: Date | null): string | null {
  if (!date) return null;
  return dayjs(date).format("HH:mm");
}

/**
 * Map Prisma timesheet to TimesheetEntry type.
 */
function mapTimesheetEntry(entry: Prisma.EmployeeTimesheetGetPayload<{}>): TimesheetEntry {
  return {
    id: Number(entry.id),
    employee_id: entry.employeeId,
    work_date: formatDateOnly(entry.workDate),
    start_time: dateToTimeString(entry.startTime),
    end_time: dateToTimeString(entry.endTime),
    worked_minutes: entry.workedMinutes,
    overtime_minutes: entry.overtimeMinutes,
    comment: entry.comment,
  };
}

// Repository Functions

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

export async function getTimesheetEntryById(id: number): Promise<TimesheetEntry> {
  const entry = await prisma.employeeTimesheet.findUnique({
    where: { id: BigInt(id) },
  });

  if (!entry) throw new Error("Timesheet entry not found");
  return mapTimesheetEntry(entry);
}

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

export async function upsertTimesheetEntry(payload: UpsertTimesheetPayload): Promise<TimesheetEntry> {
  const startTime = timeStringToDate(payload.start_time ?? null);
  const endTime = timeStringToDate(payload.end_time ?? null);

  // Calculate worked_minutes from start_time and end_time if not provided
  let workedMinutes = payload.worked_minutes ?? 0;
  if (!workedMinutes && payload.start_time && payload.end_time) {
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
      comment: payload.comment ?? null,
    },
    update: {
      startTime,
      endTime,
      workedMinutes,
      overtimeMinutes: payload.overtime_minutes,
      comment: payload.comment ?? null,
    },
  });

  return mapTimesheetEntry(entry);
}

export async function updateTimesheetEntry(id: number, data: UpdateTimesheetPayload): Promise<TimesheetEntry> {
  const updateData: Prisma.EmployeeTimesheetUpdateInput = {};

  if (data.start_time !== undefined) {
    updateData.startTime = timeStringToDate(data.start_time);
  }
  if (data.end_time !== undefined) {
    updateData.endTime = timeStringToDate(data.end_time);
  }
  if (data.worked_minutes != null) {
    updateData.workedMinutes = data.worked_minutes;
  }
  if (data.overtime_minutes != null) {
    updateData.overtimeMinutes = data.overtime_minutes;
  }
  if (data.comment !== undefined) {
    updateData.comment = data.comment;
  }

  if (Object.keys(updateData).length === 0) {
    return getTimesheetEntryById(id);
  }

  const entry = await prisma.employeeTimesheet.update({
    where: { id: BigInt(id) },
    data: updateData,
  });

  return mapTimesheetEntry(entry);
}

export async function deleteTimesheetEntry(id: number): Promise<void> {
  await prisma.employeeTimesheet.delete({
    where: { id: BigInt(id) },
  });
}
