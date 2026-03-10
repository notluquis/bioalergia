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
  createCompensationProfile,
  createFinancialAutoCategoryRule,
  createFinancialTransaction,
  createTransactionCategory,
  deleteFinancialAutoCategoryRule,
  deleteFinancialTransaction,
  deleteTransactionCategory,
  getFinancialSummaryByCategory,
  listAvailableFinancialTransactionMonths,
  listCompensationPeriodLedger,
  listCompensationProfiles,
  listFinancialAutoCategoryRules,
  listFinancialTransactions,
  listTransactionCategories,
  reallocateFinancialTransaction,
  syncFinancialTransactions,
  syncUncategorizedTransactionsByPatterns,
  updateCompensationProfile,
  updateFinancialAutoCategoryRule,
  updateFinancialTransaction,
  updateTransactionCategory,
  upsertCompensationPeriodBudget,
} from "../services/finance";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type FinanceORPCContext = {
  hono: HonoContext;
};

const base = os.$context<FinanceORPCContext>();

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

const listTransactionsInputSchema = z.object({
  categoryId: z.coerce.number().optional(),
  effectivePeriod: periodSchema.optional(),
  from: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(50),
  search: z.string().optional(),
  to: z.string().optional(),
  type: transactionTypeSchema.optional(),
});

const createTransactionSchema = z.object({
  amount: z.number(),
  categoryId: z.number().nullable().optional(),
  comment: z.string().optional(),
  counterpartId: z.number().nullable().optional(),
  date: z.coerce.date(),
  description: z.string().min(1),
  type: transactionTypeSchema,
});

const updateTransactionSchema = createTransactionSchema.partial().extend({
  isReconciled: z.boolean().optional(),
});

const createCategorySchema = z.object({
  color: z.string().optional(),
  isNonAccountable: z.boolean().optional(),
  name: z.string().min(1),
  type: transactionTypeSchema,
});

const updateCategorySchema = z.object({
  color: z.string().nullable().optional(),
  isNonAccountable: z.boolean().optional(),
  name: z.string().min(1).optional(),
  type: transactionTypeSchema.optional(),
});

const createAutoCategoryRuleSchema = z.object({
  categoryId: z.number().int().positive(),
  commentContains: z.string().nullable().optional(),
  counterpartId: z.number().int().positive().nullable().optional(),
  descriptionContains: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  maxAmount: z.number().nullable().optional(),
  minAmount: z.number().nullable().optional(),
  name: z.string().min(1),
  priority: z.number().int().optional(),
  type: transactionTypeSchema.default("EXPENSE"),
});

const updateAutoCategoryRuleSchema = createAutoCategoryRuleSchema.partial();

const createCompensationProfileSchema = z.object({
  categoryId: z.number().int().positive(),
  counterpartId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1),
  timezone: z.string().min(1).optional(),
});

const updateCompensationProfileSchema = createCompensationProfileSchema.partial();

const upsertCompensationBudgetSchema = z.object({
  baseAmount: z.number(),
  isLocked: z.boolean().optional(),
  period: periodSchema,
});

const compensationLedgerQuerySchema = z.object({
  fromPeriod: periodSchema,
  id: z.number().int().positive(),
  toPeriod: periodSchema,
});

const reallocateTransactionSchema = z.object({
  amount: z.number().positive(),
  fromPeriod: periodSchema,
  id: z.number().int().positive(),
  profileId: z.number().int().positive(),
  targetPeriod: periodSchema,
});

const idSchema = z.object({
  id: z.number().int().positive(),
});

const transactionsResponseSchema = z.object({
  data: z.array(z.unknown()),
  meta: z
    .object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    })
    .optional(),
  status: z.literal("ok"),
});

const statusDataResponseSchema = z.object({
  data: z.unknown().optional(),
  message: z.string().optional(),
  status: z.literal("ok"),
});

const listDataResponseSchema = z.object({
  data: z.array(z.unknown()),
  status: z.literal("ok"),
});

const summaryResponseSchema = z.object({
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

const readFinance = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Transaction");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", {
      message: "No tienes permisos para realizar esta acción.",
    });
  }
  return next();
});

const writeFinance = authed.use(async ({ context, next }) => {
  const canWrite = await hasPermission(context.user.id, "update", "Transaction");
  if (!canWrite) {
    throw new ORPCError("FORBIDDEN", {
      message: "No tienes permisos para realizar esta acción.",
    });
  }
  return next();
});

