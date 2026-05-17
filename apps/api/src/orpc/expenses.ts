import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  detailExpenseInputSchema,
  expenseDetailResponseSchema,
  expenseLinkResponseSchema,
  expensePayloadSchema,
  expenseServiceDetailResponseSchema,
  expenseServiceListResponseSchema,
  expenseServicePayloadSchema,
  expensesListResponseSchema,
  expensesStatsResponseSchema,
  generateExpensesInputSchema,
  generateExpensesResponseSchema,
  linkTransactionInputSchema,
  listExpenseServicesInputSchema,
  listExpensesInputSchema,
  statsExpensesInputSchema,
  unlinkTransactionInputSchema,
} from "@finanzas/orpc-contracts/expenses";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createExpense,
  createExpenseService,
  deleteExpenseService,
  generateExpensesFromTemplates,
  getExpense,
  getExpenseStats,
  linkTransaction,
  listExpenseServices,
  listExpenses,
  unlinkTransaction,
  updateExpense,
  updateExpenseService,
} from "../services/expenses.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

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
  const canRead = await hasPermission(context.user, "read", "Expense");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createExpenses = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Expense");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateExpenses = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Expense");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const deleteServiceInputSchema = z.object({ id: z.number().int() });
const updateServiceInputSchema = z.object({
  id: z.number().int(),
  payload: expenseServicePayloadSchema,
});

const expensesORPCRouterBase = {
  // ─── Expense CRUD ───────────────────────────────────────────────────────────

  create: createExpenses
    .route({ method: "POST", path: "/" })
    .input(expensePayloadSchema)
    .output(expenseDetailResponseSchema)
    .handler(async ({ input }) => {
      const expense = await createExpense(input);
      return { expense, status: "ok" as const };
    }),

  detail: readExpenses
    .route({ method: "GET", path: "/{publicId}" })
    .input(detailExpenseInputSchema)
    .output(expenseDetailResponseSchema)
    .handler(async ({ input }) => {
      const expense = await getExpense(input.publicId);

      if (!expense) {
        throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
      }

      return { expense, status: "ok" as const };
    }),

  generateFromTemplates: createExpenses
    .route({ method: "POST", path: "/generate" })
    .input(generateExpensesInputSchema)
    .output(generateExpensesResponseSchema)
    .handler(async ({ input }) => {
      const result = await generateExpensesFromTemplates(input.month, input.overwrite ?? false);
      return { ...result, status: "ok" as const };
    }),

  linkTransaction: updateExpenses
    .route({ method: "POST", path: "/{publicId}/link" })
    .input(linkTransactionInputSchema)
    .output(expenseLinkResponseSchema)
    .handler(async ({ input }) => {
      const result = await linkTransaction(input.publicId, input.transactionId, input.amount);

      if (result === null) {
        throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
      }

      return { message: `amountApplied updated to ${result}`, status: "ok" as const };
    }),

  list: readExpenses
    .route({ method: "GET", path: "/" })
    .input(listExpensesInputSchema)
    .output(expensesListResponseSchema)
    .handler(async ({ input }) => {
      const expenses = await listExpenses({
        from: input.from,
        scope: input.scope,
        serviceId: input.serviceId,
        status: input.status,
        to: input.to,
      });
      return { expenses, status: "ok" as const };
    }),

  stats: readExpenses
    .route({ method: "GET", path: "/stats" })
    .input(statsExpensesInputSchema)
    .output(expensesStatsResponseSchema)
    .handler(async ({ input }) => {
      const stats = await getExpenseStats({
        from: input.from,
        groupBy: input.groupBy,
        scope: input.scope,
        to: input.to,
      });
      return { stats, status: "ok" as const };
    }),

  unlinkTransaction: updateExpenses
    .route({ method: "POST", path: "/{publicId}/unlink" })
    .input(unlinkTransactionInputSchema)
    .output(expenseLinkResponseSchema)
    .handler(async ({ input }) => {
      const result = await unlinkTransaction(input.publicId, input.transactionId);

      if (result === null) {
        throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
      }

      return { message: `amountApplied updated to ${result}`, status: "ok" as const };
    }),

  update: updateExpenses
    .route({ method: "PUT", path: "/{publicId}" })
    .input(detailExpenseInputSchema.extend({ payload: expensePayloadSchema }))
    .output(expenseDetailResponseSchema)
    .handler(async ({ input }) => {
      const expense = await updateExpense(input.publicId, input.payload);
      return { expense, status: "ok" as const };
    }),

  // ─── ExpenseService CRUD ────────────────────────────────────────────────────

  createService: createExpenses
    .route({ method: "POST", path: "/services" })
    .input(expenseServicePayloadSchema)
    .output(expenseServiceDetailResponseSchema)
    .handler(async ({ input }) => {
      const service = await createExpenseService(input);
      return { service, status: "ok" as const };
    }),

  deleteService: updateExpenses
    .route({ method: "DELETE", path: "/services/{id}" })
    .input(deleteServiceInputSchema)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteExpenseService(input.id);
      return { status: "ok" as const };
    }),

  listServices: readExpenses
    .route({ method: "GET", path: "/services" })
    .input(listExpenseServicesInputSchema)
    .output(expenseServiceListResponseSchema)
    .handler(async ({ input }) => {
      const services = await listExpenseServices({
        isActive: input.isActive,
        scope: input.scope,
      });
      return { services, status: "ok" as const };
    }),

  updateService: updateExpenses
    .route({ method: "PUT", path: "/services/{id}" })
    .input(updateServiceInputSchema)
    .output(expenseServiceDetailResponseSchema)
    .handler(async ({ input }) => {
      const service = await updateExpenseService(input.id, input.payload);

      if (!service) {
        throw new ORPCError("NOT_FOUND", { message: "ExpenseService not found" });
      }

      return { service, status: "ok" as const };
    }),
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
          description: "Contratos oRPC/OpenAPI para gastos mensuales.",
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
