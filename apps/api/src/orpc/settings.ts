import { db } from "@finanzas/db";
import {
  settingsInternalResponseSchema,
  settingsSchema,
  settingsStatusResponseSchema,
  settingsUpdateInternalSchema,
  settingsUploadAssetSchema,
} from "@finanzas/orpc-contracts/settings";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { type AppSettings, settingsKeyToDbKey } from "../lib/settings.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { loadSettings, updateSettings as persistSettings } from "../services/settings.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type SettingsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<SettingsORPCContext>();

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
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateSettings = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const settingsORPCRouterBase = {
  app: readSettings
    .route({ method: "GET", path: "/app" })
    .output(settingsSchema)
    .handler(async () => {
      return await loadSettings();
    }),

  updateApp: updateSettings
    .route({ method: "PUT", path: "/app" })
    .input(settingsSchema)
    .output(settingsStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof settingsSchema> }) => {
      const payload = Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[settingsKeyToDbKey(key as keyof AppSettings)] = value;
        return acc;
      }, {});

      await persistSettings(payload);
      return { status: "ok" };
    }),

  internal: readSettings
    .route({ method: "GET", path: "/internal" })
    .output(settingsInternalResponseSchema)
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
    .route({ method: "PUT", path: "/internal" })
    .input(settingsUpdateInternalSchema)
    .output(settingsStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof settingsUpdateInternalSchema> }) => {
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
    .route({ method: "POST", path: "/branding/upload" })
    .input(settingsUploadAssetSchema)
    .output(settingsStatusResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof settingsUploadAssetSchema> }) => ({
      message: `${input.assetType} upload not implemented yet`,
      status: "error",
    })),
};

export const settingsORPCRouter = base.prefix("/api/orpc/settings").router(settingsORPCRouterBase);

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
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Settings oRPC",
          description: "Contratos oRPC/OpenAPI para configuración interna.",
          version: "1.0.0",
        },
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
});

export type SettingsORPCRouter = typeof settingsORPCRouter;
