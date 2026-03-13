import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { rolesContract } from "@finanzas/orpc-contracts/roles";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
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
    .route(rolesContract.create)
    .handler(async ({ input }) => {
      await createRole(input);
      return { status: "ok" as const };
    }),

  delete: deleteRoles
    .route(rolesContract.delete)
    .handler(async ({ input }) => {
      await deleteRole(input.id);
      return { status: "ok" as const };
    }),

  list: readRoles
    .route(rolesContract.list)
    .handler(async () => ({
      roles: await listRoles(),
    })),

  listMappings: readRoles
    .route(rolesContract.listMappings)
    .handler(async () => ({
      data: await getRoleMappings(),
    })),

  permissions: readPermissions
    .route(rolesContract.permissions)
    .handler(async () => ({
      permissions: await listPermissions(),
    })),

  reassignUsers: updateRoles
    .route(rolesContract.reassignUsers)
    .handler(async ({ input }) => {
      const result = await reassignRoleUsers(input.id, input.targetRoleId);
      return { status: "ok" as const, ...result };
    }),

  roleUsers: readRoles
    .route(rolesContract.roleUsers)
    .handler(async ({ input }) => ({
      users: await listRoleUsers(input.id),
    })),

  saveMapping: updateRoles
    .route(rolesContract.saveMapping)
    .handler(async ({ input }) => {
      await saveRoleMapping(input);
      return { status: "ok" as const };
    }),

  syncPermissions: updateRoles
    .route(rolesContract.syncPermissions)
    .handler(async () => {
      const result = await syncPermissions();
      return { status: "ok" as const, ...result };
    }),

  telemetryUnmappedSubjects: readRoles
    .route(rolesContract.telemetryUnmappedSubjects)
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
    .route(rolesContract.update)
    .handler(async ({ input }) => {
      await updateRole(input.id, input.payload);
      return { status: "ok" as const };
    }),

  updatePermissions: updateRoles
    .route(rolesContract.updatePermissions)
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
