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

const statsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

const participantLeaderboardSchema = z.object({
  from: z.string().optional(),
  limit: z.number().int().positive().optional(),
  mode: z.enum(["combined", "incoming", "outgoing"]).optional(),
  to: z.string().optional(),
});

const participantInsightSchema = z.object({
  from: z.string().optional(),
  id: z.string().min(1),
  to: z.string().optional(),
});

const statusDataResponseSchema = z.object({
  data: z.unknown(),
  status: z.literal("ok"),
});

const participantInsightResponseSchema = z.object({
  counterparts: z.array(z.unknown()),
  monthly: z.array(z.unknown()),
  participant: z.string(),
  status: z.literal("ok"),
});

const statsResponseSchema = z.object({
  byType: z.array(z.unknown()),
  monthly: z.array(z.unknown()),
  status: z.literal("ok"),
  totals: z.record(z.string(), z.number()),
});

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
    .route({ method: "GET", path: "/participants/{id}", tags: ["Transactions Insights"] })
    .input(participantInsightSchema)
    .output(participantInsightResponseSchema)
    .handler(async ({ input }) =>
      getParticipantInsight(input.id, {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      }),
    ),

  participants: readTransactionsInsights
    .route({ method: "GET", path: "/participants", tags: ["Transactions Insights"] })
    .input(participantLeaderboardSchema)
    .output(statusDataResponseSchema)
    .handler(async ({ input }) =>
      getParticipantLeaderboard({
        from: input.from ? new Date(input.from) : undefined,
        limit: input.limit,
        mode: input.mode,
        to: input.to ? new Date(input.to) : undefined,
      }),
    ),

  stats: readTransactionsInsights
    .route({ method: "GET", path: "/stats", tags: ["Transactions Insights"] })
    .input(statsQuerySchema)
    .output(statsResponseSchema)
    .handler(async ({ input }) =>
      getTransactionStats({
        from: new Date(input.from),
        to: new Date(input.to),
      }),
    ),
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
