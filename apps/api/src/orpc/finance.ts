import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import Decimal from "decimal.js";
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

const autoCategoryRuleOutputSchema = z.object({
  category: z.object({
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    id: z.number(),
    name: z.string(),
    type: transactionTypeSchema,
  }),
  categoryId: z.number(),
  commentContains: z.string().nullable().optional(),
  counterpart: z
    .object({
      bankAccountHolder: z.string(),
      id: z.number(),
      identificationNumber: z.string(),
    })
    .nullable()
    .optional(),
  counterpartId: z.number().nullable().optional(),
  descriptionContains: z.string().nullable().optional(),
  id: z.number(),
  isActive: z.boolean(),
  maxAmount: z.number().nullable().optional(),
  minAmount: z.number().nullable().optional(),
  name: z.string(),
  priority: z.number(),
  type: transactionTypeSchema,
});

const transactionCategorySchema = z.object({
  color: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  icon: z.string().nullable().optional(),
  id: z.number().int(),
  name: z.string(),
  type: transactionTypeSchema,
  updatedAt: z.date().optional(),
});

const counterpartBriefSchema = z.object({
  bankAccountHolder: z.string(),
  id: z.number().int(),
  identificationNumber: z.string(),
});

const compensationProfileSchema = z.object({
  category: transactionCategorySchema,
  categoryId: z.number().int(),
  counterpart: counterpartBriefSchema.nullable().optional(),
  counterpartId: z.number().int().nullable().optional(),
  id: z.number().int(),
  isActive: z.boolean(),
  name: z.string(),
  timezone: z.string(),
});

const compensationBudgetSchema = z.object({
  baseAmount: z.number(),
  id: z.number().int(),
  isLocked: z.boolean(),
  period: periodSchema,
  profileId: z.number().int(),
});

const compensationLedgerEntrySchema = z.object({
  allocatedAmount: z.number(),
  budgetAmount: z.number(),
  isLocked: z.boolean(),
  period: periodSchema,
  variance: z.number(),
});

