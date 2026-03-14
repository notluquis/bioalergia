import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  transactionsInsightsParticipantInsightInputSchema,
  transactionsInsightsParticipantInsightResponseSchema,
  transactionsInsightsParticipantLeaderboardInputSchema,
  transactionsInsightsParticipantsResponseSchema,
  transactionsInsightsStatsQuerySchema,
  transactionsInsightsStatsResponseSchema,
} from "@finanzas/orpc-contracts/transactions-insights";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  getParticipantInsight,
  getParticipantLeaderboard,
  getTransactionStats,
} from "../services/transactions";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type TransactionsInsightsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<TransactionsInsightsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readTransactionsInsights = authed.use(async ({ context, next }) => {
  const canReadTransactions = await hasPermission(context.user.id, "read", "Transaction");
  const canReadList = await hasPermission(context.user.id, "read", "TransactionList");
  const canReadStats = await hasPermission(context.user.id, "read", "TransactionStats");

  if (!canReadTransactions && !canReadList && !canReadStats) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const transactionsInsightsORPCRouterBase = {
  participantInsight: readTransactionsInsights
    .route({ method: "GET", path: "/participants/{id}" })
    .input(transactionsInsightsParticipantInsightInputSchema)
    .output(transactionsInsightsParticipantInsightResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof transactionsInsightsParticipantInsightInputSchema> }) => {
      const result = await getParticipantInsight(input.id, {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      });

      return {
        ...result,
        status: "ok" as const,
      };
    }),

  participants: readTransactionsInsights
    .route({ method: "GET", path: "/participants" })
    .input(transactionsInsightsParticipantLeaderboardInputSchema)
    .output(transactionsInsightsParticipantsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof transactionsInsightsParticipantLeaderboardInputSchema> }) => {
      const result = await getParticipantLeaderboard({
        from: input.from ? new Date(input.from) : undefined,
        limit: input.limit,
        mode: input.mode,
        to: input.to ? new Date(input.to) : undefined,
      });

      return {
        ...result,
        status: "ok" as const,
      };
    }),

  stats: readTransactionsInsights
    .route({ method: "GET", path: "/stats" })
    .input(transactionsInsightsStatsQuerySchema)
    .output(transactionsInsightsStatsResponseSchema)
    .handler(async ({ input }: { input: z.input<typeof transactionsInsightsStatsQuerySchema> }) => {
      const result = await getTransactionStats({
        from: new Date(input.from),
        to: new Date(input.to),
      });

      return {
        ...result,
        byType: result.byType.map((item) => ({
          ...item,
          description: item.description ?? null,
          direction: item.direction as "IN" | "NEUTRO" | "OUT",
        })),
        status: "ok" as const,
      };
    }),
};

export const transactionsInsightsORPCRouter = base
  .prefix("/api/orpc/transactions-insights")
  .router(transactionsInsightsORPCRouterBase);

export const transactionsInsightsORPCHandler = new SuperJSONRPCHandler(
  transactionsInsightsORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError(error, {
          module: "api",
          operation: "orpc.transactions-insights",
        });
      }),
    ],
  },
);

export const transactionsInsightsOpenAPIHandler = new OpenAPIHandler(
  transactionsInsightsORPCRouter,
  {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specGenerateOptions: {
          info: {
            title: "Bioalergia Transactions Insights oRPC",
            description:
              "Contratos oRPC/OpenAPI para estadísticas y participants de transacciones.",
            version: "1.0.0",
          },
        },
      }),
    ],
    interceptors: [
      onError((error) => {
        logError(error, {
          module: "api",
          operation: "openapi.transactions-insights",
        });
      }),
    ],
  },
);

export type TransactionsInsightsORPCRouter = typeof transactionsInsightsORPCRouter;
