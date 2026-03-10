import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError, logEvent } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  assignPermissionsToRole,
  createRole,
  deleteRole,
  getRoleMappings,
  listPermissions,
  listRoles,
  listRoleUsers,
  reassignRoleUsers,
  saveRoleMapping,
  syncPermissions,
  updateRole,
} from "../services/roles";
import { getSetting, updateSetting } from "../services/settings";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type RolesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<RolesORPCContext>();

const permissionSchema = z.object({
  action: z.string(),
  description: z.string().nullable(),
  id: z.number().int(),
  subject: z.string(),
});

const rolePermissionSchema = z.object({
  permission: permissionSchema,
  permissionId: z.number().int(),
});

const roleSchema = z.object({
  description: z.string().nullable(),
  id: z.number().int(),
  isSystem: z.boolean(),
  name: z.string(),
  permissions: z.array(rolePermissionSchema),
});

const roleUserSchema = z.object({
  email: z.string(),
  id: z.number().int(),
  person: z
    .object({
      fatherName: z.string(),
      names: z.string(),
    })
    .nullable(),
});

const roleMappingSchema = z.object({
  app_role: z.string().min(1),
  employee_role: z.string().min(1),
});

const roleFormSchema = z.object({
  description: z.string(),
  name: z.string().min(1).max(50),
});

const roleUpdatePermissionsSchema = z.object({
  id: z.number().int(),
  permissionIds: z.array(z.number().int()),
});

const roleIdSchema = z.object({
  id: z.number().int(),
});

const roleReassignSchema = z.object({
  id: z.number().int(),
  targetRoleId: z.number().int(),
});

const unmappedSubjectsTelemetrySchema = z.object({
  subjects: z.array(z.string()).optional(),
  timestamp: z.string().optional(),
  total: z.number().int().optional(),
});

const rolesResponseSchema = z.object({
  roles: z.array(roleSchema),
});

const permissionsResponseSchema = z.object({
  permissions: z.array(permissionSchema),
});

const roleUsersResponseSchema = z.object({
  users: z.array(roleUserSchema),
});

const roleMappingsResponseSchema = z.object({
  data: z.array(roleMappingSchema),
});

const statusResponseSchema = z.object({
  status: z.literal("ok"),
});

const syncPermissionsResponseSchema = z.object({
  created: z.number().int(),
  details: z.array(z.string()),
  errors: z.array(z.string()).optional(),
  skipped: z.number().int(),
  status: z.literal("ok"),
  total: z.number().int(),
});

const telemetryResponseSchema = z.object({
  skipped: z.boolean().optional(),
  status: z.literal("ok"),
});

