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
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  linkDTEToExpense,
  reconcileUnmatchedDTEs,
  tryMatchDTEPurchaseToExpense,
  unlinkDTE,
} from "../services/dte-expense-matcher.ts";
import { getDTESyncHistory, syncDTEs } from "../services/dte-sync.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

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

  // ─── DTE → Expense matcher endpoints ───────────────────────────────────
  reconcileUnmatched: createDTE
    .route({
      method: "POST",
      path: "/reconcile-unmatched",
      summary: "Match unmatched DTE purchases to expense services",
      tags: ["DTE", "Matcher"],
    })
    .input(
      z.object({
        daysBack: z.number().int().min(1).max(730).optional().default(90),
        limit: z.number().int().min(1).max(2000).optional().default(500),
      })
    )
    .output(
      z.object({
        results: z.array(
          z.object({
            dteId: z.string(),
            expenseId: z.number().int().nullable(),
            reason: z.string(),
            status: z.enum([
              "ALREADY_LINKED",
              "CREATED_EXPENSE",
              "LINKED_EXISTING",
              "NO_MATCH",
              "ERROR",
            ]),
          })
        ),
        summary: z.object({
          alreadyLinked: z.number().int(),
          createdExpense: z.number().int(),
          error: z.number().int(),
          linkedExisting: z.number().int(),
          noMatch: z.number().int(),
          total: z.number().int(),
        }),
      })
    )
    .handler(async ({ input }) => {
      return reconcileUnmatchedDTEs({ daysBack: input.daysBack, limit: input.limit });
    }),

  retryMatch: createDTE
    .route({
      method: "POST",
      path: "/retry-match",
      summary: "Retry matching a single DTE to an Expense",
      tags: ["DTE", "Matcher"],
    })
    .input(z.object({ dteId: z.string() }))
    .output(
      z.object({
        dteId: z.string(),
        expenseId: z.number().int().nullable(),
        reason: z.string(),
        status: z.enum([
          "ALREADY_LINKED",
          "CREATED_EXPENSE",
          "LINKED_EXISTING",
          "NO_MATCH",
          "ERROR",
        ]),
      })
    )
    .handler(async ({ input }) => {
      return tryMatchDTEPurchaseToExpense(input.dteId);
    }),

  linkExpense: createDTE
    .route({
      method: "POST",
      path: "/link-expense",
      summary: "Manually link a DTE to an Expense",
      tags: ["DTE", "Matcher"],
    })
    .input(z.object({ dteId: z.string(), expenseId: z.number().int() }))
    .output(
      z.object({
        dteId: z.string(),
        expenseId: z.number().int().nullable(),
        reason: z.string(),
        status: z.string(),
      })
    )
    .handler(async ({ input }) => {
      return linkDTEToExpense(input.dteId, input.expenseId);
    }),

  unlinkExpense: createDTE
    .route({
      method: "POST",
      path: "/unlink-expense",
      summary: "Remove DTE → Expense link",
      tags: ["DTE", "Matcher"],
    })
    .input(z.object({ dteId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ input }) => {
      await unlinkDTE(input.dteId);
      return { success: true };
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
