import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { clinicalSeriesContract } from "@finanzas/orpc-contracts/clinical-series";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  getClinicalSeriesSnapshotById,
  listClinicalSeriesSnapshots,
  rebuildClinicalSeries,
} from "../services/clinical-series";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type ClinicalSeriesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ClinicalSeriesORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const readClinicalSeries = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "CalendarEvent");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const updateClinicalSeries = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "CalendarEvent");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const clinicalSeriesORPCRouterBase = {
  detail: readClinicalSeries
    .route(clinicalSeriesContract.detail)
    .handler(async ({ input }) => {
      const snapshot = await getClinicalSeriesSnapshotById(input.id);
      if (!snapshot) {
        throw new ORPCError("NOT_FOUND", { message: "Serie clínica no encontrada" });
      }
      return snapshot;
    }),

  list: readClinicalSeries
    .route(clinicalSeriesContract.list)
    .handler(async ({ input }) => {
      return await listClinicalSeriesSnapshots(input);
    }),

  rebuild: updateClinicalSeries
    .route(clinicalSeriesContract.rebuild)
    .handler(async ({ input }) => {
      return await rebuildClinicalSeries(input);
    }),
};

export const clinicalSeriesORPCRouter = base
  .prefix("/api/orpc/clinical-series")
  .router(clinicalSeriesORPCRouterBase);

export const clinicalSeriesORPCHandler = new SuperJSONRPCHandler(clinicalSeriesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.clinical-series",
      });
    }),
  ],
});

export const clinicalSeriesOpenAPIHandler = new OpenAPIHandler(clinicalSeriesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Clinical Series oRPC",
          description: "Contratos oRPC/OpenAPI para series clínicas.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.clinical-series",
      });
    }),
  ],
});

export type ClinicalSeriesORPCRouter = typeof clinicalSeriesORPCRouter;