const financeORPCRouterBase = {
  autoCategoryRulesCreate: writeFinance
    .route({ method: "POST", path: "/auto-category-rules", tags: ["Finance"] })
    .input(createAutoCategoryRuleSchema)
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await createFinancialAutoCategoryRule(input),
      status: "ok" as const,
    })),

  autoCategoryRulesDelete: writeFinance
    .route({ method: "DELETE", path: "/auto-category-rules/{id}", tags: ["Finance"] })
    .input(idSchema)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteFinancialAutoCategoryRule(input.id);
      return { status: "ok" as const };
    }),

  autoCategoryRulesList: readFinance
    .route({ method: "GET", path: "/auto-category-rules", tags: ["Finance"] })
    .output(listDataResponseSchema)
    .handler(async () => ({
      data: await listFinancialAutoCategoryRules(),
      status: "ok" as const,
    })),

  autoCategoryRulesUpdate: writeFinance
    .route({ method: "PUT", path: "/auto-category-rules/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateAutoCategoryRuleSchema }))
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateFinancialAutoCategoryRule(input.id, input.payload),
      status: "ok" as const,
    })),

  categoriesCreate: writeFinance
    .route({ method: "POST", path: "/categories", tags: ["Finance"] })
    .input(createCategorySchema)
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await createTransactionCategory(input),
      status: "ok" as const,
    })),

  categoriesDelete: writeFinance
    .route({ method: "DELETE", path: "/categories/{id}", tags: ["Finance"] })
    .input(idSchema)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteTransactionCategory(input.id);
      return { status: "ok" as const };
    }),

  categoriesList: readFinance
    .route({ method: "GET", path: "/categories", tags: ["Finance"] })
    .output(listDataResponseSchema)
    .handler(async () => ({
      data: await listTransactionCategories(),
      status: "ok" as const,
    })),

  categoriesUpdate: writeFinance
    .route({ method: "PUT", path: "/categories/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateCategorySchema }))
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateTransactionCategory(input.id, input.payload),
      status: "ok" as const,
    })),

  compensationProfilesCreate: writeFinance
    .route({ method: "POST", path: "/compensation-profiles", tags: ["Finance"] })
    .input(createCompensationProfileSchema)
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await createCompensationProfile(input),
      status: "ok" as const,
    })),

  compensationProfilesLedger: readFinance
    .route({ method: "GET", path: "/compensation-profiles/{id}/ledger", tags: ["Finance"] })
    .input(compensationLedgerQuerySchema)
    .output(listDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await listCompensationPeriodLedger(input.id, input.fromPeriod, input.toPeriod),
      status: "ok" as const,
    })),

  compensationProfilesList: readFinance
    .route({ method: "GET", path: "/compensation-profiles", tags: ["Finance"] })
    .output(listDataResponseSchema)
    .handler(async () => ({
      data: await listCompensationProfiles(),
      status: "ok" as const,
    })),

  compensationProfilesUpdate: writeFinance
    .route({ method: "PUT", path: "/compensation-profiles/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateCompensationProfileSchema }))
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateCompensationProfile(input.id, input.payload),
      status: "ok" as const,
    })),

  compensationProfilesUpsertBudget: writeFinance
    .route({ method: "PUT", path: "/compensation-profiles/{id}/budget", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: upsertCompensationBudgetSchema }))
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await upsertCompensationPeriodBudget(input.id, input.payload),
      status: "ok" as const,
    })),

  sync: writeFinance
    .route({ method: "POST", path: "/sync", tags: ["Finance"] })
    .output(statusDataResponseSchema)
    .handler(async ({ context }) => ({
      data: await syncFinancialTransactions(context.user.id),
      status: "ok" as const,
    })),

  syncUncategorizedPatterns: writeFinance
    .route({ method: "POST", path: "/sync/uncategorized-patterns", tags: ["Finance"] })
    .output(statusDataResponseSchema)
    .handler(async () => ({
      data: await syncUncategorizedTransactionsByPatterns(),
      status: "ok" as const,
    })),

  transactionsAvailableMonths: readFinance
    .route({ method: "GET", path: "/transactions/available-months", tags: ["Finance"] })
    .output(listDataResponseSchema)
    .handler(async () => ({
      data: await listAvailableFinancialTransactionMonths(),
      status: "ok" as const,
    })),

  transactionsCreate: writeFinance
    .route({ method: "POST", path: "/transactions", tags: ["Finance"] })
    .input(createTransactionSchema)
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await createFinancialTransaction(input),
      status: "ok" as const,
    })),

  transactionsDelete: writeFinance
    .route({ method: "DELETE", path: "/transactions/{id}", tags: ["Finance"] })
    .input(idSchema)
    .output(z.object({ message: z.string().optional(), status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteFinancialTransaction(input.id);
      return { message: "Deleted", status: "ok" as const };
    }),

  transactionsList: readFinance
    .route({ method: "GET", path: "/transactions", tags: ["Finance"] })
    .input(listTransactionsInputSchema)
    .output(transactionsResponseSchema)
    .handler(async ({ input }) => {
      const result = await listFinancialTransactions({
        ...input,
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      });
      return { status: "ok" as const, ...result };
    }),

  transactionsReallocate: writeFinance
    .route({ method: "POST", path: "/transactions/{id}/reallocate", tags: ["Finance"] })
    .input(reallocateTransactionSchema)
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await reallocateFinancialTransaction(input.id, {
        amount: input.amount,
        fromPeriod: input.fromPeriod,
        profileId: input.profileId,
        targetPeriod: input.targetPeriod,
      }),
      status: "ok" as const,
    })),

  transactionsSummary: readFinance
    .route({ method: "GET", path: "/transactions/summary", tags: ["Finance"] })
    .input(listTransactionsInputSchema)
    .output(summaryResponseSchema)
    .handler(async ({ input }) => ({
      data: await getFinancialSummaryByCategory({
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      }),
      status: "ok" as const,
    })),

  transactionsUpdate: writeFinance
    .route({ method: "PUT", path: "/transactions/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateTransactionSchema }))
    .output(statusDataResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateFinancialTransaction(input.id, input.payload),
      status: "ok" as const,
    })),
};

export const financeORPCRouter = base
  .prefix("/api/orpc/finance")
  .tag("Finance")
  .router(financeORPCRouterBase);

export const financeORPCHandler = new SuperJSONRPCHandler(financeORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("finance.orpc", error, {});
    }),
  ],
});

export const financeOpenAPIHandler = new OpenAPIHandler(financeORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsPath: "/api/orpc/finance/docs",
      docsTitle: "Bioalergia Finance API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Finance API",
          version: "1.0.0",
        },
      },
      specPath: "/api/orpc/finance/openapi.json",
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("finance.orpc.openapi", error, {});
    }),
  ],
});

export type FinanceORPCRouter = typeof financeORPCRouter;
