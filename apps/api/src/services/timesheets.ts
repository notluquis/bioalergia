import { db, kysely } from "@finanzas/db";

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

import { roundCurrency } from "../lib/currency";
import type { EmployeeTimesheet, EmployeeTimesheetUpdateInput } from "../lib/db-types";
import { logEvent, logWarn } from "../lib/logger";
import { getEffectiveRetentionRate } from "../lib/retention";
import { formatDateOnly, getNthBusinessDay } from "../lib/time";
import { getEmployeeById, listEmployees } from "./employees";

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
  if (!time) return null;
  const d = dayjs(time);
  if (d.isValid() && (time.includes("T") || time.includes("-"))) {
    return d.hour() * 60 + d.minute();
  }
  if (!/^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/.test(time)) return null;
  const parts = time.split(":").map(Number);
  const [hours, minutes] = parts;
  if (hours === undefined || minutes === undefined) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes >= 60) return null;
  return hours * 60 + minutes;
}

/**
 * Normalize time string to HH:MM:SS format for PostgreSQL TIME columns
 * Input can be:
 * - HH:MM or HH:MM:SS (e.g., "09:00", "09:00:00")
 * - ISO 8601 timestamp (e.g., "2025-12-02T12:40:00.000Z")
 * For ISO timestamps, converts to America/Santiago timezone and extracts time
 */
