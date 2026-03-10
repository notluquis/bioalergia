import { z } from "zod";
import { dteSyncORPCClient, toDTESyncApiError } from "./dte-sync-orpc";

export const DTESyncLogSchema = z.object({
  completedAt: z.coerce.date().nullable().optional(),
  docTypes: z.string(),
  errorMessage: z.string().nullable().optional(),
  id: z.string(),
  period: z.string(),
  purchasesInserted: z.number().nullable().optional(),
  salesInserted: z.number().nullable().optional(),
  startedAt: z.coerce.date(),
  status: z.enum(["PENDING", "IN_PROGRESS", "SUCCESS", "PARTIAL", "FAILED"]),
  totalInserted: z.number().nullable().optional(),
  totalProcessed: z.number().nullable().optional(),
  totalSkipped: z.number().nullable().optional(),
  totalUpdated: z.number().nullable().optional(),
  triggerSource: z.string().nullable().optional(),
});

export const DTESyncHistorySchema = z.object({
  logs: z.array(DTESyncLogSchema),
  total: z.number(),
});

export async function fetchDTESyncHistory(limit: number = 50, offset: number = 0) {
  try {
    const response = await dteSyncORPCClient.syncHistory({ limit, offset });
    return DTESyncHistorySchema.parse({
      logs: response.logs.map((log) => ({
        completedAt: log.completedAt,
        docTypes: log.docTypes,
        errorMessage: log.errorMessage,
        id: log.id,
        period: log.period,
        purchasesInserted: log.purchasesInserted,
        salesInserted: log.salesInserted,
        startedAt: log.startedAt,
        status: log.status,
        totalInserted: log.totalInserted,
        totalProcessed: log.totalProcessed,
        totalSkipped: log.totalSkipped,
        totalUpdated: log.totalUpdated,
        triggerSource: log.triggerSource,
      })),
      total: response.pagination.total,
    });
  } catch (error) {
    throw toDTESyncApiError(error);
  }
}
