import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  fetchCgeBillInputSchema,
  fetchCgeBillResponseSchema,
  fetchEssbioBillInputSchema,
  fetchEssbioBillResponseSchema,
} from "@finanzas/orpc-contracts/utility-bills";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { fetchCgeBillWithCredentials, fetchEssbioBill } from "../services/utility-bills";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type UtilityBillsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<UtilityBillsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({ context: { ...context, user } });
});

const utilityBillsRouterBase = {
  fetchEssbio: authed
    .route({ method: "POST", path: "/essbio" })
    .input(fetchEssbioBillInputSchema)
    .output(fetchEssbioBillResponseSchema)
    .handler(async ({ input }) => {
      const bill = await fetchEssbioBill(input.serviceNumber);
      return { bill, status: "ok" as const };
    }),

  fetchCge: authed
    .route({ method: "POST", path: "/cge" })
    .input(fetchCgeBillInputSchema)
    .output(fetchCgeBillResponseSchema)
    .handler(async ({ input }) => {
      const bill = await fetchCgeBillWithCredentials(
        input.accountNumber,
        input.rut,
        input.password,
      );
      return { bill, status: "ok" as const };
    }),
};

export const utilityBillsORPCRouter = base
  .prefix("/api/orpc/utility-bills")
  .router(utilityBillsRouterBase);

export const utilityBillsORPCHandler = new SuperJSONRPCHandler(utilityBillsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.utility-bills",
      });
    }),
  ],
});

export const utilityBillsOpenAPIHandler = new OpenAPIHandler(utilityBillsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Utility Bills oRPC",
          description: "Essbio and CGE bill lookup endpoints.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.utility-bills",
      });
    }),
  ],
});

export type UtilityBillsORPCRouter = typeof utilityBillsORPCRouter;
