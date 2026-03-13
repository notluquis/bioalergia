import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { expensesContract } from "@finanzas/orpc-contracts/expenses";
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
    .route(expensesContract.create)
    .handler(async () => notImplemented),

  detail: readExpenses
    .route(expensesContract.detail)
    .handler(async () => notImplemented),

  linkTransaction: updateExpenses
    .route(expensesContract.linkTransaction)
    .handler(async () => notImplemented),

  list: readExpenses
    .route(expensesContract.list)
    .handler(async () => ({ expenses: [], status: "ok" as const })),

  stats: readExpenses
    .route(expensesContract.stats)
    .handler(async () => ({ stats: [], status: "ok" as const })),

  unlinkTransaction: updateExpenses
    .route(expensesContract.unlinkTransaction)
    .handler(async () => notImplemented),

  update: updateExpenses
    .route(expensesContract.update)
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
