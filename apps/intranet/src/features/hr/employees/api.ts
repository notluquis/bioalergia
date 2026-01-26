import { apiClient } from "@/lib/api-client";

import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";

export async function createEmployee(data: EmployeePayload): Promise<Employee> {
  const res = await apiClient.post<{ employee: Employee }>("/api/employees", data);
  return res.employee;
}

export async function deactivateEmployee(id: number): Promise<void> {
  await apiClient.delete(`/api/employees/${id}`);
}

export async function fetchEmployees(includeInactive = false): Promise<Employee[]> {
  const url = new URL("/api/employees", globalThis.location.origin);
  if (includeInactive) {
    url.searchParams.set("includeInactive", "true");
  }
  const res = await apiClient.get<{ employees: Employee[] }>(url.pathname + url.search);
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
  const res = await apiClient.put<{ employee: Employee }>(`/api/employees/${id}`, data);
  return res.employee;
}

export type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";
