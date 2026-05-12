import { z } from "zod";
import { compactORPCInput } from "@/lib/orpc-input";
import { employeesORPCClient, toEmployeesApiError } from "./orpc";

import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";

const EmployeeResponseSchema = z.object({
  employee: z.unknown(),
});

const EmployeesResponseSchema = z.object({
  employees: z.array(z.unknown()),
});

export async function createEmployee(data: EmployeePayload): Promise<Employee> {
  try {
    const res = await employeesORPCClient.create(
      data as EmployeePayload & { names: string; rut: string }
    );
    return EmployeeResponseSchema.parse(res).employee as Employee;
  } catch (error) {
    throw toEmployeesApiError(error);
  }
}

export async function deactivateEmployee(id: number): Promise<void> {
  try {
    await employeesORPCClient.deactivate({ id });
  } catch (error) {
    throw toEmployeesApiError(error);
  }
}

export async function fetchEmployees(includeInactive = false): Promise<Employee[]> {
  try {
    const res = EmployeesResponseSchema.parse(
      await employeesORPCClient.list(
        compactORPCInput({ includeInactive: includeInactive ? true : undefined }) ?? {}
      )
    );
    const employees = res.employees as Employee[];

    return employees.map((emp) => {
      if (!emp.full_name && emp.person) {
        return {
          ...emp,
          full_name: [emp.person.names, emp.person.fatherName, emp.person.motherName]
            .filter(Boolean)
            .join(" "),
        };
      }

      return emp;
    }) as Employee[];
  } catch (error) {
    throw toEmployeesApiError(error);
  }
}

export async function updateEmployee(id: number, data: EmployeeUpdatePayload): Promise<Employee> {
  try {
    const normalizedStatus =
      data.status === "ACTIVE" || data.status === "INACTIVE" || data.status === "TERMINATED"
        ? data.status
        : undefined;
    const payload = {
      bank_account_number: data.bank_account_number,
      bank_account_type: data.bank_account_type,
      bank_name: data.bank_name,
      email: data.email,
      fatherName: data.fatherName,
      fixed_salary: data.fixed_salary,
      hourly_rate: data.hourly_rate,
      metadata: data.metadata,
      motherName: data.motherName,
      names: data.names ?? undefined,
      overtime_rate: data.overtime_rate,
      retention_rate: data.retention_rate,
      role: data.role ?? undefined,
      rut: data.rut ?? undefined,
      salary_type: data.salary_type,
      status: normalizedStatus,
    };
    const res = await employeesORPCClient.update({ id, payload });
    return EmployeeResponseSchema.parse(res).employee as Employee;
  } catch (error) {
    throw toEmployeesApiError(error);
  }
}

export type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";
