import { z } from "zod";
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
      data as EmployeePayload & { names: string; rut: string },
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
      await employeesORPCClient.list(includeInactive ? { includeInactive } : undefined),
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
    const res = await employeesORPCClient.update({ id, payload: data });
    return EmployeeResponseSchema.parse(res).employee as Employee;
  } catch (error) {
    throw toEmployeesApiError(error);
  }
}

export type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";
