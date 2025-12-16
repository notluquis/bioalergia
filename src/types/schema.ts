export type UserRole = string;
export type PersonType = "NATURAL" | "JURIDICAL";
export type CounterpartCategory =
  | "SUPPLIER"
  | "PATIENT"
  | "EMPLOYEE"
  | "PARTNER"
  | "RELATED"
  | "OTHER"
  | "CLIENT"
  | "LENDER"
  | "OCCASIONAL";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";
export type EmployeeSalaryType = "HOURLY" | "FIXED";
export type TransactionDirection = "IN" | "OUT" | "NEUTRO";
export type ServiceType = "BUSINESS" | "PERSONAL" | "SUPPLIER" | "TAX" | "UTILITY" | "LEASE" | "SOFTWARE" | "OTHER";
export type ServiceFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "ONCE";
export type ServiceStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";
export type LoanScheduleStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
export type UserStatus = "PENDING_SETUP" | "ACTIVE" | "SUSPENDED";

export interface Person {
  id: number;
  rut: string;
  names: string;
  fatherName?: string | null;
  motherName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  personType: PersonType;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: User | null;
  employee?: Employee | null;
  counterpart?: Counterpart | null;
}

export interface User {
  id: number;
  personId: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  person?: Person;
}

export interface Employee {
  id: number;
  personId: number;
  position: string;
  department?: string | null;
  startDate: string;
  endDate?: string | null;
  status: EmployeeStatus;
  salaryType: EmployeeSalaryType;
  baseSalary: number;
  hourlyRate?: number | null;
  bankName?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  person?: Person;
}

export interface Counterpart {
  id: number;
  personId: number;
  category: CounterpartCategory;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  person?: Person;
  accounts?: CounterpartAccount[];
}

export interface CounterpartAccount {
  id: number;
  counterpartId: number;
  bankName?: string | null;
  accountType?: string | null;
  accountNumber: string;
}
