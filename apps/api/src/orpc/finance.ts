import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  financeAutoCategoryRuleListResponseSchema,
  financeAutoCategoryRuleResponseSchema,
  financeAvailableMonthsResponseSchema,
  financeCategoryListResponseSchema,
  financeCategoryResponseSchema,
  financeCompensationBudgetResponseSchema,
  financeCompensationLedgerQuerySchema,
  financeCompensationLedgerResponseSchema,
  financeCompensationProfileListResponseSchema,
  financeCompensationProfileResponseSchema,
  financeCreateAutoCategoryRuleSchema,
  financeCreateCategorySchema,
  financeCreateCompensationProfileSchema,
  financeCreateTransactionSchema,
  financeDeleteResponseSchema,
  financeIdSchema,
  financeListTransactionsInputSchema,
  financeReallocateTransactionSchema,
  financeReallocationResponseSchema,
  financeSummaryResponseSchema,
  financeSyncPatternsResponseSchema,
  financeSyncResponseSchema,
  financeTransactionResponseSchema,
  financeTransactionsResponseSchema,
  financeUpdateAutoCategoryRuleSchema,
  financeUpdateCategorySchema,
  financeUpdateCompensationProfileSchema,
  financeUpdateTransactionSchema,
  financeUpsertCompensationBudgetSchema,
} from "@finanzas/orpc-contracts/finance";
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
  const canRead = await hasPermission(context.user, "read", "Transaction");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", {
      message: "No tienes permisos para realizar esta acción.",
    });
  }
  return next();
});