const financialTransactionSchema = z.object({
  amount: z.number(),
  category: transactionCategorySchema.nullable().optional(),
  categoryId: z.number().int().nullable(),
  comment: z.string().nullable().optional(),
  counterpart: z
    .object({
      accounts: z.array(z.object({ accountNumber: z.string().nullable() })).optional(),
      bankAccountHolder: z.string().nullable().optional(),
      id: z.number().int(),
      identificationNumber: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  counterpartAccountNumber: z.string().nullable().optional(),
  counterpartId: z.number().int().nullable().optional(),
  createdAt: z.date().optional(),
  date: z.date(),
  description: z.string(),
  hasReallocation: z.boolean().optional(),
  hasReallocationInEffectivePeriod: z.boolean().optional(),
  id: z.number().int(),
  reallocatedInEffectivePeriod: z.number().optional(),
  reallocatedInTotal: z.number().optional(),
  reallocatedOutEffectivePeriod: z.number().optional(),
  reallocatedOutTotal: z.number().optional(),
  releaseBalanceAmount: z.number().nullable().optional(),
  releasePaymentMethod: z.string().nullable().optional(),
  releaseSaleDetail: z.string().nullable().optional(),
  settlementPaymentMethod: z.string().nullable().optional(),
  settlementPaymentMethodType: z.string().nullable().optional(),
  settlementSaleDetail: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
  type: transactionTypeSchema,
  updatedAt: z.date().optional(),
});

const financialSummaryByCategoryEntrySchema = z.object({
  categoryColor: z.string().nullable().optional(),
  categoryId: z.number().int().nullable(),
  categoryName: z.string(),
  count: z.number().int(),
  total: z.number(),
  type: transactionTypeSchema,
});

const financialSummarySchema = z.object({
  byCategory: z.array(financialSummaryByCategoryEntrySchema),
  totals: z.object({
    count: z.number().int(),
    expense: z.number(),
    income: z.number(),
    net: z.number(),
  }),
});

const autoCategoryRuleListResponseSchema = z.object({
  data: z.array(autoCategoryRuleOutputSchema),
  status: z.literal("ok"),
});

const autoCategoryRuleResponseSchema = z.object({
  data: autoCategoryRuleOutputSchema,
  status: z.literal("ok"),
});

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
  data: z.array(financialTransactionSchema),
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

const categoryListResponseSchema = z.object({
  data: z.array(transactionCategorySchema),
  status: z.literal("ok"),
});

const categoryResponseSchema = z.object({
  data: transactionCategorySchema,
  status: z.literal("ok"),
});

const compensationProfileListResponseSchema = z.object({
  data: z.array(compensationProfileSchema),
  status: z.literal("ok"),
});

const compensationProfileResponseSchema = z.object({
  data: compensationProfileSchema,
  status: z.literal("ok"),
});

const compensationBudgetResponseSchema = z.object({
  data: compensationBudgetSchema,
  status: z.literal("ok"),
});

const compensationLedgerResponseSchema = z.object({
  data: z.array(compensationLedgerEntrySchema),
  status: z.literal("ok"),
});

const availableMonthsResponseSchema = z.object({
  data: z.array(periodSchema),
  status: z.literal("ok"),
});

const transactionResponseSchema = z.object({
  data: financialTransactionSchema,
  status: z.literal("ok"),
});

const reallocationResponseSchema = z.object({
  data: z
    .object({
      allocationType: z.string(),
      amount: z.number(),
      id: z.number().int(),
      period: periodSchema,
      profileId: z.number().int(),
      transactionId: z.number().int(),
    })
    .passthrough(),
  status: z.literal("ok"),
});

const syncResponseSchema = z.object({
  data: z.object({
    created: z.number().int(),
    duplicates: z.number().int(),
    errors: z.array(z.string()),
    failed: z.number().int(),
    total: z.number().int(),
  }),
  status: z.literal("ok"),
});

const syncPatternsResponseSchema = z.object({
  data: z.object({
    updated: z.number().int(),
  }),
  status: z.literal("ok"),
});

const summaryResponseSchema = z.object({
  data: financialSummarySchema,
  status: z.literal("ok"),
});

function toNumberValue(value: unknown) {
  if (value == null) {
    return null;
  }

  if (Decimal.isDecimal(value)) {
    return value.toNumber();
  }

  return Number(value);
}

function toPlainFinancialTransaction<
  T extends {
    amount: unknown;
    categoryId?: null | number;
    comment?: null | string;
    counterpartId?: null | number;
    createdAt?: Date;
    date: Date;
    description: string;
    id: number;
    sourceId?: null | string;
    type: "EXPENSE" | "INCOME";
    updatedAt?: Date;
  },
>(transaction: T) {
  return {
    amount: toNumberValue(transaction.amount) ?? 0,
    categoryId: transaction.categoryId ?? null,
    comment: transaction.comment ?? null,
    counterpartId: transaction.counterpartId ?? null,
    createdAt: transaction.createdAt,
    date: transaction.date,
    description: transaction.description,
    id: transaction.id,
    sourceId: transaction.sourceId ?? null,
    type: transaction.type,
    updatedAt: transaction.updatedAt,
  };
}

function toPlainListedFinancialTransaction<
  T extends {
    amount: unknown;
    releaseBalanceAmount?: unknown;
  } & ReturnType<typeof toPlainFinancialTransaction>,
>(transaction: T) {
  return {
    ...transaction,
    amount: toNumberValue(transaction.amount) ?? 0,
    releaseBalanceAmount: toNumberValue(transaction.releaseBalanceAmount),
  };
}

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
    .output(autoCategoryRuleResponseSchema)
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
    .output(autoCategoryRuleListResponseSchema)
    .handler(async () => ({
      data: await listFinancialAutoCategoryRules(),
      status: "ok" as const,
    })),

  autoCategoryRulesUpdate: writeFinance
    .route({ method: "PUT", path: "/auto-category-rules/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateAutoCategoryRuleSchema }))
    .output(autoCategoryRuleResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateFinancialAutoCategoryRule(input.id, input.payload),
      status: "ok" as const,
    })),

  categoriesCreate: writeFinance
    .route({ method: "POST", path: "/categories", tags: ["Finance"] })
    .input(createCategorySchema)
    .output(categoryResponseSchema)
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
    .output(categoryListResponseSchema)
    .handler(async () => ({
      data: await listTransactionCategories(),
      status: "ok" as const,
    })),

  categoriesUpdate: writeFinance
    .route({ method: "PUT", path: "/categories/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateCategorySchema }))
    .output(categoryResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateTransactionCategory(input.id, input.payload),
      status: "ok" as const,
    })),

  compensationProfilesCreate: writeFinance
    .route({ method: "POST", path: "/compensation-profiles", tags: ["Finance"] })
    .input(createCompensationProfileSchema)
    .output(compensationProfileResponseSchema)
    .handler(async ({ input }) => ({
      data: await createCompensationProfile(input),
      status: "ok" as const,
    })),

  compensationProfilesLedger: readFinance
    .route({ method: "GET", path: "/compensation-profiles/{id}/ledger", tags: ["Finance"] })
    .input(compensationLedgerQuerySchema)
    .output(compensationLedgerResponseSchema)
    .handler(async ({ input }) => ({
      data: await listCompensationPeriodLedger(input.id, input.fromPeriod, input.toPeriod),
      status: "ok" as const,
    })),

  compensationProfilesList: readFinance
    .route({ method: "GET", path: "/compensation-profiles", tags: ["Finance"] })
    .output(compensationProfileListResponseSchema)
    .handler(async () => ({
      data: await listCompensationProfiles(),
      status: "ok" as const,
    })),

  compensationProfilesUpdate: writeFinance
    .route({ method: "PUT", path: "/compensation-profiles/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: updateCompensationProfileSchema }))
    .output(compensationProfileResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateCompensationProfile(input.id, input.payload),
      status: "ok" as const,
    })),

  compensationProfilesUpsertBudget: writeFinance
    .route({ method: "PUT", path: "/compensation-profiles/{id}/budget", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: upsertCompensationBudgetSchema }))
    .output(compensationBudgetResponseSchema)
    .handler(async ({ input }) => ({
      data: await upsertCompensationPeriodBudget(input.id, input.payload),
      status: "ok" as const,
    })),

  sync: writeFinance
    .route({ method: "POST", path: "/sync", tags: ["Finance"] })
    .output(syncResponseSchema)
    .handler(async ({ context }) => ({
      data: await syncFinancialTransactions(context.user.id),
      status: "ok" as const,
    })),

  syncUncategorizedPatterns: writeFinance
    .route({ method: "POST", path: "/sync/uncategorized-patterns", tags: ["Finance"] })
    .output(syncPatternsResponseSchema)
    .handler(async () => ({
      data: await syncUncategorizedTransactionsByPatterns(),
      status: "ok" as const,
    })),

  transactionsAvailableMonths: readFinance
    .route({ method: "GET", path: "/transactions/available-months", tags: ["Finance"] })
    .output(availableMonthsResponseSchema)
    .handler(async () => ({
      data: await listAvailableFinancialTransactionMonths(),
      status: "ok" as const,
    })),

  transactionsCreate: writeFinance
    .route({ method: "POST", path: "/transactions", tags: ["Finance"] })
    .input(createTransactionSchema)
    .output(transactionResponseSchema)
    .handler(async ({ input }) => ({
      data: toPlainFinancialTransaction(await createFinancialTransaction(input)),
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
      return {
        data: result.data.map((transaction) =>
          toPlainListedFinancialTransaction(transaction),
        ),
        meta: result.meta,
        status: "ok" as const,
      };
    }),

  transactionsReallocate: writeFinance
    .route({ method: "POST", path: "/transactions/{id}/reallocate", tags: ["Finance"] })
    .input(reallocateTransactionSchema)
    .output(reallocationResponseSchema)
    .handler(async ({ input }) => {
      const allocation = await reallocateFinancialTransaction(input.id, {
        amount: input.amount,
        fromPeriod: input.fromPeriod,
        profileId: input.profileId,
        targetPeriod: input.targetPeriod,
      });

      return {
        data: {
          ...allocation,
          amount: toNumberValue(allocation.amount) ?? 0,
        },
        status: "ok" as const,
      };
    }),

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
    .output(transactionResponseSchema)
    .handler(async ({ input }) => ({
      data: toPlainFinancialTransaction(await updateFinancialTransaction(input.id, input.payload)),
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
      docsTitle: "Bioalergia Finance API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Finance API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("finance.orpc.openapi", error, {});
    }),
  ],
});

export type FinanceORPCRouter = typeof financeORPCRouter;
