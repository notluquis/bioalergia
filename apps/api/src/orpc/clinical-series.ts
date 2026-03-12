import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
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
  rebuildClinicalSeries,
} from "../services/clinical-series";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type ClinicalSeriesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ClinicalSeriesORPCContext>();

const kindSchema = z.enum(["PATCH_TEST", "SKIN_TEST", "SUBCUTANEOUS_TREATMENT"]);
const statusSchema = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);

const clinicalSeriesEventSchema = z.object({
  amountExpected: z.number().nullable(),
  amountPaid: z.number().nullable(),
  calendarGoogleId: z.string(),
  eventDate: z.string(),
  eventId: z.number(),
  externalEventId: z.string(),
  seriesStageKind: z.enum(["DOSE", "INSTALLATION", "MAINTENANCE", "READING"]).nullable(),
  seriesStageLabel: z.string().nullable(),
  seriesStageNumber: z.number().nullable(),
  summary: z.string().nullable(),
});

const clinicalSeriesLinkedDocumentSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  confidenceScore: z.number(),
  documentDate: z.string(),
  dteSaleDetailId: z.string(),
  folio: z.string(),
  matchedBy: z.string(),
  totalAmount: z.number(),
});

const clinicalSeriesSnapshotSchema = z.object({
  displayName: z.string().nullable(),
  eligibleDocumentDateFrom: z.string(),
  eligibleDocumentDateTo: z.string(),
  events: z.array(clinicalSeriesEventSchema),
  id: z.number(),
  kind: kindSchema,
  linkedDocuments: z.array(clinicalSeriesLinkedDocumentSchema),
  patientName: z.string().nullable(),
  patientRut: z.string().nullable(),
  remainingExpected: z.number(),
  remainingPaid: z.number(),
  status: statusSchema,
  totalExpected: z.number(),
  totalLinkedAmount: z.number(),
  totalPaid: z.number(),
});

const listInputSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  kind: kindSchema.optional(),
  patientName: z.string().optional(),
  patientRut: z.string().optional(),
  status: statusSchema.optional(),
});

const detailInputSchema = z.object({
  id: z.number().int().positive(),
});

const rebuildInputSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const rebuildResponseSchema = z.object({
  from: z.string().nullable(),
  processed: z.number(),
  to: z.string().nullable(),
});

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
    .route({
      method: "GET",
      path: "/{id}",
      summary: "Get clinical series detail",
      tags: ["ClinicalSeries"],
    })
    .input(detailInputSchema)
    .output(clinicalSeriesSnapshotSchema)
    .handler(async ({ input }) => {
      const snapshot = await getClinicalSeriesSnapshotById(input.id);
      if (!snapshot) {
        throw new ORPCError("NOT_FOUND", { message: "Serie clínica no encontrada" });
      }
      return snapshot;
    }),

  list: readClinicalSeries
    .route({
      method: "GET",
      path: "/",
      summary: "List clinical series",
      tags: ["ClinicalSeries"],
    })
    .input(listInputSchema)
    .output(z.array(clinicalSeriesSnapshotSchema))
    .handler(async ({ input }) => {
      return await listClinicalSeriesSnapshots(input);
    }),

  rebuild: updateClinicalSeries
    .route({
      method: "POST",
      path: "/rebuild",
      summary: "Rebuild clinical series",
      tags: ["ClinicalSeries"],
    })
    .input(rebuildInputSchema)
    .output(rebuildResponseSchema)
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
