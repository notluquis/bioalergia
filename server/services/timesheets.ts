import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
import { formatDateOnly, getNthBusinessDay } from "../lib/time.js";
import dayjs from "dayjs";
import { listEmployees, getEmployeeById } from "./employees.js";
import { roundCurrency } from "../../shared/currency.js";

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
 * Uses reference date to set the correct year/month/day
 */
function timeStringToDate(time: string | null, referenceDate: Date = new Date()): Date | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(referenceDate);
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
  const workDateObj = new Date(payload.work_date);
  const startTime = timeStringToDate(payload.start_time ?? null, workDateObj);
  const endTime = timeStringToDate(payload.end_time ?? null, workDateObj);

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
  let workDateObj: Date | undefined;

  // If we are updating times, we should ideally fetch the entry to get the workDate
  // to keep dates consistent.
  if (data.start_time !== undefined || data.end_time !== undefined) {
    const existing = await prisma.employeeTimesheet.findUnique({
      where: { id: BigInt(id) },
      select: { workDate: true },
    });
    if (existing) {
      workDateObj = existing.workDate;
    }
  }

  const updateData: Prisma.EmployeeTimesheetUpdateInput = {};

  if (data.start_time !== undefined) {
    updateData.startTime = timeStringToDate(data.start_time, workDateObj);
  }
  if (data.end_time !== undefined) {
    updateData.endTime = timeStringToDate(data.end_time, workDateObj);
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

// =========================================
// Summary & Reporting Utilities
// =========================================

/**
 * Convert minutes to HH:MM duration string
 */
export function minutesToDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Convert HH:MM string to minutes
 */
export function durationToMinutes(duration: string): number {
  const [h, m] = duration.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Normalize timesheet payload, calculating worked_minutes from start/end if needed
 */
export function normalizeTimesheetPayload(data: {
  employee_id: number;
  work_date: string;
  start_time?: string | null;
  end_time?: string | null;
  worked_minutes?: number;
  overtime_minutes?: number;
  comment?: string | null;
}) {
  let workedMinutes = data.worked_minutes ?? 0;
  const overtimeMinutes = data.overtime_minutes ?? 0;

  if (!workedMinutes && data.start_time && data.end_time) {
    const start = durationToMinutes(data.start_time);
    const end = durationToMinutes(data.end_time);
    workedMinutes = Math.max(end - start, 0);
  }

  return {
    employee_id: data.employee_id,
    work_date: data.work_date,
    start_time: data.start_time ?? null,
    end_time: data.end_time ?? null,
    worked_minutes: workedMinutes,
    overtime_minutes: overtimeMinutes,
    comment: data.comment ?? null,
  };
}

/**
 * Compute pay date based on employee role and period start
 */
export function computePayDate(role: string, periodStart: string): string {
  const startDate = new Date(periodStart);
  const nextMonthFirstDay = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  if (role.toUpperCase().includes("ENFER")) {
    // Enfermeros: 5to día hábil del mes siguiente
    return formatDateOnly(getNthBusinessDay(nextMonthFirstDay, 5));
  }
  // Otros: día 5 calendario del mes siguiente
  return formatDateOnly(new Date(nextMonthFirstDay.getFullYear(), nextMonthFirstDay.getMonth(), 5));
}

/**
 * Build employee summary for a period
 */
export function buildEmployeeSummary(
  employee: Awaited<ReturnType<typeof getEmployeeById>>,
  data: {
    workedMinutes: number;
    overtimeMinutes: number;
    periodStart: string;
  }
) {
  if (!employee) {
    return {
      employeeId: 0,
      fullName: "Unknown",
      role: "",
      email: null,
      workedMinutes: 0,
      overtimeMinutes: 0,
      hourlyRate: 0,
      overtimeRate: 0,
      retentionRate: 0,
      subtotal: 0,
      retention: 0,
      net: 0,
      payDate: "",
      hoursFormatted: "00:00",
      overtimeFormatted: "00:00",
    };
  }

  const hourlyRate = Number(employee.hourlyRate ?? 0);
  const overtimeRate = Number(employee.overtimeRate ?? 0) || hourlyRate * 1.5;
  const retentionRate = Number(employee.retentionRate ?? 0);
  const basePay = roundCurrency((data.workedMinutes / 60) * hourlyRate);
  const overtimePay = roundCurrency((data.overtimeMinutes / 60) * overtimeRate);
  const subtotal = roundCurrency(basePay + overtimePay);
  const retention = roundCurrency(subtotal * retentionRate);
  const net = roundCurrency(subtotal - retention);
  const payDate = computePayDate(employee.position, data.periodStart);

  return {
    employeeId: employee.id,
    fullName: employee.person.names,
    role: employee.position,
    email: employee.person.email ?? null,
    workedMinutes: data.workedMinutes,
    overtimeMinutes: data.overtimeMinutes,
    hourlyRate,
    overtimeRate,
    retentionRate,
    subtotal,
    retention,
    net,
    payDate,
    hoursFormatted: minutesToDuration(data.workedMinutes),
    overtimeFormatted: minutesToDuration(data.overtimeMinutes),
  };
}

/**
 * Build monthly summary for all employees (or a specific one)
 */
export async function buildMonthlySummary(from: string, to: string, employeeId?: number) {
  const employees = await listEmployees();
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

  const summaryData = await prisma.employeeTimesheet.groupBy({
    by: ["employeeId"],
    where: {
      workDate: {
        gte: new Date(from),
        lte: new Date(to),
      },
      ...(employeeId && { employeeId }),
    },
    _sum: {
      workedMinutes: true,
      overtimeMinutes: true,
    },
  });

  const results: Array<ReturnType<typeof buildEmployeeSummary>> = [];
  const totals = {
    workedMinutes: 0,
    overtimeMinutes: 0,
    subtotal: 0,
    retention: 0,
    net: 0,
  };

  for (const row of summaryData) {
    const employee = employeeMap.get(row.employeeId);
    if (!employee) continue;
    const summary = buildEmployeeSummary(employee, {
      workedMinutes: Number(row._sum.workedMinutes ?? 0),
      overtimeMinutes: Number(row._sum.overtimeMinutes ?? 0),
      periodStart: from,
    });
    results.push(summary);
    totals.workedMinutes += summary.workedMinutes;
    totals.overtimeMinutes += summary.overtimeMinutes;
    totals.subtotal += summary.subtotal;
    totals.retention += summary.retention;
    totals.net += summary.net;
  }

  // If filtered by specific employee but no data, include with 0s
  if (employeeId && results.length === 0) {
    const employee = employeeMap.get(employeeId);
    if (employee) {
      const summary = buildEmployeeSummary(employee, {
        workedMinutes: 0,
        overtimeMinutes: 0,
        periodStart: from,
      });
      results.push(summary);
    }
  }

  results.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    employees: results,
    totals: {
      hours: minutesToDuration(totals.workedMinutes),
      overtime: minutesToDuration(totals.overtimeMinutes),
      subtotal: roundCurrency(totals.subtotal),
      retention: roundCurrency(totals.retention),
      net: roundCurrency(totals.net),
    },
  };
}
