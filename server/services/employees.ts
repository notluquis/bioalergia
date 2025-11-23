import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client";

export async function listEmployees(options?: { includeInactive?: boolean }) {
  const where: Prisma.EmployeeWhereInput = {};
  if (!options?.includeInactive) {
    where.status = "ACTIVE";
  }
  return await prisma.employee.findMany({
    where,
    orderBy: { fullName: "asc" },
  });
}

export async function getEmployeeById(id: number) {
  return await prisma.employee.findUnique({
    where: { id },
  });
}

export async function findEmployeeByEmail(email: string) {
  return await prisma.employee.findFirst({
    where: { email },
  });
}

export async function createEmployee(data: Prisma.EmployeeCreateInput) {
  return await prisma.employee.create({
    data,
  });
}

export async function updateEmployee(id: number, data: Prisma.EmployeeUpdateInput) {
  return await prisma.employee.update({
    where: { id },
    data,
  });
}

export async function deactivateEmployee(id: number) {
  return await prisma.employee.update({
    where: { id },
    data: { status: "INACTIVE" },
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

export async function createEmployeeTimesheet(data: Prisma.EmployeeTimesheetCreateInput) {
  return await prisma.employeeTimesheet.create({
    data,
  });
}

export async function updateEmployeeTimesheet(id: bigint, data: Prisma.EmployeeTimesheetUpdateInput) {
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
