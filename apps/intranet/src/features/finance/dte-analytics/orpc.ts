import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { DTEPurchaseDetail, DTESalesDetail, DTESummaryRaw } from "./types";

type DteAnalyticsORPCClient = {
  purchasesAvailablePeriods: () => Promise<{ data: string[]; status: "success" }>;
  purchasesDetails: (input: { page?: number; pageSize?: number; period?: string }) => Promise<{
    data: DTEPurchaseDetail[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
    status: "success";
  }>;
  purchasesSummary: (input?: {
    endPeriod?: string;
    startPeriod?: string;
    year?: number;
  }) => Promise<{ data: DTESummaryRaw[]; status: "success" }>;
  salesAvailablePeriods: () => Promise<{ data: string[]; status: "success" }>;
  salesDetails: (input: { page?: number; pageSize?: number; period?: string }) => Promise<{
    data: DTESalesDetail[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
    status: "success";
  }>;
  salesSummary: (input?: {
    endPeriod?: string;
    startPeriod?: string;
    year?: number;
  }) => Promise<{ data: DTESummaryRaw[]; status: "success" }>;
};

const dteAnalyticsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteAnalyticsORPCClient = createORPCClient<DteAnalyticsORPCClient>(
  dteAnalyticsORPCLink,
  {
    path: ["api", "orpc", "dte-analytics", "rpc"],
  },
);

export function toDteAnalyticsApiError(error: unknown): ApiError {
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
