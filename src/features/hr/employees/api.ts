import { apiClient } from "@/lib/apiClient";
import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";

export type { Employee, EmployeePayload, EmployeeUpdatePayload };

export async function fetchEmployees(includeInactive = false): Promise<Employee[]> {
  const url = new URL("/api/employees", window.location.origin);
  if (includeInactive) {
    url.searchParams.set("includeInactive", "true");
  }
  const res = await apiClient.get<{ employees: Employee[] }>(url.pathname + url.search);
  return res.employees;
}

export async function createEmployee(data: EmployeePayload): Promise<Employee> {
  const res = await apiClient.post<{ employee: Employee }>("/api/employees", data);
  return res.employee;
}

export async function updateEmployee(id: number, data: EmployeeUpdatePayload): Promise<Employee> {
  const res = await apiClient.put<{ employee: Employee }>(`/api/employees/${id}`, data);
  return res.employee;
}

export async function deactivateEmployee(id: number): Promise<void> {
  await apiClient.delete(`/api/employees/${id}`);
}
