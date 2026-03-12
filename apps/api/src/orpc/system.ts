import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type SystemORPCContext = {
  hono: HonoContext;
};

const base = os.$context<SystemORPCContext>();

const healthResponseSchema = z.object({
  checks: z.object({
    db: z.object({
      latency: z.number().nullable(),
      message: z.string().optional(),
      status: z.enum(["error", "ok"]),
    }),
  }),
  status: z.enum(["degraded", "error", "ok"]),
  timestamp: z.coerce.date(),
});

const systemORPCRouterBase = {
  health: base
    .route({
      method: "GET",
      path: "/health",
      summary: "Get system health summary",
      tags: ["System"],
    })
    .output(healthResponseSchema)
    .handler(async () => ({
      checks: {
        db: {
          latency: null,
          status: "ok" as const,
        },
      },
      status: "ok" as const,
      timestamp: new Date(),
    })),
};

export const systemORPCRouter = base.prefix("/api/orpc/system").router(systemORPCRouterBase);

export const systemORPCHandler = new SuperJSONRPCHandler(systemORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.system",
      });
    }),
  ],
});

export const systemOpenAPIHandler = new OpenAPIHandler(systemORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia System oRPC",
          description: "Contratos oRPC/OpenAPI para estado del sistema.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.system",
      });
    }),
  ],
});

export type SystemORPCRouter = typeof systemORPCRouter;
