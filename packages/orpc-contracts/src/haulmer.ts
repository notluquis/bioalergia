import { oc } from "@orpc/contract";
import { z } from "zod";

export const haulmerSyncResultSchema = z.object({
  docType: z.enum(["sales", "purchases"]),
  error: z.string().nullable().optional(),
  period: z.string(),
  rowsInserted: z.number(),
  rowsProcessed: z.number(),
  rowsUpdated: z.number(),
  status: z.enum(["failed", "skipped", "success"]),
});

export const haulmerAvailablePeriodsResponseSchema = z.object({
  purchases: z.array(
    z.object({
      count: z.number(),
      periodo: z.string(),
    }),
  ),
  sales: z.array(
    z.object({
      count: z.number(),
      periodo: z.string(),
    }),
  ),
  status: z.literal("ok"),
});

export const haulmerSyncInputSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).min(1),
  periods: z.array(z.string()).min(1),
});

export const haulmerIncrementalSyncInputSchema = z.object({
  docTypes: z.array(z.enum(["sales", "purchases"])).optional(),
  includeLatestAlreadySynced: z.boolean().optional().default(true),
});

export const haulmerSyncResponseSchema = z.object({
  message: z.string().optional(),
  mode: z.literal("incremental").optional(),
  results: z.array(haulmerSyncResultSchema),
  status: z.literal("ok"),
  summary: z.object({
    failed: z.number(),
    success: z.number(),
    total: z.number(),
  }),
});

export const haulmerContract = {
  availablePeriods: oc
    .route({ method: "GET", path: "/available-periods" })
    .output(haulmerAvailablePeriodsResponseSchema),
  sync: oc
    .route({ method: "POST", path: "/sync" })
    .input(haulmerSyncInputSchema)
    .output(haulmerSyncResponseSchema),
  syncIncremental: oc
    .route({ method: "POST", path: "/sync/incremental" })
    .input(haulmerIncrementalSyncInputSchema)
    .output(haulmerSyncResponseSchema),
};

export type HaulmerContract = typeof haulmerContract;
