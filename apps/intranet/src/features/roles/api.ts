import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { fetchEmployees } from "@/features/hr/employees/api";
import type { Permission, Role } from "@/types/roles";
import { type RoleMapping, type RoleUser, rolesORPCClient, toRolesApiError } from "./orpc";

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

const StatusResponseSchema = z.object({ status: z.literal("ok") });
const PermissionsResponseSchema = z.object({ permissions: z.array(z.unknown()) });
const RolesResponseSchema = z.object({ roles: z.array(z.unknown()) });
const RoleUsersResponseSchema = z.object({ users: z.array(z.unknown()) });
const RoleMappingsResponseSchema = z.object({ data: z.array(z.unknown()) });
const RolesTelemetryResponseSchema = z.object({
  skipped: z.boolean().optional(),
  status: z.literal("ok"),
});

export async function createRole(data: RoleFormData) {
  try {
    return StatusResponseSchema.parse(await rolesORPCClient.create(data));
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function deleteRole(id: number) {
  try {
    return StatusResponseSchema.parse(await rolesORPCClient.delete({ id }));
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function fetchPermissions() {
  try {
    const res = PermissionsResponseSchema.parse(await rolesORPCClient.permissions());
    return res.permissions as Permission[];
  } catch (error) {
    throw toRolesApiError(error);
  }
}

// --- CRUD & Users ---

export async function fetchRoles() {
  try {
    const res = RolesResponseSchema.parse(await rolesORPCClient.list());
    return res.roles as Role[];
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function fetchRoleUsers(roleId: number) {
  try {
    const res = RoleUsersResponseSchema.parse(await rolesORPCClient.roleUsers({ id: roleId }));
    return res.users as RoleUser[];
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function getRoleMappings(): Promise<RoleMapping[]> {
  try {
    const res = RoleMappingsResponseSchema.parse(await rolesORPCClient.listMappings());
    return res.data as RoleMapping[];
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function reassignRoleUsers({ roleId, targetRoleId }: ReassignParams) {
  try {
    return await rolesORPCClient.reassignUsers({ id: roleId, targetRoleId });
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function saveRoleMapping(mapping: RoleMapping): Promise<void> {
  try {
    await rolesORPCClient.saveMapping(mapping);
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function syncPermissions() {
  try {
    return await rolesORPCClient.syncPermissions();
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function updateRole(id: number, data: RoleFormData) {
  try {
    return StatusResponseSchema.parse(await rolesORPCClient.update({ id, payload: data }));
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function updateRolePermissions({
  permissionIds,
  roleId,
}: UpdateRolePermissionsParams) {
  try {
    return StatusResponseSchema.parse(
      await rolesORPCClient.updatePermissions({ id: roleId, permissionIds })
    );
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export async function sendUnmappedSubjectsTelemetry(payload: {
  subjects?: string[];
  timestamp?: string;
  total?: number;
}) {
  try {
    return RolesTelemetryResponseSchema.parse(
      await rolesORPCClient.telemetryUnmappedSubjects(payload)
    );
  } catch (error) {
    throw toRolesApiError(error);
  }
}

export type { RoleMapping, RoleUser };
