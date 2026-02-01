import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";

const EmployeeResponseSchema = z.object({
  employee: z.unknown(),
});

const EmployeesResponseSchema = z.object({
  employees: z.array(z.unknown()),
});

const StatusResponseSchema = z.looseObject({ status: z.string().optional() });

export async function createEmployee(data: EmployeePayload): Promise<Employee> {
  const res = await apiClient.post<{ employee: Employee }>("/api/employees", data, {
    responseSchema: EmployeeResponseSchema,
  });
  return res.employee;
}

export async function deactivateEmployee(id: number): Promise<void> {
  await apiClient.delete(`/api/employees/${id}`, { responseSchema: StatusResponseSchema });
}

export async function fetchEmployees(includeInactive = false): Promise<Employee[]> {
  const url = new URL("/api/employees", globalThis.location.origin);
  if (includeInactive) {
    url.searchParams.set("includeInactive", "true");
  }
  const res = await apiClient.get<{ employees: Employee[] }>(url.pathname + url.search, {
    responseSchema: EmployeesResponseSchema,
  });
  return res.employees.map((emp) => {
    // If backend doesn't send full_name, compute it from person
    if (!emp.full_name && emp.person) {
      return {
        ...emp,
        full_name: [emp.person.names, emp.person.fatherName, emp.person.motherName]
          .filter(Boolean)
          .join(" "),
      };
    }
    return emp;
  });
}

export async function updateEmployee(id: number, data: EmployeeUpdatePayload): Promise<Employee> {
  const res = await apiClient.put<{ employee: Employee }>(`/api/employees/${id}`, data, {
    responseSchema: EmployeeResponseSchema,
  });
  return res.employee;
}

export type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";
