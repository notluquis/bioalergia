import { queryOptions } from "@tanstack/react-query";

import { fetchEmployees } from "@/features/hr/employees/api";
import { apiClient } from "@/lib/apiClient";
import type { Permission, Role } from "@/types/roles";

export const roleKeys = {
  all: ["roles"] as const,
  mappings: ["role-mappings-data"] as const,
};

export const roleQueries = {
  mappings: () =>
    queryOptions({
      queryKey: roleKeys.mappings,
      queryFn: async () => {
        const [employees, dbMappings, roles] = await Promise.all([
          fetchEmployees(true),
          getRoleMappings(),
          fetchRoles(),
        ]);
        return { employees, dbMappings, roles };
      },
      // Keep data fresh but allow staleness for better UX
      staleTime: 30 * 1000,
    }),
  users: (roleId: number) =>
    queryOptions({
      queryKey: [...roleKeys.all, roleId, "users"] as const,
      queryFn: () => fetchRoleUsers(roleId),
    }),
};

// --- Role Mappings ---

export type RoleMapping = {
  employee_role: string;
  app_role: string;
};

export async function getRoleMappings(): Promise<RoleMapping[]> {
  const res = await apiClient.get<{ data: RoleMapping[] }>("/api/roles/mappings");
  return res.data;
}

export async function saveRoleMapping(mapping: RoleMapping): Promise<void> {
  await apiClient.post("/api/roles/mappings", mapping);
}

// --- Roles & Permissions Management ---

export async function fetchRoles() {
  const res = await apiClient.get<{ status: string; roles: Role[] }>("/api/roles");
  return res.roles;
}

export async function fetchPermissions() {
  const res = await apiClient.get<{ status: string; permissions: Permission[] }>("/api/roles/permissions");
  return res.permissions;
}

export async function syncPermissions() {
  return apiClient.post("/api/roles/permissions/sync", {});
}

interface UpdateRolePermissionsParams {
  roleId: number;
  permissionIds: number[];
}

export async function updateRolePermissions({ roleId, permissionIds }: UpdateRolePermissionsParams) {
  return apiClient.post(`/api/roles/${roleId}/permissions`, { permissionIds });
}

// --- CRUD & Users ---

interface RoleFormData {
  name: string;
  description: string;
}

export async function createRole(data: RoleFormData) {
  return apiClient.post("/api/roles", data);
}

export async function updateRole(id: number, data: RoleFormData) {
  return apiClient.put(`/api/roles/${id}`, data);
}

export async function deleteRole(id: number) {
  return apiClient.delete(`/api/roles/${id}`);
}

export interface RoleUser {
  id: number;
  email: string;
  person: {
    names: string;
    fatherName: string;
  } | null;
}

export async function fetchRoleUsers(roleId: number) {
  const res = await apiClient.get<{ users: RoleUser[] }>(`/api/roles/${roleId}/users`);
  return res.users;
}

interface ReassignParams {
  roleId: number;
  targetRoleId: number;
}

export async function reassignRoleUsers({ roleId, targetRoleId }: ReassignParams) {
  return apiClient.post(`/api/roles/${roleId}/reassign`, {
    targetRoleId,
  });
}
