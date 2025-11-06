/**
 * Types for timesheet audit calendar feature
 */

export interface TimesheetEntryWithEmployee {
  id: number;
  employee_id: number;
  employee_name: string;
  work_date: string;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  worked_minutes: number;
  overtime_minutes: number;
  comment: string | null;
}

export interface OverlapInfo {
  work_date: string;
  employee_count: number;
  employee_ids: number[];
  total_overlapping_pairs: number;
}

export interface CalendarEventData {
  id: string;
  employeeId: number;
  employee_name: string;
  work_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  has_overlap: boolean;
}
