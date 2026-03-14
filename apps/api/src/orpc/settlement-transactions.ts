import { authDb } from "@finanzas/db";
import type { SettlementTransactionWhereInput } from "@finanzas/db/input";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  settlementTransactionIdSchema,
  settlementTransactionsDetailResponseSchema,
  settlementTransactionsListResponseSchema,
  settlementTransactionsQuerySchema,
} from "@finanzas/orpc-contracts/settlement-transactions";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type SettlementTransactionsORPCContext = {
  hono: HonoContext;
};

type AuthDbUser = Parameters<typeof authDb.$setAuth>[0];

const base = os.$context<SettlementTransactionsORPCContext>();
const NUMERIC_PATTERN = /^\d+$/;

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

const readSettlementTransactions = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Integration");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

function buildSettlementWhere(
  input: z.infer<typeof settlementTransactionsQuerySchema>,
): SettlementTransactionWhereInput {
  const { from, paymentMethod, search, to, transactionType } = input;
  const whereConditions: SettlementTransactionWhereInput[] = [];

  if (from || to) {
    const dateFilter: Record<string, Date> = {};

    if (from) {
      dateFilter.gte = new Date(from);
    }

    if (to) {
      dateFilter.lte = new Date(to);
    }

    whereConditions.push({ transactionDate: dateFilter });
  }

  if (paymentMethod) {
    whereConditions.push({
      OR: [{ paymentMethod }, { paymentMethodType: paymentMethod }],
    });
  }

  if (transactionType) {
    whereConditions.push({ transactionType });
  }

  if (search) {
    const isNumeric = NUMERIC_PATTERN.test(search);
    whereConditions.push({
      OR: [
        { externalReference: { contains: search, mode: "insensitive" } },
        { sourceId: { contains: search, mode: "insensitive" } },
        ...(isNumeric ? [{ orderId: Number(search) }] : []),
      ],
    });
  }

  if (whereConditions.length === 1) {
    return whereConditions[0];
  }

  if (whereConditions.length > 1) {
    return { AND: whereConditions };
  }

  return {};
}

const settlementTransactionsORPCRouterBase = {
  detail: readSettlementTransactions
    .route({ method: "GET", path: "/{id}", tags: ["Settlement Transactions"] })
    .input(settlementTransactionIdSchema)
    .output(settlementTransactionsDetailResponseSchema)
    .handler(async ({ context, input }: { context: { user: unknown }; input: z.output<typeof settlementTransactionIdSchema> }) => {
      const userDb = authDb.$setAuth(context.user as AuthDbUser);
      const transaction = await userDb.settlementTransaction.findUnique({
        where: { id: input.id },
      });

      if (!transaction) {
        throw new ORPCError("NOT_FOUND", { message: "Transacción no encontrada" });
      }

      return {
        data: transaction,
        status: "ok" as const,
      };
    }),

  list: readSettlementTransactions
    .route({ method: "GET", path: "/", tags: ["Settlement Transactions"] })
    .input(settlementTransactionsQuerySchema)
    .output(settlementTransactionsListResponseSchema)
    .handler(async ({ context, input }: { context: { user: unknown }; input: z.output<typeof settlementTransactionsQuerySchema> }) => {
      const offset = (input.page - 1) * input.pageSize;
      const where = buildSettlementWhere(input);
      const userDb = authDb.$setAuth(context.user as AuthDbUser);

      const [total, data] = await Promise.all([
        userDb.settlementTransaction.count({ where }),
        userDb.settlementTransaction.findMany({
          where,
          orderBy: { transactionDate: "desc" },
          skip: offset,
          take: input.pageSize,
        }),
      ]);

      return {
        data,
        page: input.page,
        pageSize: input.pageSize,
        status: "ok" as const,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),
};

export const settlementTransactionsORPCRouter = base
  .prefix("/api/orpc/settlement-transactions")
  .router(settlementTransactionsORPCRouterBase);

export const settlementTransactionsORPCHandler = new SuperJSONRPCHandler(
  settlementTransactionsORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError(error, {
          module: "api",
          operation: "orpc.settlement-transactions",
        });
      }),
    ],
  },
);

export const settlementTransactionsOpenAPIHandler = new OpenAPIHandler(
  settlementTransactionsORPCRouter,
  {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specGenerateOptions: {
          info: {
            title: "Bioalergia Settlement Transactions oRPC",
            description: "Contratos oRPC/OpenAPI para settlement transactions de Mercado Pago.",
          version: "1.0.0",
          },
        },
      }),
    ],
    interceptors: [
      onError((error) => {
        logError(error, {
          module: "api",
          operation: "openapi.settlement-transactions",
        });
      }),
    ],
  },
);

export type SettlementTransactionsORPCRouter = typeof settlementTransactionsORPCRouter;
