import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type DTESyncORPCClient = {
  sync: (input: { docTypes?: Array<"purchases" | "sales">; period?: string }) => Promise<{
    logId: string;
    period: string;
    results: Array<{
      docType: string;
      inserted: number;
      processed: number;
      status: string;
      updated: number;
    }>;
    status: "failed" | "partial" | "success";
  }>;
  syncHistory: (input?: { limit?: number; offset?: number }) => Promise<{
    logs: Array<{
      completedAt?: Date | null;
      docTypes: string;
      errorMessage?: null | string;
      id: string;
      period: string;
      purchasesInserted?: null | number;
      salesInserted?: null | number;
      startedAt: Date;
      status: string;
      totalInserted?: null | number;
      totalProcessed?: null | number;
      totalSkipped?: null | number;
      totalUpdated?: null | number;
      triggerSource?: null | string;
    }>;
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
  }>;
};

const dteSyncORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteSyncORPCClient = createORPCClient<DTESyncORPCClient>(dteSyncORPCLink, {
  path: ["api", "orpc", "dte", "rpc"],
});

export function toDTESyncApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }
  return new ApiError("Error inesperado", 500, error);
}
