import { oc } from "@orpc/contract";
import { z } from "zod";

export const rolesPermissionSchema = z.object({
  action: z.string(),
  description: z.string().nullable(),
  id: z.number().int(),
  subject: z.string(),
});

export const rolesRolePermissionSchema = z.object({
  permission: rolesPermissionSchema,
  permissionId: z.number().int(),
});

export const rolesRoleSchema = z.object({
  description: z.string().nullable(),
  id: z.number().int(),
  isSystem: z.boolean(),
  name: z.string(),
  permissions: z.array(rolesRolePermissionSchema),
});

export const rolesRoleUserSchema = z.object({
  email: z.string(),
  id: z.number().int(),
  person: z
    .object({
      fatherName: z.string(),
      names: z.string(),
    })
    .nullable(),
});

export const rolesRoleMappingSchema = z.object({
  app_role: z.string().min(1),
  employee_role: z.string().min(1),
});

export const rolesRoleFormSchema = z.object({
  description: z.string(),
  name: z.string().min(1).max(50),
});

export const rolesRoleUpdatePermissionsSchema = z.object({
  id: z.number().int(),
  permissionIds: z.array(z.number().int()),
});

export const rolesRoleIdSchema = z.object({
  id: z.number().int(),
});

export const rolesRoleReassignSchema = z.object({
  id: z.number().int(),
  targetRoleId: z.number().int(),
});

export const rolesUnmappedSubjectsTelemetrySchema = z.object({
  subjects: z.array(z.string()).optional(),
  timestamp: z.string().optional(),
  total: z.number().int().optional(),
});

export const rolesResponseSchema = z.object({
  roles: z.array(rolesRoleSchema),
});

export const rolesPermissionsResponseSchema = z.object({
  permissions: z.array(rolesPermissionSchema),
});

export const rolesRoleUsersResponseSchema = z.object({
  users: z.array(rolesRoleUserSchema),
});

export const rolesRoleMappingsResponseSchema = z.object({
  data: z.array(rolesRoleMappingSchema),
});

export const rolesStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const rolesSyncPermissionsResponseSchema = z.object({
  created: z.number().int(),
  details: z.array(z.string()),
  errors: z.array(z.string()).optional(),
  skipped: z.number().int(),
  status: z.literal("ok"),
  total: z.number().int(),
});

export const rolesTelemetryResponseSchema = z.object({
  skipped: z.boolean().optional(),
  status: z.literal("ok"),
});

export const rolesReassignResponseSchema = z.object({
  reassigned: z.number().int(),
  status: z.literal("ok"),
});

export const rolesContract = {
  create: oc.route({ method: "POST", path: "/" }).input(rolesRoleFormSchema).output(rolesStatusResponseSchema),
  delete: oc.route({ method: "DELETE", path: "/{id}" }).input(rolesRoleIdSchema).output(rolesStatusResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).output(rolesResponseSchema),
  listMappings: oc.route({ method: "GET", path: "/mappings" }).output(rolesRoleMappingsResponseSchema),
  permissions: oc.route({ method: "GET", path: "/permissions" }).output(rolesPermissionsResponseSchema),
  reassignUsers: oc.route({ method: "POST", path: "/{id}/reassign" }).input(rolesRoleReassignSchema).output(rolesReassignResponseSchema),
  roleUsers: oc.route({ method: "GET", path: "/{id}/users" }).input(rolesRoleIdSchema).output(rolesRoleUsersResponseSchema),
  saveMapping: oc.route({ method: "POST", path: "/mappings" }).input(rolesRoleMappingSchema).output(rolesStatusResponseSchema),
  syncPermissions: oc.route({ method: "POST", path: "/permissions/sync" }).output(rolesSyncPermissionsResponseSchema),
  telemetryUnmappedSubjects: oc.route({ method: "POST", path: "/telemetry/unmapped-subjects" }).input(rolesUnmappedSubjectsTelemetrySchema).output(rolesTelemetryResponseSchema),
  update: oc.route({ method: "PUT", path: "/{id}" }).input(z.object({ id: z.number().int(), payload: rolesRoleFormSchema })).output(rolesStatusResponseSchema),
  updatePermissions: oc.route({ method: "POST", path: "/{id}/permissions" }).input(rolesRoleUpdatePermissionsSchema).output(rolesStatusResponseSchema),
};

export type RolesContract = typeof rolesContract;
