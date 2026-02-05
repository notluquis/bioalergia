export interface TimesheetEntry {
  comment: null | string;
  employee_id: number;
  end_time: null | string;
  id: number;
  overtime_minutes: number;
  start_time: null | string;
  work_date: string;
  worked_minutes: number;
}

export interface TimesheetPayload {
  comment?: null | string;
  employee_id: number;
  end_time?: null | string;
  overtime_minutes?: number;
  start_time?: null | string;
  work_date: string; // YYYY-MM-DD
  worked_minutes: number;
}

export interface TimesheetSummaryResponse {
  employees: TimesheetSummaryRow[];
  from: string;
  month: string;
  to: string;
  totals: {
    extraAmount: number;
    hours: string;
    net: number;
    overtime: string;
    retention: number;
    subtotal: number;
  };
}

export interface TimesheetSummaryRow {
  email: null | string;
  employeeId: number;
  extraAmount: number;
  fullName: string;
  hourlyRate: number;
  hoursFormatted: string;
  net: number;
  overtimeFormatted: string;
  overtimeMinutes: number;
  overtimeRate: number;
  payDate: string;
  retention: number;
  retention_rate?: null | number;
  retentionRate: number;
  role: string;
  subtotal: number;
  workedMinutes: number;
}

export interface TimesheetUpsertEntry {
  comment: null | string;
  end_time: null | string;
  overtime_minutes: number;
  start_time: null | string;
  work_date: string; // YYYY-MM-DD
}

export const EMPTY_BULK_ROW = {
  comment: "",
  date: new Date(),
  entrada: "", // Hora de entrada (ej: "09:00")
  entryId: null as null | number,
  overtime: "", // Horas extra (ej: "02:00")
  salida: "", // Hora de salida (ej: "18:00")
};

export type BulkRow = typeof EMPTY_BULK_ROW;
