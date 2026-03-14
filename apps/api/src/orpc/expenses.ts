import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  detailExpenseInputSchema,
  expensePayloadSchema,
  expensesListResponseSchema,
  expensesStatsResponseSchema,
  linkTransactionInputSchema,
  listExpensesInputSchema,
  placeholderExpenseResponseSchema,
  statsExpensesInputSchema,
  unlinkTransactionInputSchema,
} from "@finanzas/orpc-contracts/expenses";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type ExpensesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ExpensesORPCContext>();

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

const readExpenses = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Expense");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createExpenses = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Expense");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateExpenses = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "Expense");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const notImplemented = {
  message: "MonthlyExpense feature not yet implemented",
  status: "error" as const,
};

const expensesORPCRouterBase = {
  create: createExpenses
    .route({ method: "POST", path: "/" })
    .input(expensePayloadSchema)
    .output(placeholderExpenseResponseSchema)
    .handler(async () => notImplemented),

  detail: readExpenses
    .route({ method: "GET", path: "/{publicId}" })
    .input(detailExpenseInputSchema)
    .output(placeholderExpenseResponseSchema)
    .handler(async () => notImplemented),

  linkTransaction: updateExpenses
    .route({ method: "POST", path: "/{publicId}/link" })
    .input(linkTransactionInputSchema)
    .output(placeholderExpenseResponseSchema)
    .handler(async () => notImplemented),

  list: readExpenses
    .route({ method: "GET", path: "/" })
    .input(listExpensesInputSchema)
    .output(expensesListResponseSchema)
    .handler(async () => ({ expenses: [], status: "ok" as const })),

  stats: readExpenses
    .route({ method: "GET", path: "/stats" })
    .input(statsExpensesInputSchema)
    .output(expensesStatsResponseSchema)
    .handler(async () => ({ stats: [], status: "ok" as const })),

  unlinkTransaction: updateExpenses
    .route({ method: "POST", path: "/{publicId}/unlink" })
    .input(unlinkTransactionInputSchema)
    .output(placeholderExpenseResponseSchema)
    .handler(async () => notImplemented),

  update: updateExpenses
    .route({ method: "PUT", path: "/{publicId}" })
    .input(detailExpenseInputSchema.extend({ payload: expensePayloadSchema }))
    .output(placeholderExpenseResponseSchema)
    .handler(async () => notImplemented),
};

export const expensesORPCRouter = base.prefix("/api/orpc/expenses").router(expensesORPCRouterBase);

export const expensesORPCHandler = new SuperJSONRPCHandler(expensesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.expenses",
      });
    }),
  ],
});

export const expensesOpenAPIHandler = new OpenAPIHandler(expensesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Expenses oRPC",
          description:
            "Contratos oRPC/OpenAPI para monthly expenses. La feature sigue placeholder en backend.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.expenses",
      });
    }),
  ],
});

export type ExpensesORPCRouter = typeof expensesORPCRouter;
