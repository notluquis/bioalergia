import { oc } from "@orpc/contract";
import { z } from "zod";

export const financePeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const financeTransactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const financeListTransactionsInputSchema = z.object({
  categoryId: z.coerce.number().optional(),
  effectivePeriod: financePeriodSchema.optional(),
  from: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(50),
  search: z.string().optional(),
  to: z.string().optional(),
  type: financeTransactionTypeSchema.optional(),
});

export const financeCreateTransactionSchema = z.object({
  amount: z.number(),
  categoryId: z.number().nullable().optional(),
  comment: z.string().optional(),
  counterpartId: z.number().nullable().optional(),
  date: z.coerce.date(),
  description: z.string().min(1),
  type: financeTransactionTypeSchema,
});

export const financeUpdateTransactionSchema = financeCreateTransactionSchema.partial().extend({
  isReconciled: z.boolean().optional(),
});

export const financeCreateCategorySchema = z.object({
  color: z.string().optional(),
  isNonAccountable: z.boolean().optional(),
  name: z.string().min(1),
});

export const financeUpdateCategorySchema = z.object({
  color: z.string().nullable().optional(),
  isNonAccountable: z.boolean().optional(),
  name: z.string().min(1).optional(),
});

export const financeMatchAmountOnSchema = z.enum(["net", "gross"]);

export const financeCreateAutoCategoryRuleSchema = z.object({
  amountsExact: z.array(z.number()).optional(),
  categoryId: z.number().int().positive(),
  commentContains: z.string().nullable().optional(),
  counterpartId: z.number().int().positive().nullable().optional(),
  descriptionContains: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  matchAmountOn: financeMatchAmountOnSchema.optional(),
  maxAmount: z.number().nullable().optional(),
  minAmount: z.number().nullable().optional(),
  name: z.string().min(1),
  paymentMethods: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
  type: financeTransactionTypeSchema.default("EXPENSE"),
});

export const financeUpdateAutoCategoryRuleSchema = financeCreateAutoCategoryRuleSchema.partial();

export const financeTransactionCategorySchema = z.object({
  color: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  icon: z.string().nullable().optional(),
  id: z.number().int(),
  name: z.string(),
  updatedAt: z.date().optional(),
});

export const financeCounterpartBriefSchema = z.object({
  bankAccountHolder: z.string(),
  id: z.number().int(),
  identificationNumber: z.string(),
});

export const financeCompensationProfileSchema = z.object({
  category: financeTransactionCategorySchema,
  categoryId: z.number().int(),
  counterpart: financeCounterpartBriefSchema.nullable().optional(),
  counterpartId: z.number().int().nullable().optional(),
  id: z.number().int(),
  isActive: z.boolean(),
  name: z.string(),
  timezone: z.string(),
});

export const financeCompensationBudgetSchema = z.object({
  baseAmount: z.number(),
  id: z.number().int(),
  isLocked: z.boolean(),
  period: financePeriodSchema,
  profileId: z.number().int(),
});

export const financeCompensationLedgerEntrySchema = z.object({
  allocatedAmount: z.number(),
  budgetAmount: z.number(),
  isLocked: z.boolean(),
  period: financePeriodSchema,
  variance: z.number(),
});

