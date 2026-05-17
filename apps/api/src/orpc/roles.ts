import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  rolesPermissionsResponseSchema,
  rolesReassignResponseSchema,
  rolesResponseSchema,
  rolesRoleFormSchema,
  rolesRoleIdSchema,
  rolesRoleMappingSchema,
  rolesRoleMappingsResponseSchema,
  rolesRoleReassignSchema,
  rolesRoleUpdatePermissionsSchema,
  rolesRoleUsersResponseSchema,
  rolesStatusResponseSchema,
  rolesSyncPermissionsResponseSchema,
  rolesTelemetryResponseSchema,
  rolesUnmappedSubjectsTelemetrySchema,
} from "@finanzas/orpc-contracts/roles";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
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
} from "../services/roles.ts";
import { getSetting, updateSetting } from "../services/settings.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type RolesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<RolesORPCContext>();

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
  const canRead = await hasPermission(context.user, "read", "Role");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createRoles = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Role");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateRoles = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Role");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteRoles = authed.use(async ({ context, next }) => {
  const canDelete = await hasPermission(context.user, "delete", "Role");

  if (!canDelete) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPermissions = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Permission");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const rolesORPCRouterBase = {
  create: createRoles
    .route({ method: "POST", path: "/", summary: "Create a role", tags: ["Roles"] })
    .input(rolesRoleFormSchema)
    .output(rolesStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof rolesRoleFormSchema> }) => {
      await createRole(input);
      return { status: "ok" as const };
    }),

  delete: deleteRoles
    .route({ method: "DELETE", path: "/{id}", summary: "Delete a role", tags: ["Roles"] })
    .input(rolesRoleIdSchema)
    .output(rolesStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof rolesRoleIdSchema> }) => {
      await deleteRole(input.id);
      return { status: "ok" as const };
    }),

  list: readRoles
    .route({ method: "GET", path: "/", summary: "List roles", tags: ["Roles"] })
    .output(rolesResponseSchema)
    .handler(async () => ({
      roles: await listRoles(),
    })),

  listMappings: readRoles
    .route({ method: "GET", path: "/mappings", summary: "List role mappings", tags: ["Roles"] })
    .output(rolesRoleMappingsResponseSchema)
    .handler(async () => ({
      data: await getRoleMappings(),
    })),

  permissions: readPermissions
    .route({ method: "GET", path: "/permissions", summary: "List permissions", tags: ["Roles"] })
    .output(rolesPermissionsResponseSchema)
    .handler(async () => ({
      permissions: await listPermissions(),
    })),

  reassignUsers: updateRoles
    .route({
      method: "POST",
      path: "/{id}/reassign",
      summary: "Reassign users from one role to another",
      tags: ["Roles"],
    })
    .input(rolesRoleReassignSchema)
    .output(rolesReassignResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof rolesRoleReassignSchema> }) => {
      const result = await reassignRoleUsers(input.id, input.targetRoleId);
      return { status: "ok" as const, ...result };
    }),

  roleUsers: readRoles
    .route({
      method: "GET",
      path: "/{id}/users",
      summary: "List users assigned to a role",
      tags: ["Roles"],
    })
    .input(rolesRoleIdSchema)
    .output(rolesRoleUsersResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof rolesRoleIdSchema> }) => ({
      users: await listRoleUsers(input.id),
    })),

  saveMapping: updateRoles
    .route({ method: "POST", path: "/mappings", summary: "Save a role mapping", tags: ["Roles"] })
    .input(rolesRoleMappingSchema)
    .output(rolesStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof rolesRoleMappingSchema> }) => {
      await saveRoleMapping(input);
      return { status: "ok" as const };
    }),

  syncPermissions: updateRoles
    .route({
      method: "POST",
      path: "/permissions/sync",
      summary: "Sync permissions from CASL subjects/actions",
      tags: ["Roles"],
    })
    .output(rolesSyncPermissionsResponseSchema)
    .handler(async () => {
      const result = await syncPermissions();
      return { status: "ok" as const, ...result };
    }),

  telemetryUnmappedSubjects: readRoles
    .route({
      method: "POST",
      path: "/telemetry/unmapped-subjects",
      summary: "Report unmapped CASL subjects telemetry",
      tags: ["Roles"],
    })
    .input(rolesUnmappedSubjectsTelemetrySchema)
    .output(rolesTelemetryResponseSchema)
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
    .route({ method: "PUT", path: "/{id}", summary: "Update a role", tags: ["Roles"] })
    .input(z.object({ id: z.number().int(), payload: rolesRoleFormSchema }))
    .output(rolesStatusResponseSchema)
    .handler(
      async ({
        input,
      }: {
        input: { id: number; payload: z.input<typeof rolesRoleFormSchema> };
      }) => {
        await updateRole(input.id, input.payload);
        return { status: "ok" as const };
      }
    ),

  updatePermissions: updateRoles
    .route({
      method: "POST",
      path: "/{id}/permissions",
      summary: "Replace role permissions",
      tags: ["Roles"],
    })
    .input(rolesRoleUpdatePermissionsSchema)
    .output(rolesStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof rolesRoleUpdatePermissionsSchema> }) => {
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
      docsTitle: "Bioalergia Roles API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Roles API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("roles.orpc.openapi", error, {});
    }),
  ],
});

export type RolesORPCRouter = typeof rolesORPCRouter;
