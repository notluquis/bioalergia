import { Employee as DbEmployee, EmployeeSalaryType, EmployeeStatus } from "@/types/schema";

export type Employee = DbEmployee & {
  full_name: string; // Computed field often used in frontend
  // Legacy fields mapping (if needed) or just use the new schema
  // We will keep the frontend specific fields if they are used
};

// Re-exporting for compatibility if needed, but ideally we switch to DbEmployee
// For now, let's align the types

export type EmployeePayload = {
  full_name: string;
  role: string;
  email?: string | null;
  rut?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  salary_type: EmployeeSalaryType;
  hourly_rate?: number;
  fixed_salary?: number | null;
  overtime_rate?: number | null;
  retention_rate: number;
  metadata?: Record<string, unknown> | null;
};

export type EmployeeUpdatePayload = Partial<EmployeePayload> & {
  status?: EmployeeStatus;
};