export const financeCounterpartLinkedSchema = z
  .object({
    accounts: z.array(z.object({ accountNumber: z.string().nullable() })).optional(),
    bankAccountHolder: z.string().nullable().optional(),
    id: z.number().int(),
    identificationNumber: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const financeFinancialTransactionSchema = z.object({
  amount: z.number(),
  category: financeTransactionCategorySchema.nullable().optional(),
  categoryId: z.number().int().nullable(),
  comment: z.string().nullable().optional(),
  counterpart: financeCounterpartLinkedSchema,
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
  type: financeTransactionTypeSchema,
  updatedAt: z.date().optional(),
});

export const financeFinancialSummaryByCategoryEntrySchema = z.object({
  categoryColor: z.string().nullable().optional(),
  categoryId: z.number().int().nullable(),
  categoryName: z.string(),
  count: z.number().int(),
  total: z.number(),
  type: financeTransactionTypeSchema,
});

export const financeFinancialSummarySchema = z.object({
  byCategory: z.array(financeFinancialSummaryByCategoryEntrySchema),
  totals: z.object({
    count: z.number().int(),
    expense: z.number(),
    income: z.number(),
    net: z.number(),
  }),
});

export const financeAutoCategoryRuleOutputSchema = z.object({
  amountsExact: z.array(z.number()).default([]),
  category: z.object({
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    id: z.number(),
    name: z.string(),
  }),
  categoryId: z.number(),
  commentContains: z.string().nullable().optional(),
  counterpart: financeCounterpartBriefSchema.nullable().optional(),
  counterpartId: z.number().nullable().optional(),
  descriptionContains: z.string().nullable().optional(),
  id: z.number(),
  isActive: z.boolean(),
  matchAmountOn: financeMatchAmountOnSchema.default("net"),
  maxAmount: z.number().nullable().optional(),
  minAmount: z.number().nullable().optional(),
  name: z.string(),
  paymentMethods: z.array(z.string()).default([]),
  priority: z.number(),
  type: financeTransactionTypeSchema,
});

export const financeAutoCategoryRuleListResponseSchema = z.object({
  data: z.array(financeAutoCategoryRuleOutputSchema),
  status: z.literal("ok"),
});

export const financeAutoCategoryRuleResponseSchema = z.object({
  data: financeAutoCategoryRuleOutputSchema,
  status: z.literal("ok"),
});

export const financeCreateCompensationProfileSchema = z.object({
  categoryId: z.number().int().positive(),
  counterpartId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1),
  timezone: z.string().min(1).optional(),
});

export const financeUpdateCompensationProfileSchema =
  financeCreateCompensationProfileSchema.partial();

export const financeUpsertCompensationBudgetSchema = z.object({
  baseAmount: z.number(),
  isLocked: z.boolean().optional(),
  period: financePeriodSchema,
});

export const financeCompensationLedgerQuerySchema = z.object({
  fromPeriod: financePeriodSchema,
  id: z.number().int().positive(),
  toPeriod: financePeriodSchema,
});

export const financeReallocateTransactionSchema = z.object({
  amount: z.number().positive(),
  fromPeriod: financePeriodSchema,
  id: z.number().int().positive(),
  profileId: z.number().int().positive(),
  targetPeriod: financePeriodSchema,
});

export const financeIdSchema = z.object({
  id: z.number().int().positive(),
});

export const financeTransactionsResponseSchema = z.object({
  data: z.array(financeFinancialTransactionSchema),
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

export const financeCategoryListResponseSchema = z.object({
  data: z.array(financeTransactionCategorySchema),
  status: z.literal("ok"),
});

export const financeCategoryResponseSchema = z.object({
  data: financeTransactionCategorySchema,
  status: z.literal("ok"),
});

export const financeCompensationProfileListResponseSchema = z.object({
  data: z.array(financeCompensationProfileSchema),
  status: z.literal("ok"),
});

export const financeCompensationProfileResponseSchema = z.object({
  data: financeCompensationProfileSchema,
  status: z.literal("ok"),
});

export const financeCompensationBudgetResponseSchema = z.object({
  data: financeCompensationBudgetSchema,
  status: z.literal("ok"),
});

export const financeCompensationLedgerResponseSchema = z.object({
  data: z.array(financeCompensationLedgerEntrySchema),
  status: z.literal("ok"),
});

export const financeAvailableMonthsResponseSchema = z.object({
  data: z.array(financePeriodSchema),
  status: z.literal("ok"),
});

export const financeTransactionResponseSchema = z.object({
  data: financeFinancialTransactionSchema,
  status: z.literal("ok"),
});

export const financeReallocationResponseSchema = z.object({
  data: z
    .object({
      allocationType: z.string(),
      amount: z.number(),
      id: z.number().int(),
      period: financePeriodSchema,
      profileId: z.number().int(),
      transactionId: z.number().int(),
    })
    .passthrough(),
  status: z.literal("ok"),
});

export const financeSyncResponseSchema = z.object({
  data: z.object({
    created: z.number().int(),
    duplicates: z.number().int(),
    errors: z.array(z.string()),
    failed: z.number().int(),
    total: z.number().int(),
  }),
  status: z.literal("ok"),
});

export const financeSyncPatternsResponseSchema = z.object({
  data: z.object({
    updated: z.number().int(),
  }),
  status: z.literal("ok"),
});

export const financeSummaryResponseSchema = z.object({
  data: financeFinancialSummarySchema,
  status: z.literal("ok"),
});

export const financeUpdateWithIdCategorySchema = z.object({
  id: z.number().int().positive(),
  payload: financeUpdateCategorySchema,
});

export const financeUpdateWithIdTransactionSchema = z.object({
  id: z.number().int().positive(),
  payload: financeUpdateTransactionSchema,
});

export const financeUpdateWithIdAutoRuleSchema = z.object({
  id: z.number().int().positive(),
  payload: financeUpdateAutoCategoryRuleSchema,
});

export const financeUpdateWithIdCompensationProfileSchema = z.object({
  id: z.number().int().positive(),
  payload: financeUpdateCompensationProfileSchema,
});

export const financeUpdateWithIdBudgetSchema = z.object({
  id: z.number().int().positive(),
  payload: financeUpsertCompensationBudgetSchema,
});

export const financeDeleteResponseSchema = z.object({
  message: z.string().optional(),
  status: z.literal("ok"),
});

export const financeContract = {
  autoCategoryRulesCreate: oc
    .route({ method: "POST", path: "/auto-category-rules" })
    .input(financeCreateAutoCategoryRuleSchema)
    .output(financeAutoCategoryRuleResponseSchema),
  autoCategoryRulesDelete: oc
    .route({ method: "DELETE", path: "/auto-category-rules/{id}" })
    .input(financeIdSchema)
    .output(z.object({ status: z.literal("ok") })),
  autoCategoryRulesList: oc
    .route({ method: "GET", path: "/auto-category-rules" })
    .output(financeAutoCategoryRuleListResponseSchema),
  autoCategoryRulesUpdate: oc
    .route({ method: "PUT", path: "/auto-category-rules/{id}" })
    .input(financeUpdateWithIdAutoRuleSchema)
    .output(financeAutoCategoryRuleResponseSchema),
  categoriesCreate: oc
    .route({ method: "POST", path: "/categories" })
    .input(financeCreateCategorySchema)
    .output(financeCategoryResponseSchema),
  categoriesDelete: oc
    .route({ method: "DELETE", path: "/categories/{id}" })
    .input(financeIdSchema)
    .output(financeDeleteResponseSchema),
  categoriesList: oc
    .route({ method: "GET", path: "/categories" })
    .output(financeCategoryListResponseSchema),
  categoriesUpdate: oc
    .route({ method: "PUT", path: "/categories/{id}" })
    .input(financeUpdateWithIdCategorySchema)
    .output(financeCategoryResponseSchema),
  compensationProfilesCreate: oc
    .route({ method: "POST", path: "/compensation-profiles" })
    .input(financeCreateCompensationProfileSchema)
    .output(financeCompensationProfileResponseSchema),
  compensationProfilesLedger: oc
    .route({ method: "GET", path: "/compensation-profiles/{id}/ledger" })
    .input(financeCompensationLedgerQuerySchema)
    .output(financeCompensationLedgerResponseSchema),
  compensationProfilesList: oc
    .route({ method: "GET", path: "/compensation-profiles" })
    .output(financeCompensationProfileListResponseSchema),
  compensationProfilesUpdate: oc
    .route({ method: "PUT", path: "/compensation-profiles/{id}" })
    .input(financeUpdateWithIdCompensationProfileSchema)
    .output(financeCompensationProfileResponseSchema),
  compensationProfilesUpsertBudget: oc
    .route({ method: "PUT", path: "/compensation-profiles/{id}/budget" })
    .input(financeUpdateWithIdBudgetSchema)
    .output(financeCompensationBudgetResponseSchema),
  sync: oc.route({ method: "POST", path: "/sync" }).output(financeSyncResponseSchema),
  syncUncategorizedPatterns: oc
    .route({ method: "POST", path: "/sync/uncategorized-patterns" })
    .output(financeSyncPatternsResponseSchema),
  transactionsAvailableMonths: oc
    .route({ method: "GET", path: "/transactions/available-months" })
    .output(financeAvailableMonthsResponseSchema),
  transactionsCreate: oc
    .route({ method: "POST", path: "/transactions" })
    .input(financeCreateTransactionSchema)
    .output(financeTransactionResponseSchema),
  transactionsDelete: oc
    .route({ method: "DELETE", path: "/transactions/{id}" })
    .input(financeIdSchema)
    .output(financeDeleteResponseSchema),
  transactionsList: oc
    .route({ method: "GET", path: "/transactions" })
    .input(financeListTransactionsInputSchema)
    .output(financeTransactionsResponseSchema),
  transactionsReallocate: oc
    .route({ method: "POST", path: "/transactions/{id}/reallocate" })
    .input(financeReallocateTransactionSchema)
    .output(financeReallocationResponseSchema),
  transactionsSummary: oc
    .route({ method: "GET", path: "/transactions/summary" })
    .input(financeListTransactionsInputSchema)
    .output(financeSummaryResponseSchema),
  transactionsUpdate: oc
    .route({ method: "PUT", path: "/transactions/{id}" })
    .input(financeUpdateWithIdTransactionSchema)
    .output(financeTransactionResponseSchema),
};

export type FinanceContract = typeof financeContract;
