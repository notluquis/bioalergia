import { getPool } from "../db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * List timesheet entries within a date range, optionally filtered by employee.
 */
export async function listTimesheetEntries(options: ListTimesheetOptions): Promise<TimesheetEntry[]> {
  const pool = getPool();
  const conditions = ["work_date >= ?", "work_date <= ?"];
  const params: Array<string | number> = [options.from, options.to];

  if (options.employee_id) {
    conditions.push("employee_id = ?");
    params.push(options.employee_id);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE ${conditions.join(" AND ")}
     ORDER BY work_date ASC`,
    params
  );

  return rows.map(mapTimesheetRow);
}

/**
 * Get a single timesheet entry by ID.
 */
export async function getTimesheetEntryById(id: number): Promise<TimesheetEntry> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) throw new Error("Timesheet entry not found");
  return mapTimesheetRow(row);
}

/**
 * Get a timesheet entry by employee_id and work_date.
 */
export async function getTimesheetEntryByEmployeeAndDate(
  employeeId: number,
  workDate: string
): Promise<TimesheetEntry | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment, created_at, updated_at
     FROM employee_timesheets
     WHERE employee_id = ? AND work_date = ?
     LIMIT 1`,
    [employeeId, workDate]
  );
  const row = rows[0];
  return row ? mapTimesheetRow(row) : null;
}

/**
 * Upsert (insert or update) a timesheet entry.
 * Automatically calculates worked_minutes from start_time and end_time.
 */
export async function upsertTimesheetEntry(entry: UpsertTimesheetPayload): Promise<TimesheetEntry> {
  const pool = getPool();
  const startTime = entry.start_time ?? null;
  const endTime = entry.end_time ?? null;

  // Calculate worked_minutes from start_time and end_time
  let workedMinutes = 0;
  if (startTime && endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start !== null && end !== null) {
      workedMinutes = end >= start ? end - start : 24 * 60 + (end - start);
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO employee_timesheets
      (employee_id, work_date, start_time, end_time, worked_minutes, overtime_minutes, extra_amount, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       worked_minutes = VALUES(worked_minutes),
       overtime_minutes = VALUES(overtime_minutes),
       extra_amount = VALUES(extra_amount),
       comment = VALUES(comment),
       updated_at = CURRENT_TIMESTAMP`,
    [
      entry.employee_id,
      entry.work_date,
      startTime,
      endTime,
      workedMinutes,
      entry.overtime_minutes,
      entry.extra_amount,
      entry.comment ?? null,
    ]
  );

  const insertedId = result.insertId ? Number(result.insertId) : null;
  if (insertedId) {
    return getTimesheetEntryById(insertedId);
  }

  const existing = await getTimesheetEntryByEmployeeAndDate(entry.employee_id, entry.work_date);
  if (!existing) throw new Error("Failed to upsert timesheet entry");
  return existing;
}

/**
 * Update a timesheet entry by ID.
 */
export async function updateTimesheetEntry(id: number, data: UpdateTimesheetPayload): Promise<TimesheetEntry> {
  const pool = getPool();
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (data.start_time !== undefined) {
    fields.push("start_time = ?");
    params.push(data.start_time ?? null);
  }
  if (data.end_time !== undefined) {
    fields.push("end_time = ?");
    params.push(data.end_time ?? null);
  }
  if (data.worked_minutes != null) {
    fields.push("worked_minutes = ?");
    params.push(data.worked_minutes);
  }
  if (data.overtime_minutes != null) {
    fields.push("overtime_minutes = ?");
    params.push(data.overtime_minutes);
  }
  if (data.extra_amount != null) {
    fields.push("extra_amount = ?");
    params.push(data.extra_amount);
  }
  if (data.comment !== undefined) {
    fields.push("comment = ?");
    params.push(data.comment ?? null);
  }

  if (!fields.length) {
    return getTimesheetEntryById(id);
  }

  params.push(id);
  await pool.query<ResultSetHeader>(`UPDATE employee_timesheets SET ${fields.join(", ")} WHERE id = ?`, params);

  return getTimesheetEntryById(id);
}

/**
 * Delete a timesheet entry by ID.
 */
export async function deleteTimesheetEntry(id: number): Promise<void> {
  const pool = getPool();
  await pool.query<ResultSetHeader>(`DELETE FROM employee_timesheets WHERE id = ?`, [id]);
}

// ============================================================================
// Helper Functions
// ============================================================================

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
 * Map database RowDataPacket to TimesheetEntry type.
 */
function mapTimesheetRow(row: RowDataPacket): TimesheetEntry {
  return {
    id: Number(row.id),
    employee_id: Number(row.employee_id),
    work_date: toDateOnly(row.work_date),
    start_time: row.start_time ? String(row.start_time).slice(0, 5) : null,
    end_time: row.end_time ? String(row.end_time).slice(0, 5) : null,
    worked_minutes: Number(row.worked_minutes ?? 0),
    overtime_minutes: Number(row.overtime_minutes ?? 0),
    extra_amount: Number(row.extra_amount ?? 0),
    comment: row.comment ? String(row.comment) : null,
    created_at: toDateTime(row.created_at),
    updated_at: toDateTime(row.updated_at),
  };
}

/**
 * Format Date/Timestamp to YYYY-MM-DD.
 */
function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return String(value).slice(0, 10);
}

/**
 * Format Date/Timestamp to ISO 8601.
 */
function toDateTime(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  return new Date(String(value)).toISOString();
}
