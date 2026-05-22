import { authDb } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  releaseTransactionIdSchema,
  releaseTransactionsDetailResponseSchema,
  releaseTransactionsListResponseSchema,
  releaseTransactionsQuerySchema,
} from "@finanzas/orpc-contracts/release-transactions";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ReleaseTransactionsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ReleaseTransactionsORPCContext>();
const NUMERIC_PATTERN = /^\d+$/;

// Tipo `where` derivado del propio método del cliente ZenStack v3.7. El alias
// de @finanzas/db/input NO coincide con el WhereInput interno (Kysely + $expr)
// que esperan findMany/count, así que se deriva de la firma real.
type ReleaseTransactionWhereInput = NonNullable<
  NonNullable<Parameters<typeof authDb.releaseTransaction.findMany>[0]>["where"]
>;

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

const readReleaseTransactions = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Integration");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

function buildReleaseWhere(
  input: z.infer<typeof releaseTransactionsQuerySchema>
): ReleaseTransactionWhereInput {
  const { descriptions, from, paymentMethod, search, to } = input;
  const whereConditions: ReleaseTransactionWhereInput[] = [];

  if (from || to) {
    const dateFilter: { gte?: Date; lte?: Date } = {};

    if (from) {
      dateFilter.gte = new Date(from);
    }

    if (to) {
      dateFilter.lte = new Date(to);
    }

    whereConditions.push({ date: dateFilter });
  }

  if (paymentMethod) {
    whereConditions.push({ paymentMethod });
  }

  if (descriptions) {
    whereConditions.push({
      description: {
        in: descriptions.split(",").map((value) => value.trim()),
      },
    });
  }

  if (search) {
    const isNumeric = NUMERIC_PATTERN.test(search);
    whereConditions.push({
      OR: [
        { externalReference: { contains: search, mode: "insensitive" as const } },
        { sourceId: { contains: search, mode: "insensitive" as const } },
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

const releaseTransactionsORPCRouterBase = {
  detail: readReleaseTransactions
    .route({ method: "GET", path: "/{id}", tags: ["Release Transactions"] })
    .input(releaseTransactionIdSchema)
    .output(releaseTransactionsDetailResponseSchema)
    .handler(async ({ context, input }) => {
      const userDb = authDb.$setAuth(context.user);
      const transaction = await userDb.releaseTransaction.findUnique({
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

  list: readReleaseTransactions
    .route({ method: "GET", path: "/", tags: ["Release Transactions"] })
    .input(releaseTransactionsQuerySchema)
    .output(releaseTransactionsListResponseSchema)
    .handler(async ({ context, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const where = buildReleaseWhere(input);
      const userDb = authDb.$setAuth(context.user);

      const [total, data] = await Promise.all([
        userDb.releaseTransaction.count({ where }),
        userDb.releaseTransaction.findMany({
          where,
          orderBy: { date: "desc" },
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

export const releaseTransactionsORPCRouter = base
  .prefix("/api/orpc/release-transactions")
  .router(releaseTransactionsORPCRouterBase);

export const releaseTransactionsORPCHandler = new SuperJSONRPCHandler(
  releaseTransactionsORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError(error, {
          module: "api",
          operation: "orpc.release-transactions",
        });
      }),
    ],
  }
);

export const releaseTransactionsOpenAPIHandler = new OpenAPIHandler(releaseTransactionsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Release Transactions oRPC",
          description: "Contratos oRPC/OpenAPI para release transactions de Mercado Pago.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.release-transactions",
      });
    }),
  ],
});

export type ReleaseTransactionsORPCRouter = typeof releaseTransactionsORPCRouter;
