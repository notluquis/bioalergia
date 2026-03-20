import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  dteSyncHistoryInputSchema,
  dteSyncHistoryResponseSchema,
  dteSyncInputSchema,
  dteSyncResponseSchema,
} from "@finanzas/orpc-contracts/dte";
import type { Context as HonoContext } from "hono";
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

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  return next({ context: { ...context, user } });
});

const readDTE = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "DTESyncLog");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const createDTE = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "DTESyncLog");
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
    .input(dteSyncInputSchema)
    .output(dteSyncResponseSchema)
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
    .input(dteSyncHistoryInputSchema)
    .output(dteSyncHistoryResponseSchema)
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
