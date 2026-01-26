import type { Employee as DbEmployee, EmployeeSalaryType, EmployeeStatus } from "@/types/schema";

export type Employee = DbEmployee & {
  full_name: string; // Computed field often used in frontend
  // Legacy fields mapping (if needed) or just use the new schema
  // We will keep the frontend specific fields if they are used
};

// Re-exporting for compatibility if needed, but ideally we switch to DbEmployee
// For now, let's align the types

export interface EmployeePayload {
  bank_account_number?: null | string;
  bank_account_type?: null | string;
  bank_name?: null | string;
  email?: null | string;
  fixed_salary?: null | number;
  full_name: string;
  hourly_rate?: number;
  metadata?: null | Record<string, unknown>;
  overtime_rate?: null | number;
  retention_rate: number;
  role: string;
  rut?: null | string;
  salary_type: EmployeeSalaryType;
}

export type EmployeeUpdatePayload = Partial<EmployeePayload> & {
  status?: EmployeeStatus;
};
