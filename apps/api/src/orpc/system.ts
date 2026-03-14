import { systemHealthResponseSchema } from "@finanzas/orpc-contracts/system";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type SystemORPCContext = {
  hono: HonoContext;
};

const base = os.$context<SystemORPCContext>();

const systemORPCRouterBase = {
  health: base
    .route({ method: "GET", path: "/health" })
    .output(systemHealthResponseSchema)
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
