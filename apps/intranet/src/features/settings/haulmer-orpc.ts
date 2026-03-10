import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type HaulmerORPCClient = {
  availablePeriods: () => Promise<{
    purchases: Array<{ count: number; periodo: string }>;
    sales: Array<{ count: number; periodo: string }>;
    status: "ok";
  }>;
  sync: (input: { docTypes: Array<"purchases" | "sales">; periods: string[] }) => Promise<{
    results: Array<{
      docType: "purchases" | "sales";
      error?: null | string;
      period: string;
      rowsInserted: number;
      rowsProcessed: number;
      rowsUpdated: number;
      status: "failed" | "skipped" | "success";
    }>;
    status: "ok";
    summary: { failed: number; success: number; total: number };
  }>;
  syncIncremental: (input: {
    docTypes?: Array<"purchases" | "sales">;
    includeLatestAlreadySynced?: boolean;
  }) => Promise<{
    message?: string;
    mode?: "incremental";
    results: Array<{
      docType: "purchases" | "sales";
      error?: null | string;
      period: string;
      rowsInserted: number;
      rowsProcessed: number;
      rowsUpdated: number;
      status: "failed" | "skipped" | "success";
    }>;
    status: "ok";
    summary: { failed: number; success: number; total: number };
  }>;
};

const haulmerORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const haulmerORPCClient = createORPCClient<HaulmerORPCClient>(haulmerORPCLink, {
  path: ["api", "orpc", "haulmer", "rpc"],
});

export function toHaulmerApiError(error: unknown): ApiError {
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
