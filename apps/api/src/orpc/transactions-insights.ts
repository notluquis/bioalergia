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

const participantLeaderboardItemSchema = z.object({
  count: z.number(),
  personId: z.string(),
  personName: z.string(),
  total: z.number(),
});

const participantCounterpartSchema = z.object({
  bankAccountHolder: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountType: z.string().nullable(),
  bankBranch: z.string().nullable(),
  bankName: z.string().nullable(),
  counterpart: z.string(),
  counterpartId: z.string().nullable(),
  identificationNumber: z.string().nullable(),
  identificationType: z.string().nullable(),
  incomingAmount: z.number(),
  incomingCount: z.number(),
  outgoingAmount: z.number(),
  outgoingCount: z.number(),
  withdrawId: z.string().nullable(),
});

const participantMonthlySchema = z.object({
  incomingAmount: z.number(),
  incomingCount: z.number(),
  month: z.string(),
  outgoingAmount: z.number(),
  outgoingCount: z.number(),
});

const movementTypeSchema = z.object({
  description: z.string().nullable(),
  direction: z.enum(["IN", "NEUTRO", "OUT"]),
  total: z.number(),
});

const statusDataResponseSchema = z.object({
  data: z.array(participantLeaderboardItemSchema),
  status: z.literal("ok"),
});

const participantInsightResponseSchema = z.object({
  counterparts: z.array(participantCounterpartSchema),
  monthly: z.array(participantMonthlySchema),
  participant: z.string(),
  status: z.literal("ok"),
});

const statsResponseSchema = z.object({
  byType: z.array(movementTypeSchema),
  monthly: z.array(
    z.object({
      in: z.number(),
      month: z.string(),
      net: z.number(),
      out: z.number(),
    }),
  ),
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

export type TransactionsInsightsORPCRouter = typeof transactionsInsightsORPCRouter;
