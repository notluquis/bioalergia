import { authDb } from "@finanzas/db";
import type { ReleaseTransactionWhereInput } from "@finanzas/db/input";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type ReleaseTransactionsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ReleaseTransactionsORPCContext>();
const NUMERIC_PATTERN = /^\d+$/;

const querySchema = z.object({
  descriptions: z.string().optional(),
  from: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  paymentMethod: z.string().optional(),
  search: z.string().optional(),
  to: z.string().optional(),
});

const listResponseSchema = z.object({
  data: z.array(z.unknown()),
  page: z.number(),
  pageSize: z.number(),
  status: z.literal("ok"),
  total: z.number(),
  totalPages: z.number(),
});

const idSchema = z.object({
  id: z.number().int().positive(),
});

const detailResponseSchema = z.object({
  data: z.unknown(),
  status: z.literal("ok"),
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

const readReleaseTransactions = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Integration");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

function buildReleaseWhere(input: z.infer<typeof querySchema>): ReleaseTransactionWhereInput {
  const { descriptions, from, paymentMethod, search, to } = input;
  const whereConditions: ReleaseTransactionWhereInput[] = [];

  if (from || to) {
    const dateFilter: Record<string, Date> = {};

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

const releaseTransactionsORPCRouterBase = {
  detail: readReleaseTransactions
    .route({ method: "GET", path: "/{id}", tags: ["Release Transactions"] })
    .input(idSchema)
    .output(detailResponseSchema)
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
    .input(querySchema)
    .output(listResponseSchema)
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
  .router(releaseTransactionsORPCRouterBase)
  .prefix("/api/orpc/release-transactions");

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
  },
);

export const releaseTransactionsOpenAPIHandler = new OpenAPIHandler(releaseTransactionsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/release-transactions/docs",
      specPath: "/api/orpc/release-transactions/openapi.json",
      theme: "saturn",
      favicon: "https://orpc.dev/icon.svg",
      layout: "modern",
      meta: {
        title: "Bioalergia Release Transactions oRPC",
        description: "Contratos oRPC/OpenAPI para release transactions de Mercado Pago.",
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
  schemaConverters: [new ZodToJsonSchemaConverter()],
});
