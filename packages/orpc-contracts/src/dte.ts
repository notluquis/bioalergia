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

export const dteContract = {
  sync: oc.route({ method: "POST", path: "/sync" }).input(dteSyncInputSchema).output(dteSyncResponseSchema),
  syncHistory: oc
    .route({ method: "GET", path: "/sync-history" })
    .input(dteSyncHistoryInputSchema)
    .output(dteSyncHistoryResponseSchema),
};

export type DteContract = typeof dteContract;
