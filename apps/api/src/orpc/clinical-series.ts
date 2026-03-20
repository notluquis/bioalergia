import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  clinicalSeriesDetailInputSchema,
  clinicalSeriesListInputSchema,
  clinicalSeriesListOutputSchema,
  clinicalSeriesRebuildInputSchema,
  clinicalSeriesRebuildResponseSchema,
  clinicalSeriesSnapshotSchema,
} from "@finanzas/orpc-contracts/clinical-series";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  getClinicalSeriesSnapshotById,
  listClinicalSeriesSnapshots,
  startRebuildClinicalSeries,
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
  const canRead = await hasPermission(context.user, "read", "ClinicalSeries");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const updateClinicalSeries = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "ClinicalSeries");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const clinicalSeriesORPCRouterBase = {
  detail: readClinicalSeries
    .route({ method: "GET", path: "/{id}" })
    .input(clinicalSeriesDetailInputSchema)
    .output(clinicalSeriesSnapshotSchema)
    .handler(async ({ input }: { input: z.input<typeof clinicalSeriesDetailInputSchema> }) => {
      const snapshot = await getClinicalSeriesSnapshotById(input.id);
      if (!snapshot) {
        throw new ORPCError("NOT_FOUND", { message: "Serie clínica no encontrada" });
      }
      return snapshot;
    }),

  list: readClinicalSeries
    .route({ method: "GET", path: "/" })
    .input(clinicalSeriesListInputSchema)
    .output(clinicalSeriesListOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof clinicalSeriesListInputSchema> }) => {
      return await listClinicalSeriesSnapshots(input);
    }),

  rebuild: updateClinicalSeries
    .route({ method: "POST", path: "/rebuild" })
    .input(clinicalSeriesRebuildInputSchema)
    .output(clinicalSeriesRebuildResponseSchema)
    .handler(({ input }: { input: z.input<typeof clinicalSeriesRebuildInputSchema> }) => {
      const jobId = startRebuildClinicalSeries(input);
      return { jobId, message: "Reorganización iniciada" };
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