const reassignResponseSchema = z.object({
  reassigned: z.number().int(),
  status: z.literal("ok"),
});

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readRoles = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Role");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createRoles = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Role");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateRoles = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Role");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteRoles = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user.id, "delete", "Role");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPermissions = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Permission");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const rolesORPCRouterBase = {
  create: createRoles
    .route({
      method: "POST",
      path: "/",
      summary: "Create role",
      tags: ["Roles"],
    })
    .input(roleFormSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await createRole(input);
      return { status: "ok" as const };
    }),

  delete: deleteRoles
    .route({
      method: "DELETE",
      path: "/{id}",
      summary: "Delete role",
      tags: ["Roles"],
    })
    .input(roleIdSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await deleteRole(input.id);
      return { status: "ok" as const };
    }),

  list: readRoles
    .route({
      method: "GET",
      path: "/",
      summary: "List roles",
      tags: ["Roles"],
    })
    .output(rolesResponseSchema)
    .handler(async () => ({
      roles: await listRoles(),
    })),

  listMappings: readRoles
    .route({
      method: "GET",
      path: "/mappings",
      summary: "List role mappings",
      tags: ["Roles"],
    })
    .output(roleMappingsResponseSchema)
    .handler(async () => ({
      data: await getRoleMappings(),
    })),

  permissions: readPermissions
    .route({
      method: "GET",
      path: "/permissions",
      summary: "List permissions",
      tags: ["Roles"],
    })
    .output(permissionsResponseSchema)
    .handler(async () => ({
      permissions: await listPermissions(),
    })),

  reassignUsers: updateRoles
    .route({
      method: "POST",
      path: "/{id}/reassign",
      summary: "Reassign role users",
      tags: ["Roles"],
    })
    .input(roleReassignSchema)
    .output(reassignResponseSchema)
    .handler(async ({ input }) => {
      const result = await reassignRoleUsers(input.id, input.targetRoleId);
      return { status: "ok" as const, ...result };
    }),

  roleUsers: readRoles
    .route({
      method: "GET",
      path: "/{id}/users",
      summary: "List users assigned to role",
      tags: ["Roles"],
    })
    .input(roleIdSchema)
    .output(roleUsersResponseSchema)
    .handler(async ({ input }) => ({
      users: await listRoleUsers(input.id),
    })),

  saveMapping: updateRoles
    .route({
      method: "POST",
      path: "/mappings",
      summary: "Save role mapping",
      tags: ["Roles"],
    })
    .input(roleMappingSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await saveRoleMapping(input);
      return { status: "ok" as const };
    }),

  syncPermissions: updateRoles
    .route({
      method: "POST",
      path: "/permissions/sync",
      summary: "Sync permissions",
      tags: ["Roles"],
    })
    .output(syncPermissionsResponseSchema)
    .handler(async () => {
      const result = await syncPermissions();
      return { status: "ok" as const, ...result };
    }),

  telemetryUnmappedSubjects: readRoles
    .route({
      method: "POST",
      path: "/telemetry/unmapped-subjects",
      summary: "Record unmapped permission subjects telemetry",
      tags: ["Roles"],
    })
    .input(unmappedSubjectsTelemetrySchema)
    .output(telemetryResponseSchema)
    .handler(async ({ context, input }) => {
      const shouldLog = await shouldLogUnmappedSubjects();
      if (!shouldLog) {
        return { skipped: true, status: "ok" as const };
      }

      logEvent("roles.unmappedSubjects", {
        subjects: input.subjects?.slice(0, 25),
        timestamp: input.timestamp,
        total: input.total ?? input.subjects?.length ?? 0,
        userId: context.user.id,
      });

      return { status: "ok" as const };
    }),

  update: updateRoles
    .route({
      method: "PUT",
      path: "/{id}",
      summary: "Update role",
      tags: ["Roles"],
    })
    .input(
      z.object({
        id: z.number().int(),
        payload: roleFormSchema,
      }),
    )
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await updateRole(input.id, input.payload);
      return { status: "ok" as const };
    }),

  updatePermissions: updateRoles
    .route({
      method: "POST",
      path: "/{id}/permissions",
      summary: "Update role permissions",
      tags: ["Roles"],
    })
    .input(roleUpdatePermissionsSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await assignPermissionsToRole(input.id, input.permissionIds);
      return { status: "ok" as const };
    }),
};

async function shouldLogUnmappedSubjects() {
  const key = "roles:unmapped:lastLog";
  const last = await getSetting(key);
  if (last) {
    const lastDate = new Date(last);
    if (!Number.isNaN(lastDate.getTime())) {
      const hoursSince = (Date.now() - lastDate.getTime()) / 3600000;
      if (hoursSince < 12) {
        return false;
      }
    }
  }

  await updateSetting(key, new Date().toISOString());
  return true;
}

export const rolesORPCRouter = base
  .prefix("/api/orpc/roles")
  .tag("Roles")
  .router(rolesORPCRouterBase);

export const rolesORPCHandler = new SuperJSONRPCHandler(rolesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("roles.orpc", error, {});
    }),
  ],
});

export const rolesOpenAPIHandler = new OpenAPIHandler(rolesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/roles/docs",
      docsTitle: "Bioalergia Roles API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Roles API",
          version: "1.0.0",
        },
      },
      specPath: "/api/orpc/roles/openapi.json",
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("roles.orpc.openapi", error, {});
    }),
  ],
});

export type RolesORPCRouter = typeof rolesORPCRouter;
