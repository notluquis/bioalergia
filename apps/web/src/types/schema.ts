export interface Counterpart {
  accounts?: CounterpartAccount[];
  category: CounterpartCategory;
  createdAt: string;
  id: number;
  notes?: null | string;
  person?: Person;
  personId: number;
  updatedAt: string;
}
export interface CounterpartAccount {
  accountNumber: string;
  accountType?: null | string;
  bankName?: null | string;
  counterpartId: number;
  id: number;
}
export type CounterpartCategory =
  | "CLIENT"
  | "EMPLOYEE"
  | "LENDER"
  | "OCCASIONAL"
  | "OTHER"
  | "PARTNER"
  | "PATIENT"
  | "RELATED"
  | "SUPPLIER";
export interface Employee {
  bankAccountNumber?: null | string;
  bankAccountType?: null | string;
  bankName?: null | string;
  baseSalary: number;
  createdAt: string;
  department?: null | string;
  endDate?: null | string;
  hourlyRate?: null | number;
  id: number;
  person?: Person;
  personId: number;
  position: string;
  salaryType: EmployeeSalaryType;
  startDate: string;
  status: EmployeeStatus;
  updatedAt: string;
}
export type EmployeeSalaryType = "FIXED" | "HOURLY";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";
export type LoanScheduleStatus = "OVERDUE" | "PAID" | "PARTIAL" | "PENDING";
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";
export interface Person {
  address?: null | string;
  counterpart?: Counterpart | null;
  createdAt: string;
  email?: null | string;
  employee?: Employee | null;
  fatherName?: null | string;
  id: number;
  motherName?: null | string;
  names: string;
  personType: PersonType;
  phone?: null | string;
  rut: string;
  updatedAt: string;
  // Relations
  user?: null | User;
}
export type PersonType = "JURIDICAL" | "NATURAL";
export type ServiceFrequency =
  | "ANNUAL"
  | "BIMONTHLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "ONCE"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "WEEKLY";

export type ServiceStatus = "ACTIVE" | "ARCHIVED" | "INACTIVE";

export type ServiceType = "BUSINESS" | "LEASE" | "OTHER" | "PERSONAL" | "SOFTWARE" | "SUPPLIER" | "TAX" | "UTILITY";

export type TransactionDirection = "IN" | "NEUTRO" | "OUT";

export interface User {
  createdAt: string;
  email: string;
  id: number;
  mfaEnabled: boolean;
  person?: Person;
  personId: number;
  role: string;
  status: UserStatus;
  updatedAt: string;
}

export type UserStatus = "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
