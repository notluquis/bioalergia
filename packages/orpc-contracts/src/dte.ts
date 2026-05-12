import { oc } from "@orpc/contract";
import { z } from "zod";

export const dteSyncHistoryInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const dteSyncInputSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).optional(),
  period: z.string().optional(),
});

export const dteSyncLogSchema = z.object({
  completedAt: z.date().nullable().optional(),
  docTypes: z.string(),
  errorMessage: z.string().nullable().optional(),
  id: z.string(),
  period: z.string(),
  purchasesInserted: z.number().nullable().optional(),
  salesInserted: z.number().nullable().optional(),
  startedAt: z.date(),
  status: z.string(),
  totalInserted: z.number().nullable().optional(),
  totalProcessed: z.number().nullable().optional(),
  totalSkipped: z.number().nullable().optional(),
  totalUpdated: z.number().nullable().optional(),
  triggerSource: z.string().nullable().optional(),
});

export const dteSyncHistoryResponseSchema = z.object({
  logs: z.array(dteSyncLogSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }),
});

export const dteSyncResultSchema = z.object({
  docType: z.string(),
  inserted: z.number(),
  processed: z.number(),
  status: z.string(),
  updated: z.number(),
});

export const dteSyncResponseSchema = z.object({
  logId: z.string(),
  period: z.string(),
  results: z.array(dteSyncResultSchema),
  status: z.enum(["failed", "partial", "success"]),
});

// ─── DTE → Expense matcher schemas ────────────────────────────────────────
export const dteMatchStatusSchema = z.enum([
  "ALREADY_LINKED",
  "CREATED_EXPENSE",
  "LINKED_EXISTING",
  "NO_MATCH",
  "ERROR",
]);

export const dteMatchResultSchema = z.object({
  dteId: z.string(),
  expenseId: z.number().int().nullable(),
  reason: z.string(),
  status: dteMatchStatusSchema,
});

export const dteReconcileInputSchema = z.object({
  daysBack: z.number().int().min(1).max(730).optional().default(90),
  limit: z.number().int().min(1).max(2000).optional().default(500),
});

export const dteReconcileResponseSchema = z.object({
  results: z.array(dteMatchResultSchema),
  summary: z.object({
    alreadyLinked: z.number().int(),
    createdExpense: z.number().int(),
    error: z.number().int(),
    linkedExisting: z.number().int(),
    noMatch: z.number().int(),
    total: z.number().int(),
  }),
});

export const dteRetryMatchInputSchema = z.object({ dteId: z.string() });
export const dteLinkExpenseInputSchema = z.object({
  dteId: z.string(),
  expenseId: z.number().int(),
});
export const dteUnlinkExpenseInputSchema = z.object({ dteId: z.string() });

export const dteLinkExpenseResponseSchema = z.object({
  dteId: z.string(),
  expenseId: z.number().int().nullable(),
  reason: z.string(),
  status: z.string(),
});

export const dteUnlinkExpenseResponseSchema = z.object({ success: z.boolean() });

export const dteContract = {
  linkExpense: oc
    .route({ method: "POST", path: "/link-expense" })
    .input(dteLinkExpenseInputSchema)
    .output(dteLinkExpenseResponseSchema),
  reconcileUnmatched: oc
    .route({ method: "POST", path: "/reconcile-unmatched" })
    .input(dteReconcileInputSchema)
    .output(dteReconcileResponseSchema),
  retryMatch: oc
    .route({ method: "POST", path: "/retry-match" })
    .input(dteRetryMatchInputSchema)
    .output(dteMatchResultSchema),
  sync: oc
    .route({ method: "POST", path: "/sync" })
    .input(dteSyncInputSchema)
    .output(dteSyncResponseSchema),
  syncHistory: oc
    .route({ method: "GET", path: "/sync-history" })
    .input(dteSyncHistoryInputSchema)
    .output(dteSyncHistoryResponseSchema),
  unlinkExpense: oc
    .route({ method: "POST", path: "/unlink-expense" })
    .input(dteUnlinkExpenseInputSchema)
    .output(dteUnlinkExpenseResponseSchema),
};

export type DteContract = typeof dteContract;
