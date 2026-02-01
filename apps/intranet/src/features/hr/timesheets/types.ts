export interface TimesheetEntry {
  comment: null | string;
  created_at: Date;
  employee_id: number;
  end_time: null | string;
  extra_amount: number;
  id: number;
  overtime_minutes: number;
  start_time: null | string;
  updated_at: Date;
  work_date: Date;
  worked_minutes: number;
}

export interface TimesheetPayload {
  comment?: null | string;
  employee_id: number;
  end_time?: null | string;
  extra_amount?: number;
  overtime_minutes?: number;
  start_time?: null | string;
  work_date: Date;
  worked_minutes: number;
}

export interface TimesheetSummaryResponse {
  employees: TimesheetSummaryRow[];
  from: Date;
  month: string;
  to: Date;
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
  payDate: Date;
  retention: number;
  retentionRate: number;
  role: string;
  subtotal: number;
  workedMinutes: number;
}

export interface TimesheetUpsertEntry {
  comment: null | string;
  end_time: null | string;
  extra_amount: number;
  overtime_minutes: number;
  start_time: null | string;
  work_date: Date;
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
