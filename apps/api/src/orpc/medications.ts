import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  medicationSearchInputSchema,
  medicationSearchResponseSchema,
} from "@finanzas/orpc-contracts/medications";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { searchMedications } from "../services/medications.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type MedicationsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<MedicationsORPCContext>();

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

const medicationsORPCRouterBase = {
  search: authed
    .route({ method: "GET", path: "/search" })
    .input(medicationSearchInputSchema)
    .output(medicationSearchResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof medicationSearchInputSchema> }) => {
      const results = await searchMedications(input.q, input.limit);

      return { results };
    }),
};

export const medicationsORPCRouter = base
  .prefix("/api/orpc/medications")
  .router(medicationsORPCRouterBase);

export const medicationsORPCHandler = new SuperJSONRPCHandler(medicationsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.medications",
      });
    }),
  ],
});

export const medicationsOpenAPIHandler = new OpenAPIHandler(medicationsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Medications oRPC",
          description: "Contrato oRPC/OpenAPI para el catálogo de medicamentos.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.medications",
      });
    }),
  ],
});

export type MedicationsORPCRouter = typeof medicationsORPCRouter;
