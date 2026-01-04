import { db, EmployeeSalaryType, EmployeeStatus } from "@finanzas/db";
import { Decimal } from "decimal.js";
import {
  EmployeeCreateInput,
  EmployeeWhereInput,
  EmployeeUpdateInput,
  EmployeeTimesheetWhereInput,
  EmployeeTimesheetCreateInput,
  EmployeeTimesheetUpdateInput,
  PersonUpdateInput,
} from "../lib/db-types";

// Type for the frontend payload (snake_case)
interface EmployeePayload {
  full_name?: string;
  role?: string;
  email?: string | null;
  rut?: string | null;
  bank_name?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  salary_type?: "HOURLY" | "FIXED";
  hourly_rate?: number | null;
  fixed_salary?: number | null;
  overtime_rate?: number | null;
  retention_rate?: number;
  status?: "ACTIVE" | "INACTIVE" | "TERMINATED";
  metadata?: Record<string, unknown> | null;
}

// Helper to convert metadata to Prisma-compatible JSON
function toJsonValue(
  value: Record<string, unknown> | null | undefined,
): any | undefined {
  // Changed return type from Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined
  if (value === undefined) return undefined;
  if (value === null) return null; // Changed from Prisma.JsonNull
  return value as any; // Changed from Prisma.InputJsonValue
}

// Map frontend payload to Prisma Employee update data
function mapToEmployeeData(payload: EmployeePayload): EmployeeUpdateInput {
  const data: EmployeeUpdateInput = {};

  if (payload.role !== undefined) {
    data.position = payload.role;
  }
  if (payload.bank_name !== undefined) {
    data.bankName = payload.bank_name;
  }
  if (payload.bank_account_type !== undefined) {
    data.bankAccountType = payload.bank_account_type;
  }
  if (payload.bank_account_number !== undefined) {
    data.bankAccountNumber = payload.bank_account_number;
  }
  if (payload.salary_type !== undefined) {
    data.salaryType = payload.salary_type as EmployeeSalaryType;
  }
  if (payload.hourly_rate !== undefined) {
    data.hourlyRate = new Decimal(payload.hourly_rate ?? 0);
  }
  if (payload.fixed_salary !== undefined) {
    data.baseSalary = new Decimal(payload.fixed_salary ?? 0);
  }
  if (payload.overtime_rate !== undefined) {
    data.overtimeRate = new Decimal(payload.overtime_rate ?? 0);
  }
  if (payload.retention_rate !== undefined) {
    data.retentionRate = new Decimal(payload.retention_rate ?? 0);
  }
  if (payload.metadata !== undefined) {
    data.metadata = toJsonValue(payload.metadata);
  }
  if (payload.status !== undefined) {
    data.status = payload.status as EmployeeStatus;
  }

  return data;
}

// Map frontend payload to Prisma Person update data
function mapToPersonData(payload: EmployeePayload): PersonUpdateInput {
  const data: PersonUpdateInput = {};

  if (payload.full_name !== undefined) {
    data.names = payload.full_name;
  }
  if (payload.email !== undefined) {
    data.email = payload.email;
  }
  if (payload.rut !== undefined) {
    data.rut = payload.rut ?? undefined;
  }

  return data;
}

export async function listEmployees(options?: {
  includeInactive?: boolean;
  includeTest?: boolean;
}) {
  const where: EmployeeWhereInput = {};
  if (!options?.includeInactive) {
    where.status = "ACTIVE";
  }

  // Exclude test data by default
  if (!options?.includeTest) {
    where.person = {
      NOT: {
        OR: [
          { names: { contains: "Test" } },
          { names: { contains: "test" } },
          { rut: { startsWith: "11111111" } },
          { rut: { startsWith: "TEMP-" } },
          { email: { contains: "test" } },
        ],
      },
    };
  }

  return await db.employee.findMany({
    where,
    orderBy: { person: { names: "asc" } },
    include: { person: true },
  });
}

export async function getEmployeeById(id: number) {
  return await db.employee.findUnique({
    where: { id },
    include: { person: true },
  });
}

export async function findEmployeeByEmail(email: string) {
  return await db.employee.findFirst({
    where: { person: { email } },
    include: { person: true },
  });
}

// Create employee from frontend payload - requires creating Person first
export async function createEmployee(
  payload: EmployeePayload & { rut: string; full_name: string },
) {
  return await db.$transaction(async (tx) => {
    // First create or find Person by RUT
    const person = await tx.person.upsert({
      where: { rut: payload.rut },
      update: {
        names: payload.full_name,
        email: payload.email,
      },
      create: {
        rut: payload.rut,
        names: payload.full_name,
        email: payload.email,
        personType: "NATURAL",
      },
    });

    // Then create Employee linked to Person
    return await tx.employee.create({
      data: {
        personId: person.id,
        position: payload.role || "Sin cargo",
        salaryType: (payload.salary_type as EmployeeSalaryType) || "FIXED",
        baseSalary: payload.fixed_salary
          ? new Decimal(payload.fixed_salary)
          : new Decimal(0),
        hourlyRate: payload.hourly_rate
          ? new Decimal(payload.hourly_rate)
          : undefined,
        overtimeRate: payload.overtime_rate
          ? new Decimal(payload.overtime_rate)
          : undefined,
        retentionRate: payload.retention_rate
          ? new Decimal(payload.retention_rate)
          : undefined,
        metadata: toJsonValue(payload.metadata),
        bankName: payload.bank_name,
        bankAccountType: payload.bank_account_type,
        bankAccountNumber: payload.bank_account_number,
        startDate: new Date(),
        status: "ACTIVE",
      },
      include: { person: true },
    });
  });
}

export async function updateEmployee(id: number, payload: EmployeePayload) {
  // Get current employee to find personId
  const currentEmployee = await db.employee.findUnique({
    where: { id },
    select: { personId: true },
  });

  if (!currentEmployee) {
    throw new Error(`Employee with id ${id} not found`);
  }

  const employeeData = mapToEmployeeData(payload);
  const personData = mapToPersonData(payload);

  // Use transaction to update both Employee and Person atomically
  return await db.$transaction(async (tx) => {
    // Update Person if there's data to update
    if (Object.keys(personData).length > 0) {
      await tx.person.update({
        where: { id: currentEmployee.personId },
        data: personData,
      });
    }

    // Update Employee
    return await tx.employee.update({
      where: { id },
      data: employeeData,
      include: { person: true },
    });
  });
}

export async function deactivateEmployee(id: number) {
  return await db.employee.update({
    where: { id },
    data: { status: "INACTIVE" },
    include: { person: true },
  });
}

export async function listEmployeeTimesheets(
  employeeId: number,
  from?: Date,
  to?: Date,
) {
  const where: EmployeeTimesheetWhereInput = {
    employeeId,
  };

  if (from || to) {
    where.workDate = {};
    if (from) where.workDate.gte = from;
    if (to) where.workDate.lte = to;
  }

  return await db.employeeTimesheet.findMany({
    where,
    orderBy: { workDate: "desc" },
  });
}

export async function createEmployeeTimesheet(
  data: EmployeeTimesheetCreateInput,
) {
  return await db.employeeTimesheet.create({
    data,
  });
}

export async function updateEmployeeTimesheet(
  id: number,
  data: EmployeeTimesheetUpdateInput,
) {
  return await db.employeeTimesheet.update({
    where: { id: BigInt(id) },
    data,
  });
}

export async function deleteEmployeeTimesheet(id: bigint) {
  return await db.employeeTimesheet.delete({
    where: { id },
  });
}
