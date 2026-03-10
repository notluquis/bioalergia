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

type ExpensesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ExpensesORPCContext>();

const listExpensesInputSchema = z.object({
  from: z.string().optional(),
  serviceId: z.number().int().nullable().optional(),
  status: z.string().optional(),
  to: z.string().optional(),
});

const statsExpensesInputSchema = z.object({
  category: z.string().nullable().optional(),
  from: z.string().optional(),
  groupBy: z.enum(["day", "month", "quarter", "week", "year"]).optional(),
  to: z.string().optional(),
});

const detailExpenseInputSchema = z.object({
  publicId: z.string().min(1),
});

const expensePayloadSchema = z.object({
  amountExpected: z.number(),
  category: z.string().nullable().optional(),
  expenseDate: z.string(),
  name: z.string(),
  notes: z.string().nullable().optional(),
  serviceId: z.number().int().nullable().optional(),
  source: z.enum(["MANUAL", "SERVICE", "TRANSACTION"]).optional(),
  status: z.enum(["CLOSED", "OPEN"]).optional(),
  tags: z.array(z.string()).optional(),
});

const linkTransactionInputSchema = z.object({
  amount: z.number().optional(),
  publicId: z.string().min(1),
  transactionId: z.number().int(),
});

const unlinkTransactionInputSchema = z.object({
  publicId: z.string().min(1),
  transactionId: z.number().int(),
});

const placeholderResponseSchema = z.object({
  message: z.string(),
  status: z.literal("error"),
});

const expensesListResponseSchema = z.object({
  expenses: z.array(z.unknown()),
  status: z.literal("ok"),
});

const expensesStatsResponseSchema = z.object({
  stats: z.array(z.unknown()),
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
    .route({
      method: "POST",
      path: "/",
      summary: "Create monthly expense placeholder",
      tags: ["Expenses"],
    })
    .input(expensePayloadSchema)
    .output(placeholderResponseSchema)
    .handler(async () => notImplemented),

  detail: readExpenses
    .route({
      method: "GET",
      path: "/{publicId}",
      summary: "Get monthly expense detail placeholder",
      tags: ["Expenses"],
    })
    .input(detailExpenseInputSchema)
    .output(placeholderResponseSchema)
    .handler(async () => notImplemented),

  linkTransaction: updateExpenses
    .route({
      method: "POST",
      path: "/{publicId}/link",
      summary: "Link transaction to monthly expense placeholder",
      tags: ["Expenses"],
    })
    .input(linkTransactionInputSchema)
    .output(placeholderResponseSchema)
    .handler(async () => notImplemented),

  list: readExpenses
    .route({ method: "GET", path: "/", summary: "List monthly expenses", tags: ["Expenses"] })
    .input(listExpensesInputSchema)
    .output(expensesListResponseSchema)
    .handler(async () => ({ expenses: [], status: "ok" as const })),

  stats: readExpenses
    .route({
      method: "GET",
      path: "/stats",
      summary: "Get monthly expense statistics",
      tags: ["Expenses"],
    })
    .input(statsExpensesInputSchema)
    .output(expensesStatsResponseSchema)
    .handler(async () => ({ stats: [], status: "ok" as const })),

  unlinkTransaction: updateExpenses
    .route({
      method: "POST",
      path: "/{publicId}/unlink",
      summary: "Unlink transaction from monthly expense placeholder",
      tags: ["Expenses"],
    })
    .input(unlinkTransactionInputSchema)
    .output(placeholderResponseSchema)
    .handler(async () => notImplemented),

  update: updateExpenses
    .route({
      method: "PUT",
      path: "/{publicId}",
      summary: "Update monthly expense placeholder",
      tags: ["Expenses"],
    })
    .input(z.object({ payload: expensePayloadSchema, publicId: z.string().min(1) }))
    .output(placeholderResponseSchema)
    .handler(async () => notImplemented),
};

export const expensesORPCRouter = base.router(expensesORPCRouterBase).prefix("/api/orpc/expenses");

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
