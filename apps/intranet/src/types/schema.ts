export interface Counterpart {
  accounts?: CounterpartAccount[];
  bankAccountHolder: string;
  category: CounterpartCategory;
  createdAt: Date;
  id: number;
  identificationNumber: string;
  notes?: null | string;
  updatedAt: Date;
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
  | "OTHER"
  | "PERSONAL_EXPENSE"
  | "PARTNER"
  | "SUPPLIER";
export interface Employee {
  bankAccountNumber?: null | string;
  bankAccountType?: null | string;
  bankName?: null | string;
  baseSalary: number;
  createdAt: Date;
  department?: null | string;
  endDate?: null | Date;
  hourlyRate?: null | number;
  id: number;
  person?: Person;
  personId: number;
  position: string;
  salaryType: EmployeeSalaryType;
  startDate: Date;
  status: EmployeeStatus;
  updatedAt: Date;
}
export type EmployeeSalaryType = "FIXED" | "HOURLY";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";
export type LoanScheduleStatus = "OVERDUE" | "PAID" | "PARTIAL" | "PENDING";
export type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";
export interface Person {
  address?: null | string;
  counterpart?: Counterpart | null;
  createdAt: Date;
  email?: null | string;
  employee?: Employee | null;
  fatherName?: null | string;
  id: number;
  motherName?: null | string;
  names: string;
  personType: PersonType;
  phone?: null | string;
  rut: string;
  updatedAt: Date;
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

export type ServiceType =
  | "BUSINESS"
  | "LEASE"
  | "OTHER"
  | "PERSONAL"
  | "SOFTWARE"
  | "SUPPLIER"
  | "TAX"
  | "UTILITY";

export type TransactionDirection = "IN" | "NEUTRO" | "OUT";

export interface User {
  createdAt: Date;
  email: string;
  id: number;
  mfaEnabled: boolean;
  person?: Person;
  personId: number;
  role: string;
  status: UserStatus;
  updatedAt: Date;
}

export type UserStatus = "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
