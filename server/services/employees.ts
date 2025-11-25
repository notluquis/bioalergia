import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export async function listEmployees(options?: { includeInactive?: boolean }) {
  const where: Prisma.EmployeeWhereInput = {};
  if (!options?.includeInactive) {
    where.status = "ACTIVE";
  }
  return await prisma.employee.findMany({
    where,
    orderBy: { person: { names: "asc" } },
    include: { person: true },
  });
}

export async function getEmployeeById(id: number) {
  return await prisma.employee.findUnique({
    where: { id },
    include: { person: true },
  });
}

export async function findEmployeeByEmail(email: string) {
  return await prisma.employee.findFirst({
    where: { person: { email } },
    include: { person: true },
  });
}

export async function createEmployee(data: Prisma.EmployeeUncheckedCreateInput) {
  return await prisma.employee.create({
    data,
    include: { person: true },
  });
}

export async function updateEmployee(id: number, data: Prisma.EmployeeUncheckedUpdateInput) {
  return await prisma.employee.update({
    where: { id },
    data,
    include: { person: true },
  });
}

export async function deactivateEmployee(id: number) {
  return await prisma.employee.update({
    where: { id },
    data: { status: "INACTIVE" },
    include: { person: true },
  });
}

export async function listEmployeeTimesheets(employeeId: number, from?: Date, to?: Date) {
  const where: Prisma.EmployeeTimesheetWhereInput = {
    employeeId,
  };

  if (from || to) {
    where.workDate = {};
    if (from) where.workDate.gte = from;
    if (to) where.workDate.lte = to;
  }

  return await prisma.employeeTimesheet.findMany({
    where,
    orderBy: { workDate: "desc" },
  });
}

export async function createEmployeeTimesheet(data: Prisma.EmployeeTimesheetUncheckedCreateInput) {
  return await prisma.employeeTimesheet.create({
    data,
  });
}

export async function updateEmployeeTimesheet(id: bigint, data: Prisma.EmployeeTimesheetUncheckedUpdateInput) {
  return await prisma.employeeTimesheet.update({
    where: { id },
    data,
  });
}

export async function deleteEmployeeTimesheet(id: bigint) {
  return await prisma.employeeTimesheet.delete({
    where: { id },
  });
}
