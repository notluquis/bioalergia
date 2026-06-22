import { pollenForecastResponseSchema } from "@finanzas/orpc-contracts/pollen";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { getCachedForecast } from "../services/pollen.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type PollenORPCContext = { hono: HonoContext };
const base = os.$context<PollenORPCContext>();

const pollenRouterBase = {
  // Público (sin auth): el sitio lee el cache; nunca llama a Google directo.
  getForecast: base
    .route({ method: "GET", path: "/forecast", tags: ["Pollen"] })
    .output(pollenForecastResponseSchema)
    .handler(async () => getCachedForecast()),
};

export const pollenORPCRouter = base.prefix("/api/orpc/pollen").router(pollenRouterBase);

export const pollenORPCHandler = new SuperJSONRPCHandler(pollenORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.pollen" });
    }),
  ],
});

export const pollenOpenAPIHandler = new OpenAPIHandler(pollenORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Pollen oRPC",
          description: "Pronóstico de polen para Concepción (gramíneas en vivo + calendario).",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.pollen" });
    }),
  ],
});

export type PollenORPCRouter = typeof pollenORPCRouter;