function normalizeTimeString(time: string): string | null {
  if (!time) return null;

  // Check if it's an ISO timestamp (contains 'T' or '-')
  const d = dayjs(time);
  if (d.isValid() && (time.includes("T") || time.includes("-"))) {
    // Parse as ISO timestamp and convert to Santiago timezone
    const santiago = d.tz(TIMEZONE);
    const h = santiago.hour();
    const m = santiago.minute();
    const s = santiago.second();
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Match HH:MM or HH:MM:SS format
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, hours, minutes, seconds = "00"] = match;
  // biome-ignore lint/style/noNonNullAssertion: regex match guarantee
  const h = parseInt(hours!, 10);
  // biome-ignore lint/style/noNonNullAssertion: regex match guarantee
  const m = parseInt(minutes!, 10);
  const s = parseInt(seconds, 10);

  // Validate ranges
  if (h < 0 || h > 23 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;

  // Return as HH:MM:SS
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Convert "HH:MM" or ISO string to Date object for ZenStack @db.Time
 * Uses reference date (work_date) and America/Santiago timezone
 * ZenStack/Prisma extracts only TIME component for PostgreSQL TIME columns
 */
function timeStringToDate(
  time: string | null | undefined,
  referenceDate: Date = new Date(),
): Date | null {
  if (!time) return null;

  // Format reference date as YYYY-MM-DD in Santiago timezone
  const refDateStr = dayjs(referenceDate).tz(TIMEZONE).format("YYYY-MM-DD");

  // Try parsing as ISO datetime first
  const d = dayjs(time);
  if (d.isValid() && (time.includes("T") || time.includes("-"))) {
    // Build datetime string in Santiago timezone: "YYYY-MM-DD HH:mm:ss"
    const timeStr = `${d.hour().toString().padStart(2, "0")}:${d.minute().toString().padStart(2, "0")}:${d.second().toString().padStart(2, "0")}`;
    return dayjs.tz(`${refDateStr} ${timeStr}`, TIMEZONE).toDate();
  }

  // Parse HH:MM or HH:MM:SS format
  if (/^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/.test(time)) {
    const parts = time.split(":").map(Number);
    const [hours, minutes, seconds = 0] = parts;
    if (
      hours === undefined ||
      minutes === undefined ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes >= 60 ||
      seconds < 0 ||
      seconds >= 60
    ) {
      return null;
    }
    // Build datetime string in Santiago timezone: "YYYY-MM-DD HH:mm:ss"
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    return dayjs.tz(`${refDateStr} ${timeStr}`, TIMEZONE).toDate();
  }

  return null;
}

/**
 * Format Date object from ZenStack to "HH:MM" string for API responses
 */
function dateToTimeString(date: Date | string | null): string | null {
  if (!date) return null;

  // If it's already a string in HH:MM or HH:MM:SS format, extract just HH:MM
  if (typeof date === "string") {
    const match = date.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const [, hours, minutes] = match;
      // biome-ignore lint/style/noNonNullAssertion: regex match guarantee
      return `${hours!.padStart(2, "0")}:${minutes}`;
    }
    // Try parsing as date/time
    const d = dayjs(date);
    if (d.isValid()) {
      return d.format("HH:mm");
    }
    return null;
  }

  const d = dayjs(date);
  if (!d.isValid()) return null;
  return d.format("HH:mm");
}

/**
 * Map timesheet to TimesheetEntry type.
 */
function mapTimesheetEntry(entry: EmployeeTimesheet): TimesheetEntry {
  if (!entry) throw new Error("Entry is null");
  return {
    id: Number(entry.id),
    employee_id: entry.employeeId,
    work_date: formatDateOnly(entry.workDate),
    start_time: entry.startTime ? dateToTimeString(entry.startTime) : "",
    end_time: entry.endTime ? dateToTimeString(entry.endTime) : "",
    worked_minutes: entry.workedMinutes,
    overtime_minutes: entry.overtimeMinutes,
    comment: entry.comment || "",
  };
}

// Repository Functions

export async function getTimesheetEntryById(id: number): Promise<TimesheetEntry> {
  const entry = await db.employeeTimesheet.findUnique({
    where: { id: BigInt(id) },
  });
  if (!entry) throw new Error("Registro no encontrado");
  return mapTimesheetEntry(entry);
}

/**
 * Ensure FIXED salary employee has a monthly timesheet record
 * Creates one if it doesn't exist (lazy creation)
 */
export async function ensureFixedSalaryRecord(
  employeeId: number,
  month: string, // Format: YYYY-MM
): Promise<void> {
  const employee = await getEmployeeById(employeeId);
  if (!employee || employee.salaryType !== "FIXED") {
    return; // Only for FIXED employees
  }

  const firstDayOfMonth = `${month}-01`;
  const monthStart = new Date(`${month}-01`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  // Check if record already exists for this month
  const existing = await db.employeeTimesheet.findFirst({
    where: {
      employeeId,
      workDate: {
        gte: monthStart,
        lt: monthEnd,
      },
    },
  });

  if (existing) {
    return; // Already has a record this month
  }

  // Create synthetic record for FIXED salary
  await db.employeeTimesheet.create({
    data: {
      employeeId,
      workDate: new Date(firstDayOfMonth),
      startTime: null,
      endTime: null,
      workedMinutes: 0,
      overtimeMinutes: 0,
      comment: "Sueldo fijo mensual",
    },
  });

  logEvent("timesheet:fixed-salary-created", {
    employeeId,
    month,
  });
}

export async function listTimesheetEntries(
  options: ListTimesheetOptions,
): Promise<TimesheetEntry[]> {
  // For FIXED employees, ensure they have a monthly record
  if (options.employee_id) {
    try {
      const monthStr = options.from.substring(0, 7); // Extract YYYY-MM
      await ensureFixedSalaryRecord(options.employee_id, monthStr);
    } catch (error) {
      logWarn("Failed to ensure FIXED salary record", { error });
    }
  }

  const entries = await db.employeeTimesheet.findMany({
    where: {
      ...(options.employee_id && { employeeId: options.employee_id }),
      workDate: {
        gte: new Date(options.from),
        lte: new Date(options.to),
      },
    },
    orderBy: { workDate: "asc" },
  });

  return entries.map(mapTimesheetEntry);
}

export async function upsertTimesheetEntry(
  payload: UpsertTimesheetPayload,
): Promise<TimesheetEntry> {
  const workDateObj = new Date(payload.work_date);

  // Convert time strings directly to HH:MM:SS format for PostgreSQL TIME columns
  // No timezone conversion - keep as-is from user input
  const startTimeStr = payload.start_time ? normalizeTimeString(payload.start_time) : null;
  const endTimeStr = payload.end_time ? normalizeTimeString(payload.end_time) : null;

  console.log("[timesheets] upsert input:", {
    payload_start: payload.start_time,
    payload_end: payload.end_time,
    normalized_start: startTimeStr,
    normalized_end: endTimeStr,
  });

  // Calculate worked_minutes from start_time and end_time if not provided
  let workedMinutes = payload.worked_minutes ?? 0;
  if (!workedMinutes && payload.start_time && payload.end_time) {
    const start = timeToMinutes(payload.start_time);
    const end = timeToMinutes(payload.end_time);
    if (start !== null && end !== null) {
      workedMinutes = end >= start ? end - start : 24 * 60 + (end - start);
    }
  }

  try {
    // Use raw Kysely to avoid ZenStack Date type issues with TIME columns
    // ZenStack types expect Date but PostgreSQL TIME needs string format
    const result = await kysely
      .insertInto("employee_timesheets")
      .values({
        employee_id: payload.employee_id,
        work_date: workDateObj,
        start_time: startTimeStr,
        end_time: endTimeStr,
        worked_minutes: workedMinutes,
        overtime_minutes: payload.overtime_minutes,
        comment: payload.comment ?? null,
      })
      .onConflict((oc) =>
        oc.columns(["employee_id", "work_date"]).doUpdateSet({
          start_time: startTimeStr,
          end_time: endTimeStr,
          worked_minutes: workedMinutes,
          overtime_minutes: payload.overtime_minutes,
          comment: payload.comment ?? null,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    console.log("[timesheets] upsert result from DB:", {
      id: result.id,
      start_time: result.start_time,
      end_time: result.end_time,
      start_type: typeof result.start_time,
      end_type: typeof result.end_time,
    });

    return {
      id: Number(result.id),
      employee_id: result.employee_id,
      work_date: formatDateOnly(new Date(result.work_date as Date)),
      start_time: result.start_time as string | null,
      end_time: result.end_time as string | null,
      worked_minutes: result.worked_minutes,
      overtime_minutes: result.overtime_minutes,
      comment: result.comment,
    };
    // biome-ignore lint/suspicious/noExplicitAny: error handling
  } catch (error: any) {
    console.error("[timesheets] upsert error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      payload: {
        ...payload,
        startTimeStr,
        endTimeStr,
        workDateType: typeof workDateObj,
      },
    });
    throw error;
  }
}

export async function updateTimesheetEntry(
  id: number,
  data: UpdateTimesheetPayload,
): Promise<TimesheetEntry> {
  const updateData: EmployeeTimesheetUpdateInput = {};

  // Get existing entry to use work_date as reference for time conversion
  const existing = await db.employeeTimesheet.findUnique({
    where: { id: BigInt(id) },
  });
  if (!existing) throw new Error("Registro no encontrado");

  const referenceDate = existing.workDate;

  if (data.start_time !== undefined) {
    updateData.startTime = timeStringToDate(data.start_time, referenceDate);
  }
  if (data.end_time !== undefined) {
    updateData.endTime = timeStringToDate(data.end_time, referenceDate);
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

  try {
    const entry = await db.employeeTimesheet.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return mapTimesheetEntry(entry);
    // biome-ignore lint/suspicious/noExplicitAny: error handling
  } catch (error: any) {
    console.error("[timesheets] update error details:", {
      id,
      message: error.message,
      code: error.code,
      meta: error.meta,
      updateData,
    });
    throw error;
  }
}

export async function deleteTimesheetEntry(id: number): Promise<void> {
  await db.employeeTimesheet.delete({
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
    const start = timeToMinutes(data.start_time);
    const end = timeToMinutes(data.end_time);
    if (start !== null && end !== null) {
      workedMinutes = Math.max(end - start, 0);
    }
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

  const roleUpper = role.toUpperCase();

  // Técnico en Enfermería Nivel Superior: día 5 calendario del mes siguiente
  if (
    roleUpper.includes("TÉCNICO EN ENFERMERÍA NIVEL SUPERIOR") ||
    roleUpper.includes("TECNICO EN ENFERMERIA NIVEL SUPERIOR")
  ) {
    return formatDateOnly(
      new Date(nextMonthFirstDay.getFullYear(), nextMonthFirstDay.getMonth(), 5),
    );
  }

  // Enfermero Universitario: 5to día hábil del mes siguiente
  if (
    roleUpper.includes("ENFERMERO UNIVERSITARIO") ||
    roleUpper.includes("ENFERMERA UNIVERSITARIA")
  ) {
    return formatDateOnly(getNthBusinessDay(nextMonthFirstDay, 5));
  }

  // Fallback para otros roles con "ENFER": 5to día hábil
  if (roleUpper.includes("ENFER")) {
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
  },
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

  // Get year from period start (format: YYYY-MM-DD)
  const periodYear = parseInt(data.periodStart.split("-")[0], 10);
  const retentionRate = getEffectiveRetentionRate(Number(employee.retentionRate ?? 0), periodYear);
  const payDate = computePayDate(employee.position, data.periodStart);

  // Handle FIXED salary employees differently
  if (employee.salaryType === "FIXED") {
    const fixedSalary = Number(employee.baseSalary ?? 0);
    const subtotal = roundCurrency(fixedSalary);
    const retention = roundCurrency(subtotal * retentionRate);
    const net = roundCurrency(subtotal - retention);

    return {
      employeeId: employee.id,
      fullName: employee.person.names,
      role: employee.position,
      email: employee.person.email ?? null,
      workedMinutes: 0,
      overtimeMinutes: 0,
      hourlyRate: 0,
      overtimeRate: 0,
      retentionRate,
      subtotal,
      retention,
      net,
      payDate,
      hoursFormatted: "Sueldo fijo",
      overtimeFormatted: "-",
    };
  }

  // Handle HOURLY employees (existing logic)
  const hourlyRate = Number(employee.hourlyRate ?? 0);
  const overtimeRate = Number(employee.overtimeRate ?? 0) || hourlyRate * 1.5;

  const basePay = roundCurrency((data.workedMinutes / 60) * hourlyRate);
  const overtimePay = roundCurrency((data.overtimeMinutes / 60) * overtimeRate);
  const subtotal = roundCurrency(basePay + overtimePay);
  const retention = roundCurrency(subtotal * retentionRate);
  const net = roundCurrency(subtotal - retention);

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy builder
export async function buildMonthlySummary(from: string, to: string, employeeId?: number) {
  const employees = await listEmployees();
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

  const summaryData = await db.employeeTimesheet.groupBy({
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

  // Track which employees have timesheets
  const employeesWithTimesheets = new Set<number>();

  for (const row of summaryData) {
    const employee = employeeMap.get(row.employeeId);
    if (!employee) continue;
    employeesWithTimesheets.add(row.employeeId);
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

  // Include FIXED salary employees without timesheets
  for (const employee of employees) {
    // Skip if already processed or not active
    if (employeesWithTimesheets.has(employee.id) || employee.status !== "ACTIVE") {
      continue;
    }
    // Skip if filtering by specific employee and this isn't it
    if (employeeId && employee.id !== employeeId) {
      continue;
    }
    // Only include FIXED salary employees without timesheets
    if (employee.salaryType === "FIXED") {
      const summary = buildEmployeeSummary(employee, {
        workedMinutes: 0,
        overtimeMinutes: 0,
        periodStart: from,
      });
      results.push(summary);
      totals.subtotal += summary.subtotal;
      totals.retention += summary.retention;
      totals.net += summary.net;
    }
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
