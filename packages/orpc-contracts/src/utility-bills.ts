import { oc } from "@orpc/contract";
import { z } from "zod";
import { expenseScopeSchema } from "./expenses.ts";

// ─── Raw bill fetch schemas ───────────────────────────────────────────────────

export const essbioBillResultSchema = z.object({
  accountNumber: z.string(),
  address: z.string(),
  clientName: z.string(),
  company: z.string(),
  currentDebt: z.number(),
  error: z.string().nullable(),
  lastPayment: z.object({ amount: z.number(), date: z.string() }).nullable(),
  observation: z.string().nullable(),
  previousBalance: z.number(),
  regulated: z.boolean(),
});

export const cgeBillResultSchema = z.object({
  accountNumber: z.string(),
  address: z.string(),
  clientName: z.string(),
  commune: z.string(),
  company: z.string(),
  currentBill: z.number(),
  emissionDate: z.string(),
  previousBill: z.number(),
  thirdBill: z.number(),
});

// ─── UtilityProvider enum ─────────────────────────────────────────────────────

export const utilityProviderSchema = z.enum(["CGE", "ESSBIO", "OTHER"]);
export type UtilityProvider = z.infer<typeof utilityProviderSchema>;

// ─── UtilityAccount schemas ───────────────────────────────────────────────────

export const utilityAccountItemSchema = z.object({
  address: z.string().nullable(),
  clientName: z.string().nullable(),
  createdAt: z.coerce.date(),
  expenseServiceId: z.number().int().nullable(),
  id: z.number().int(),
  isActive: z.boolean(),
  label: z.string().nullable(),
  lastAmount: z.number().nullable(),
  lastFetchedAt: z.coerce.date().nullable(),
  lastPreviousAmount: z.number().nullable(),
  notes: z.string().nullable(),
  provider: utilityProviderSchema,
  scope: expenseScopeSchema,
  serviceNumber: z.string(),
  updatedAt: z.coerce.date(),
});

export const utilityAccountPayloadSchema = z.object({
  expenseServiceId: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  label: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  provider: utilityProviderSchema,
  scope: expenseScopeSchema.optional(),
  serviceNumber: z.string().min(1),
});

export const utilityAccountDetailResponseSchema = z.object({
  account: utilityAccountItemSchema,
  status: z.literal("ok"),
});

export const utilityAccountListResponseSchema = z.object({
  accounts: z.array(utilityAccountItemSchema),
  status: z.literal("ok"),
});

export const listUtilityAccountsInputSchema = z.object({
  isActive: z.boolean().optional(),
  provider: utilityProviderSchema.optional(),
  scope: expenseScopeSchema.optional(),
});

// Refresh result — normalized from either Essbio or CGE response
export const utilityBillRefreshResultSchema = z.object({
  address: z.string(),
  clientName: z.string(),
  currentAmount: z.number(),
  previousAmount: z.number(),
});

export const utilityAccountRefreshResponseSchema = z.object({
  account: utilityAccountItemSchema,
  bill: utilityBillRefreshResultSchema,
  status: z.literal("ok"),
});

// ─── Contract ─────────────────────────────────────────────────────────────────

export const utilityBillsContract = {
  // UtilityAccount CRUD
  createAccount: oc
    .route({ method: "POST", path: "/accounts" })
    .input(utilityAccountPayloadSchema)
    .output(utilityAccountDetailResponseSchema),

  deleteAccount: oc
    .route({ method: "DELETE", path: "/accounts/{id}" })
    .input(z.object({ id: z.number().int() }))
    .output(z.object({ status: z.literal("ok") })),

  listAccounts: oc
    .route({ method: "GET", path: "/accounts" })
    .input(listUtilityAccountsInputSchema)
    .output(utilityAccountListResponseSchema),

  updateAccount: oc
    .route({ method: "PUT", path: "/accounts/{id}" })
    .input(z.object({ id: z.number().int(), payload: utilityAccountPayloadSchema }))
    .output(utilityAccountDetailResponseSchema),

  // Fetch current bill from provider API and update cache
  refreshAccount: oc
    .route({ method: "POST", path: "/accounts/{id}/refresh" })
    .input(z.object({ id: z.number().int() }))
    .output(utilityAccountRefreshResponseSchema),

  // One-off raw fetches (no stored account needed)
  fetchEssbio: oc
    .route({ method: "POST", path: "/fetch/essbio" })
    .input(z.object({ serviceNumber: z.string().min(1) }))
    .output(z.object({ bill: essbioBillResultSchema, status: z.literal("ok") })),

  fetchCge: oc
    .route({ method: "POST", path: "/fetch/cge" })
    .input(z.object({ accountNumber: z.string().min(1) }))
    .output(z.object({ bill: cgeBillResultSchema, status: z.literal("ok") })),
};

export type UtilityBillsContract = typeof utilityBillsContract;
