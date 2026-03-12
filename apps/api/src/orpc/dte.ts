import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { getDTESyncHistory, syncDTEs } from "../services/dte-sync";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type DTEORPCContext = {
  hono: HonoContext;
};

const base = os.$context<DTEORPCContext>();

const syncHistoryInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

const syncInputSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).optional(),
  period: z.string().optional(),
});

const syncLogSchema = z.object({
  completedAt: z.date().nullable().optional(),
  docTypes: z.string(),
  errorMessage: z.string().nullable().optional(),
  id: z.string(),
  period: z.string(),
  purchasesInserted: z.number().nullable().optional(),
  salesInserted: z.number().nullable().optional(),
  startedAt: z.date(),
  status: z.string(),
  totalInserted: z.number().nullable().optional(),
  totalProcessed: z.number().nullable().optional(),
  totalSkipped: z.number().nullable().optional(),
  totalUpdated: z.number().nullable().optional(),
  triggerSource: z.string().nullable().optional(),
});

const syncHistoryResponseSchema = z.object({
  logs: z.array(syncLogSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }),
});

const syncResultSchema = z.object({
  docType: z.string(),
  inserted: z.number(),
  processed: z.number(),
  status: z.string(),
  updated: z.number(),
});

const syncResponseSchema = z.object({
  logId: z.string(),
  period: z.string(),
  results: z.array(syncResultSchema),
  status: z.enum(["failed", "partial", "success"]),
});

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  return next({ context: { ...context, user } });
});

const readDTE = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "DTESyncLog");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const createDTE = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "DTESyncLog");
  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const dteORPCRouterBase = {
  sync: createDTE
    .route({
      method: "POST",
      path: "/sync",
      summary: "Trigger DTE sync",
      tags: ["DTE"],
    })
    .input(syncInputSchema)
    .output(syncResponseSchema)
    .handler(async ({ context, input }) => {
      return await syncDTEs({
        docTypes: input.docTypes,
        period: input.period,
        triggerSource: "user",
        triggerUserId: String(context.user.id),
      });
    }),

  syncHistory: readDTE
    .route({
      method: "GET",
      path: "/sync-history",
      summary: "List DTE sync history",
      tags: ["DTE"],
    })
    .input(syncHistoryInputSchema)
    .output(syncHistoryResponseSchema)
    .handler(async ({ input }) => {
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;
      const { logs, total } = await getDTESyncHistory(limit, offset);

      return {
        logs: logs.map((log) => ({
          completedAt: log.completedAt,
          docTypes: log.docTypes,
          errorMessage: log.errorMessage,
          id: log.id,
          period: log.period,
          purchasesInserted: log.purchasesInserted,
          salesInserted: log.salesInserted,
          startedAt: log.startedAt,
          status: log.status,
          totalInserted: log.totalInserted,
          totalProcessed: log.totalProcessed,
          totalSkipped: log.totalSkipped,
          totalUpdated: log.totalUpdated,
          triggerSource: log.triggerSource,
        })),
        pagination: {
          limit,
          offset,
          total,
        },
      };
    }),
};

export const dteORPCRouter = base.prefix("/api/orpc/dte").tag("DTE").router(dteORPCRouterBase);

export const dteORPCHandler = new SuperJSONRPCHandler(dteORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("dte.orpc", error, {
        module: "api",
        operation: "orpc.dte",
      });
    }),
  ],
});

export const dteOpenAPIHandler = new OpenAPIHandler(dteORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia DTE API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia DTE API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("dte.openapi", error, {
        module: "api",
        operation: "openapi.dte",
      });
    }),
  ],
});

export type DteORPCRouter = typeof dteORPCRouter;
