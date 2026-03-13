import { oc } from "@orpc/contract";
import { z } from "zod";

export const counterpartCategorySchema = z.enum([
  "SUPPLIER",
  "CLIENT",
  "EMPLOYEE",
  "PARTNER",
  "LENDER",
  "PERSONAL_EXPENSE",
  "OTHER",
]);

export const counterpartSchema = z.object({
  bankAccountHolder: z.string(),
  category: counterpartCategorySchema,
  createdAt: z.date(),
  id: z.number().int(),
  identificationNumber: z.string(),
  notes: z.string().nullable(),
  updatedAt: z.date(),
});

export const counterpartAccountSchema = z.object({
  accountNumber: z.string(),
  accountType: z.string().nullable(),
  bankName: z.string().nullable(),
  counterpartId: z.number().int(),
  createdAt: z.date(),
  id: z.number().int(),
  updatedAt: z.date(),
});

export const counterpartSuggestionSchema = z.object({
  accountIdentifier: z.string(),
  accountType: z.string().nullable(),
  assignedCounterpartId: z.number().int().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankName: z.string().nullable(),
  identificationNumber: z.string().nullable(),
  totalAmount: z.number(),
  withdrawId: z.string().nullable(),
});

export const counterpartSummarySchema = z.object({
  releaseTotal: z.number(),
  settlementCount: z.number().int(),
  withdrawTotal: z.number(),
});

export const unassignedPayoutAccountSchema = z.object({
  conflict: z.boolean(),
  counterpartId: z.number().int().nullable(),
  counterpartName: z.string().nullable(),
  counterpartRut: z.string().nullable(),
  movementCount: z.number().int(),
  payoutBankAccountNumber: z.string(),
  totalGrossAmount: z.number(),
  withdrawRut: z.string().nullable(),
});

export const counterpartPayloadSchema = z.object({
  bankAccountHolder: z.string().min(1),
  category: counterpartCategorySchema.optional(),
  identificationNumber: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export const counterpartAccountPayloadSchema = z.object({
  accountIdentifier: z.string().optional(),
  accountNumber: z.string().optional(),
  accountType: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
});

export const counterpartAccountUpdateSchema = z.object({
  accountType: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
});

export const counterpartBulkAssignRutSchema = z.object({
  accountNumbers: z.array(z.string()).min(1),
  bankAccountHolder: z.string().optional(),
  rut: z.string().min(1),
});

export const counterpartIdSchema = z.object({
  id: z.number().int(),
});

export const counterpartSummaryInputSchema = counterpartIdSchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const counterpartSuggestionInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  q: z.string().optional(),
});

export const counterpartUnassignedPayoutAccountsInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  query: z.string().optional(),
});

export const counterpartAddAccountInputSchema = z.object({
  counterpartId: z.number().int(),
  payload: counterpartAccountPayloadSchema,
});

export const counterpartUpdateAccountInputSchema = z.object({
  accountId: z.number().int(),
  payload: counterpartAccountUpdateSchema,
});

export const counterpartUpdateInputSchema = z.object({
  id: z.number().int(),
  payload: counterpartPayloadSchema.partial(),
});

export const counterpartAttachRutInputSchema = z.object({
  counterpartId: z.number().int(),
  rut: z.string().min(1),
});

export const counterpartsResponseSchema = z.object({
  counterparts: z.array(counterpartSchema),
});

export const counterpartDetailResponseSchema = z.object({
  accounts: z.array(counterpartAccountSchema),
  counterpart: counterpartSchema,
});

export const counterpartAccountsResponseSchema = z.object({
  accounts: z.array(counterpartAccountSchema),
});

export const counterpartSuggestionsResponseSchema = z.object({
  suggestions: z.array(counterpartSuggestionSchema),
});

export const counterpartsSyncResponseSchema = z.object({
  conflictCount: z.number().int().optional(),
  syncedAccounts: z.number().int(),
  syncedCounterparts: z.number().int(),
});

export const unassignedPayoutAccountsResponseSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  rows: z.array(unassignedPayoutAccountSchema),
  total: z.number().int(),
});

export const assignRutToPayoutsResponseSchema = z.object({
  assignedCount: z.number().int(),
  conflicts: z.array(unassignedPayoutAccountSchema),
  counterpart: counterpartSchema,
});

export const counterpartSummaryResponseSchema = z.object({
  summary: counterpartSummarySchema,
});

export const counterpartStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const counterpartsContract = {
  addAccount: oc
    .route({ method: "POST", path: "/{counterpartId}/accounts" })
    .input(counterpartAddAccountInputSchema)
    .output(counterpartAccountsResponseSchema),
  assignRutToPayouts: oc
    .route({ method: "POST", path: "/assign-rut-to-payouts" })
    .input(counterpartBulkAssignRutSchema)
    .output(assignRutToPayoutsResponseSchema),
  attachRut: oc
    .route({ method: "POST", path: "/{counterpartId}/attach-rut" })
    .input(counterpartAttachRutInputSchema)
    .output(counterpartAccountsResponseSchema),
  create: oc
    .route({ method: "POST", path: "/" })
    .input(counterpartPayloadSchema)
    .output(counterpartDetailResponseSchema),
  detail: oc
    .route({ method: "GET", path: "/{id}" })
    .input(counterpartIdSchema)
    .output(counterpartDetailResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).output(counterpartsResponseSchema),
  suggestions: oc
    .route({ method: "GET", path: "/suggestions" })
    .input(counterpartSuggestionInputSchema)
    .output(counterpartSuggestionsResponseSchema),
  summary: oc
    .route({ method: "GET", path: "/{id}/summary" })
    .input(counterpartSummaryInputSchema)
    .output(counterpartSummaryResponseSchema),
  sync: oc.route({ method: "POST", path: "/sync" }).output(counterpartsSyncResponseSchema),
  unassignedPayoutAccounts: oc
    .route({ method: "GET", path: "/unassigned-payout-accounts" })
    .input(counterpartUnassignedPayoutAccountsInputSchema)
    .output(unassignedPayoutAccountsResponseSchema),
  update: oc
    .route({ method: "PUT", path: "/{id}" })
    .input(counterpartUpdateInputSchema)
    .output(counterpartDetailResponseSchema),
  updateAccount: oc
    .route({ method: "PUT", path: "/accounts/{accountId}" })
    .input(counterpartUpdateAccountInputSchema)
    .output(counterpartStatusResponseSchema),
};

export type CounterpartsContract = typeof counterpartsContract;
