import { Prisma } from "@prisma/client";
import { normalizeTimestamp } from "./time.js";
import { normalizeRut } from "./rut.js";

// --- Types ---

export type PersonWithRoles = Prisma.PersonGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        status: true;
        roles: { select: { role: { select: { name: true } } } };
      };
    };
    employee: true;
    counterpart: { include: { accounts: true } };
  };
}>;

export type CounterpartWithAccounts = Prisma.CounterpartGetPayload<{
  include: { accounts: true; person: true };
}>;

export type CounterpartAccountType = Prisma.CounterpartAccountGetPayload<{}>;

export type ServiceWithCounterpart = Prisma.ServiceGetPayload<{
  include: { counterpart: { include: { person: true } } };
}>;

export type EnrichedTransaction = Prisma.TransactionGetPayload<{
  include: { person: true };
}>;

export type EmployeeWithPerson = Prisma.EmployeeGetPayload<{
  include: { person: true };
}>;

// --- Mappers ---

/**
 * Maps a Person entity with all its roles (user, employee, counterpart)
 * This is the unified view of a person with all their associated data
 */
export function mapPerson(p: PersonWithRoles) {
  return {
    // Core person data
    id: p.id,
    rut: p.rut,
    full_name: [p.names, p.fatherName, p.motherName].filter(Boolean).join(" "),
    names: p.names,
    father_name: p.fatherName,
    mother_name: p.motherName,
    email: p.email,
    phone: p.phone,
    address: p.address,
    person_type: p.personType,
    created_at: p.createdAt,
    updated_at: p.updatedAt,

    // Flags for quick role checking
    is_user: !!p.user,
    is_employee: !!p.employee,
    is_counterpart: !!p.counterpart,

    // User role data (if exists)
    user: p.user
      ? {
          id: p.user.id,
          email: p.user.email,
          role: p.user.roles?.[0]?.role?.name || "VIEWER", // Flatten role, default to VIEWER
          status: p.user.status,
        }
      : null,

    // Employee role data (if exists)
    employee: p.employee
      ? {
          id: p.employee.id,
          position: p.employee.position,
          department: p.employee.department,
          status: p.employee.status,
          salary_type: p.employee.salaryType,
          base_salary: p.employee.baseSalary ? Number(p.employee.baseSalary) : 0,
          hourly_rate: p.employee.hourlyRate ? Number(p.employee.hourlyRate) : null,
          overtime_rate: p.employee.overtimeRate ? Number(p.employee.overtimeRate) : null,
          retention_rate: p.employee.retentionRate ? Number(p.employee.retentionRate) : 0,
          bank_name: p.employee.bankName,
          bank_account_type: p.employee.bankAccountType,
          bank_account_number: p.employee.bankAccountNumber,
          start_date: p.employee.startDate,
          end_date: p.employee.endDate,
        }
      : null,

    // Counterpart role data (if exists)
    counterpart: p.counterpart
      ? {
          id: p.counterpart.id,
          category: p.counterpart.category,
          notes: p.counterpart.notes,
          accounts: p.counterpart.accounts?.map(mapCounterpartAccount) ?? [],
        }
      : null,
  };
}

/**
 * Maps an Employee with its Person data included
 * Returns a flat structure with person fields at root level for frontend compatibility
 */
export function mapEmployee(e: EmployeeWithPerson) {
  return {
    // Employee ID
    id: e.id,

    // Person data at root level (for frontend compatibility)
    person_id: e.personId,
    full_name: e.person.names,
    rut: normalizeRut(e.person.rut),
    email: e.person.email,
    phone: e.person.phone,

    // Also include nested person for new code
    person: {
      id: e.person.id,
      rut: normalizeRut(e.person.rut),
      names: e.person.names,
      email: e.person.email,
      phone: e.person.phone,
      person_type: e.person.personType,
    },

    // Employee-specific data
    position: e.position,
    department: e.department,
    status: e.status,
    salaryType: e.salaryType,
    salary_type: e.salaryType, // snake_case alias
    baseSalary: e.baseSalary ? Number(e.baseSalary) : 0,
    base_salary: e.baseSalary ? Number(e.baseSalary) : 0, // snake_case alias
    hourlyRate: e.hourlyRate ? Number(e.hourlyRate) : null,
    hourly_rate: e.hourlyRate ? Number(e.hourlyRate) : null, // snake_case alias
    overtimeRate: e.overtimeRate ? Number(e.overtimeRate) : null,
    overtime_rate: e.overtimeRate ? Number(e.overtimeRate) : null, // snake_case alias
    retentionRate: e.retentionRate ? Number(e.retentionRate) : 0,
    retention_rate: e.retentionRate ? Number(e.retentionRate) : 0, // snake_case alias
    bankName: e.bankName,
    bank_name: e.bankName, // snake_case alias
    bankAccountType: e.bankAccountType,
    bank_account_type: e.bankAccountType, // snake_case alias
    bankAccountNumber: e.bankAccountNumber,
    bank_account_number: e.bankAccountNumber, // snake_case alias
    startDate: e.startDate,
    start_date: e.startDate, // snake_case alias
    endDate: e.endDate,
    end_date: e.endDate, // snake_case alias
    metadata: e.metadata,
    createdAt: e.createdAt,
    created_at: e.createdAt, // snake_case alias
    updatedAt: e.updatedAt,
    updated_at: e.updatedAt, // snake_case alias
  };
}

// --- Mappers ---

export function mapCounterpart(c: CounterpartWithAccounts) {
  return {
    id: c.id,
    rut: normalizeRut(c.person.rut),
    name: c.person.names,
    person_type: c.person.personType,
    category: c.category,
    email: c.person.email,
    notes: c.notes,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function mapCounterpartAccount(a: CounterpartAccountType) {
  return {
    id: a.id,
    counterpart_id: a.counterpartId,
    bank_name: a.bankName,
    account_type: a.accountType,
    account_number: a.accountNumber,
  };
}

export function mapService(s: ServiceWithCounterpart) {
  return {
    id: s.id,
    name: s.name,
    category: s.counterpart?.category,
    service_type: s.type,
    default_amount: s.defaultAmount,
    counterpart_id: s.counterpartId,
    frequency: s.frequency,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    counterpart_name: s.counterpart?.person.names,
  };
}

export function mapTransaction(row: EnrichedTransaction) {
  return {
    id: Number(row.id),
    timestamp: normalizeTimestamp(row.timestamp, null),
    description: row.description,
    origin: row.origin,
    destination: row.destination,
    direction: row.direction as "IN" | "OUT" | "NEUTRO",
    amount: row.amount != null ? Number(row.amount) : null,
    created_at: row.createdAt.toISOString(),
    person_name: row.person?.names,
    person_rut: row.person?.rut,
  };
}
