/**
 * Types for timesheet audit calendar feature
 */

export interface CalendarEventData {
  duration_hours: number;
  employee_name: string;
  employee_role: null | string;
  employeeId: number;
  end_time: string;
  has_overlap: boolean;
  id: string;
  start_time: string;
  work_date: string;
}

export interface OverlapInfo {
  employee_count: number;
  employee_ids: number[];
  total_overlapping_pairs: number;
  work_date: string;
}

export interface TimesheetEntryWithEmployee {
  comment: null | string;
  employee_id: number;
  employee_name: string;
  employee_role: null | string;
  end_time: string; // HH:MM format
  id: number;
  overtime_minutes: number;
  start_time: string; // HH:MM format
  work_date: string;
  worked_minutes: number;
}