const writeFinance = authed.use(async ({ context, next }) => {
  const canWrite = await hasPermission(context.user, "update", "Transaction");
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
    .input(financeCreateAutoCategoryRuleSchema)
    .output(financeAutoCategoryRuleResponseSchema)
    .handler(async ({ input }) => ({
      data: await createFinancialAutoCategoryRule(input),
      status: "ok" as const,
    })),

  autoCategoryRulesDelete: writeFinance
    .route({ method: "DELETE", path: "/auto-category-rules/{id}", tags: ["Finance"] })
    .input(financeIdSchema)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteFinancialAutoCategoryRule(input.id);
      return { status: "ok" as const };
    }),

  autoCategoryRulesList: readFinance
    .route({ method: "GET", path: "/auto-category-rules", tags: ["Finance"] })
    .output(financeAutoCategoryRuleListResponseSchema)
    .handler(async () => ({
      data: await listFinancialAutoCategoryRules(),
      status: "ok" as const,
    })),

  autoCategoryRulesUpdate: writeFinance
    .route({ method: "PUT", path: "/auto-category-rules/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: financeUpdateAutoCategoryRuleSchema }))
    .output(financeAutoCategoryRuleResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateFinancialAutoCategoryRule(input.id, input.payload),
      status: "ok" as const,
    })),

  categoriesCreate: writeFinance
    .route({ method: "POST", path: "/categories", tags: ["Finance"] })
    .input(financeCreateCategorySchema)
    .output(financeCategoryResponseSchema)
    .handler(async ({ input }) => ({
      data: await createTransactionCategory(input),
      status: "ok" as const,
    })),

  categoriesDelete: writeFinance
    .route({ method: "DELETE", path: "/categories/{id}", tags: ["Finance"] })
    .input(financeIdSchema)
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input }) => {
      await deleteTransactionCategory(input.id);
      return { status: "ok" as const };
    }),

  categoriesList: readFinance
    .route({ method: "GET", path: "/categories", tags: ["Finance"] })
    .output(financeCategoryListResponseSchema)
    .handler(async () => ({
      data: await listTransactionCategories(),
      status: "ok" as const,
    })),

  categoriesUpdate: writeFinance
    .route({ method: "PUT", path: "/categories/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: financeUpdateCategorySchema }))
    .output(financeCategoryResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateTransactionCategory(input.id, input.payload),
      status: "ok" as const,
    })),

  compensationProfilesCreate: writeFinance
    .route({ method: "POST", path: "/compensation-profiles", tags: ["Finance"] })
    .input(financeCreateCompensationProfileSchema)
    .output(financeCompensationProfileResponseSchema)
    .handler(async ({ input }) => ({
      data: await createCompensationProfile(input),
      status: "ok" as const,
    })),

  compensationProfilesLedger: readFinance
    .route({ method: "GET", path: "/compensation-profiles/{id}/ledger", tags: ["Finance"] })
    .input(financeCompensationLedgerQuerySchema)
    .output(financeCompensationLedgerResponseSchema)
    .handler(async ({ input }) => ({
      data: await listCompensationPeriodLedger(input.id, input.fromPeriod, input.toPeriod),
      status: "ok" as const,
    })),

  compensationProfilesList: readFinance
    .route({ method: "GET", path: "/compensation-profiles", tags: ["Finance"] })
    .output(financeCompensationProfileListResponseSchema)
    .handler(async () => ({
      data: await listCompensationProfiles(),
      status: "ok" as const,
    })),

  compensationProfilesUpdate: writeFinance
    .route({ method: "PUT", path: "/compensation-profiles/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: financeUpdateCompensationProfileSchema }))
    .output(financeCompensationProfileResponseSchema)
    .handler(async ({ input }) => ({
      data: await updateCompensationProfile(input.id, input.payload),
      status: "ok" as const,
    })),

  compensationProfilesUpsertBudget: writeFinance
    .route({ method: "PUT", path: "/compensation-profiles/{id}/budget", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: financeUpsertCompensationBudgetSchema }))
    .output(financeCompensationBudgetResponseSchema)
    .handler(async ({ input }) => ({
      data: await upsertCompensationPeriodBudget(input.id, input.payload),
      status: "ok" as const,
    })),

  sync: writeFinance
    .route({ method: "POST", path: "/sync", tags: ["Finance"] })
    .output(financeSyncResponseSchema)
    .handler(async ({ context }) => ({
      data: await syncFinancialTransactions(context.user.id),
      status: "ok" as const,
    })),

  syncUncategorizedPatterns: writeFinance
    .route({ method: "POST", path: "/sync/uncategorized-patterns", tags: ["Finance"] })
    .output(financeSyncPatternsResponseSchema)
    .handler(async () => ({
      data: await syncUncategorizedTransactionsByPatterns(),
      status: "ok" as const,
    })),

  transactionsAvailableMonths: readFinance
    .route({ method: "GET", path: "/transactions/available-months", tags: ["Finance"] })
    .output(financeAvailableMonthsResponseSchema)
    .handler(async () => ({
      data: await listAvailableFinancialTransactionMonths(),
      status: "ok" as const,
    })),

  transactionsCreate: writeFinance
    .route({ method: "POST", path: "/transactions", tags: ["Finance"] })
    .input(financeCreateTransactionSchema)
    .output(financeTransactionResponseSchema)
    .handler(async ({ input }) => ({
      data: toPlainFinancialTransaction(await createFinancialTransaction(input)),
      status: "ok" as const,
    })),

  transactionsDelete: writeFinance
    .route({ method: "DELETE", path: "/transactions/{id}", tags: ["Finance"] })
    .input(financeIdSchema)
    .output(financeDeleteResponseSchema)
    .handler(async ({ input }) => {
      await deleteFinancialTransaction(input.id);
      return { message: "Deleted", status: "ok" as const };
    }),

  transactionsList: readFinance
    .route({ method: "GET", path: "/transactions", tags: ["Finance"] })
    .input(financeListTransactionsInputSchema)
    .output(financeTransactionsResponseSchema)
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
    .input(financeReallocateTransactionSchema)
    .output(financeReallocationResponseSchema)
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
    .input(financeListTransactionsInputSchema)
    .output(financeSummaryResponseSchema)
    .handler(async ({ input }) => ({
      data: await getFinancialSummaryByCategory({
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      }),
      status: "ok" as const,
    })),

  transactionsUpdate: writeFinance
    .route({ method: "PUT", path: "/transactions/{id}", tags: ["Finance"] })
    .input(z.object({ id: z.number().int().positive(), payload: financeUpdateTransactionSchema }))
    .output(financeTransactionResponseSchema)
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
