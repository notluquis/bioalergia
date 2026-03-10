import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type SettingsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<SettingsORPCContext>();

const internalSettingsSchema = z.object({
  envUpsertChunkSize: z.string().optional(),
  upsertChunkSize: z.union([z.number(), z.string()]).optional(),
});

const internalSettingsResponseSchema = z.object({
  internal: internalSettingsSchema,
});

const updateInternalSettingsSchema = z.object({
  upsertChunkSize: z.number().optional(),
});

const statusResponseSchema = z.object({
  message: z.string().optional(),
  status: z.string(),
});

const uploadAssetSchema = z.object({
  assetType: z.enum(["favicon", "logo"]),
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

const readSettings = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateSettings = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const settingsORPCRouterBase = {
  internal: readSettings
    .route({
      method: "GET",
      path: "/internal",
      summary: "Get internal settings",
      tags: ["Settings"],
    })
    .output(internalSettingsResponseSchema)
    .handler(async () => {
      const settings = await db.setting.findMany({
        where: { key: { in: ["internal.upsertChunkSize"] } },
      });

      const upsertChunkSize = settings.find(
        (setting) => setting.key === "internal.upsertChunkSize",
      )?.value;

      return {
        internal: {
          upsertChunkSize: upsertChunkSize ? Number(upsertChunkSize) : undefined,
          envUpsertChunkSize: process.env.BIOALERGIA_UPSERT_CHUNK_SIZE || undefined,
        },
      };
    }),

  updateInternal: updateSettings
    .route({
      method: "PUT",
      path: "/internal",
      summary: "Update internal settings",
      tags: ["Settings"],
    })
    .input(updateInternalSettingsSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      if (input.upsertChunkSize !== undefined) {
        await db.setting.upsert({
          where: { key: "internal.upsertChunkSize" },
          update: { value: String(input.upsertChunkSize) },
          create: {
            key: "internal.upsertChunkSize",
            value: String(input.upsertChunkSize),
          },
        });
      } else {
        await db.setting.deleteMany({
          where: { key: "internal.upsertChunkSize" },
        });
      }

      return { status: "ok" };
    }),

  uploadAsset: updateSettings
    .route({
      method: "POST",
      path: "/branding/upload",
      summary: "Placeholder branding upload endpoint",
      tags: ["Settings"],
    })
    .input(uploadAssetSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => ({
      message: `${input.assetType} upload not implemented yet`,
      status: "error",
    })),
};

export const settingsORPCRouter = base.router(settingsORPCRouterBase).prefix("/api/orpc/settings");

export const settingsORPCHandler = new SuperJSONRPCHandler(settingsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.settings",
      });
    }),
  ],
});

export const settingsOpenAPIHandler = new OpenAPIHandler(settingsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/settings/docs",
      specPath: "/api/orpc/settings/openapi.json",
      theme: "saturn",
      favicon: "https://orpc.dev/icon.svg",
      layout: "modern",
      meta: {
        title: "Bioalergia Settings oRPC",
        description: "Contratos oRPC/OpenAPI para configuración interna.",
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.settings",
      });
    }),
  ],
  schemaConverters: [new ZodToJsonSchemaConverter()],
});
