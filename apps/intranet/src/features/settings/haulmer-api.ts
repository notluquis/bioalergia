import { z } from "zod";
import { haulmerORPCClient, toHaulmerApiError } from "./haulmer-orpc";

export const AvailablePeriodsSchema = z.object({
  purchases: z.array(z.object({ count: z.number(), periodo: z.string() })),
  sales: z.array(z.object({ count: z.number(), periodo: z.string() })),
  status: z.string(),
});

export const SyncResultSchema = z.object({
  docType: z.enum(["sales", "purchases"]),
  error: z.string().nullable().optional(),
  period: z.string(),
  rowsInserted: z.number(),
  rowsProcessed: z.number(),
  rowsUpdated: z.number(),
  status: z.enum(["success", "failed", "skipped"]),
});

export const SyncResponseSchema = z.object({
  message: z.string().optional(),
  mode: z.literal("incremental").optional(),
  results: z.array(SyncResultSchema),
  status: z.string(),
  summary: z.object({
    failed: z.number(),
    success: z.number(),
    total: z.number(),
  }),
});

export async function fetchHaulmerAvailablePeriods() {
  try {
    return AvailablePeriodsSchema.parse(await haulmerORPCClient.availablePeriods());
  } catch (error) {
    throw toHaulmerApiError(error);
  }
}

export async function syncHaulmerPeriods(input: {
  docTypes: Array<"purchases" | "sales">;
  periods: string[];
}) {
  try {
    return SyncResponseSchema.parse(await haulmerORPCClient.sync(input));
  } catch (error) {
    throw toHaulmerApiError(error);
  }
}

export async function syncHaulmerIncremental(input?: {
  docTypes?: Array<"purchases" | "sales">;
  includeLatestAlreadySynced?: boolean;
}) {
  try {
    return SyncResponseSchema.parse(await haulmerORPCClient.syncIncremental(input ?? {}));
  } catch (error) {
    throw toHaulmerApiError(error);
  }
}
