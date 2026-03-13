import { db } from "@finanzas/db";
import { settingsContract, settingsSchema } from "@finanzas/orpc-contracts/settings";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { type AppSettings, settingsKeyToDbKey } from "../lib/settings";
import { configureSuperjson } from "../lib/superjson-config";
import { loadSettings, updateSettings as persistSettings } from "../services/settings";
import { SuperJSONRPCHandler } from "./superjson";

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
  app: readSettings
    .route(settingsContract.app)
    .handler(async () => {
      return await loadSettings();
    }),

  updateApp: updateSettings
    .route(settingsContract.updateApp)
    .handler(async ({ input }) => {
      const payload = Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[settingsKeyToDbKey(key as keyof AppSettings)] = value;
        return acc;
      }, {});

      await persistSettings(payload);
      return { status: "ok" };
    }),

  internal: readSettings
    .route(settingsContract.internal)
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
    .route(settingsContract.updateInternal)
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
    .route(settingsContract.uploadAsset)
    .handler(async ({ input }) => ({
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
