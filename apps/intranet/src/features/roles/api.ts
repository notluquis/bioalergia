import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { fetchEmployees } from "@/features/hr/employees/api";
import { apiClient } from "@/lib/api-client";
import type { Permission, Role } from "@/types/roles";

export const roleKeys = {
  all: ["roles"] as const,
  mappings: ["role-mappings-data"] as const,
};

export const roleQueries = {
  mappings: () =>
    queryOptions({
      queryFn: async () => {
        const [employees, dbMappings, roles] = await Promise.all([
          fetchEmployees(true),
          getRoleMappings(),
          fetchRoles(),
        ]);
        return { dbMappings, employees, roles };
      },
      queryKey: roleKeys.mappings,
      // Keep data fresh but allow staleness for better UX
      staleTime: 30 * 1000,
    }),
  users: (roleId: number) =>
    queryOptions({
      queryFn: () => fetchRoleUsers(roleId),
      queryKey: [...roleKeys.all, roleId, "users"] as const,
    }),
};

// --- Role Mappings ---

export interface RoleMapping {
  app_role: string;
  employee_role: string;
}

export interface RoleUser {
  email: string;
  id: number;
  person: null | {
    fatherName: string;
    names: string;
  };
}

interface ReassignParams {
  roleId: number;
  targetRoleId: number;
}

// --- Roles & Permissions Management ---

interface RoleFormData {
  description: string;
  name: string;
}

interface UpdateRolePermissionsParams {
  permissionIds: number[];
  roleId: number;
}

const StatusResponseSchema = z.looseObject({ status: z.string().optional() });
const PermissionsResponseSchema = z.object({
  permissions: z.array(z.unknown()),
  status: z.string(),
});
const RolesResponseSchema = z.object({
  roles: z.array(z.unknown()),
  status: z.string(),
});
const RoleUsersResponseSchema = z.object({
  users: z.array(z.unknown()),
});
const RoleMappingsResponseSchema = z.object({
  data: z.array(z.unknown()),
});

export async function createRole(data: RoleFormData) {
  return apiClient.post("/api/roles", data, { responseSchema: StatusResponseSchema });
}

export async function deleteRole(id: number) {
  return apiClient.delete(`/api/roles/${id}`, { responseSchema: StatusResponseSchema });
}

export async function fetchPermissions() {
  const res = await apiClient.get<{ permissions: Permission[]; status: string }>(
    "/api/roles/permissions",
    { responseSchema: PermissionsResponseSchema },
  );
  return res.permissions;
}

// --- CRUD & Users ---

export async function fetchRoles() {
  const res = await apiClient.get<{ roles: Role[]; status: string }>("/api/roles", {
    responseSchema: RolesResponseSchema,
  });
  return res.roles;
}

export async function fetchRoleUsers(roleId: number) {
  const res = await apiClient.get<{ users: RoleUser[] }>(`/api/roles/${roleId}/users`, {
    responseSchema: RoleUsersResponseSchema,
  });
  return res.users;
}

export async function getRoleMappings(): Promise<RoleMapping[]> {
  const res = await apiClient.get<{ data: RoleMapping[] }>("/api/roles/mappings", {
    responseSchema: RoleMappingsResponseSchema,
  });
  return res.data;
}

export async function reassignRoleUsers({ roleId, targetRoleId }: ReassignParams) {
  return apiClient.post(
    `/api/roles/${roleId}/reassign`,
    {
      targetRoleId,
    },
    { responseSchema: StatusResponseSchema },
  );
}

export async function saveRoleMapping(mapping: RoleMapping): Promise<void> {
  await apiClient.post("/api/roles/mappings", mapping, { responseSchema: StatusResponseSchema });
}

export async function syncPermissions() {
  return apiClient.post(
    "/api/roles/permissions/sync",
    {},
    { responseSchema: StatusResponseSchema },
  );
}

export async function updateRole(id: number, data: RoleFormData) {
  return apiClient.put(`/api/roles/${id}`, data, { responseSchema: StatusResponseSchema });
}

export async function updateRolePermissions({
  permissionIds,
  roleId,
}: UpdateRolePermissionsParams) {
  return apiClient.post(
    `/api/roles/${roleId}/permissions`,
    { permissionIds },
    { responseSchema: StatusResponseSchema },
  );
}
