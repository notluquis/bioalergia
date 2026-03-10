import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

type FinanceORPCClient = {
  autoCategoryRulesCreate: (input: Record<string, unknown>) => Promise<{
    data?: unknown;
    status: "ok";
  }>;
  autoCategoryRulesDelete: (input: { id: number }) => Promise<{ status: "ok" }>;
  autoCategoryRulesList: () => Promise<{ data: unknown[]; status: "ok" }>;
  autoCategoryRulesUpdate: (input: {
    id: number;
    payload: Record<string, unknown>;
  }) => Promise<{ data?: unknown; status: "ok" }>;
  categoriesCreate: (input: Record<string, unknown>) => Promise<{ data?: unknown; status: "ok" }>;
  categoriesDelete: (input: { id: number }) => Promise<{ status: "ok" }>;
  categoriesList: () => Promise<{ data: unknown[]; status: "ok" }>;
  categoriesUpdate: (input: {
    id: number;
    payload: Record<string, unknown>;
  }) => Promise<{ data?: unknown; status: "ok" }>;
  compensationProfilesCreate: (input: Record<string, unknown>) => Promise<{
    data?: unknown;
    status: "ok";
  }>;
  compensationProfilesLedger: (input: {
    fromPeriod: string;
    id: number;
    toPeriod: string;
  }) => Promise<{ data: unknown[]; status: "ok" }>;
  compensationProfilesList: () => Promise<{ data: unknown[]; status: "ok" }>;
  compensationProfilesUpdate: (input: {
    id: number;
    payload: Record<string, unknown>;
  }) => Promise<{ data?: unknown; status: "ok" }>;
  compensationProfilesUpsertBudget: (input: {
    id: number;
    payload: Record<string, unknown>;
  }) => Promise<{ data?: unknown; status: "ok" }>;
  sync: () => Promise<{ data?: unknown; status: "ok" }>;
  syncUncategorizedPatterns: () => Promise<{ data?: unknown; status: "ok" }>;
  transactionsAvailableMonths: () => Promise<{ data: string[]; status: "ok" }>;
  transactionsCreate: (input: Record<string, unknown>) => Promise<{ data?: unknown; status: "ok" }>;
  transactionsDelete: (input: { id: number }) => Promise<{ message?: string; status: "ok" }>;
  transactionsList: (input?: Record<string, unknown>) => Promise<{
    data: unknown[];
    meta?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    status: "ok";
  }>;
  transactionsReallocate: (input: Record<string, unknown>) => Promise<{
    data?: unknown;
    status: "ok";
  }>;
  transactionsSummary: (input?: Record<string, unknown>) => Promise<{
    data: unknown;
    status: "ok";
  }>;
  transactionsUpdate: (input: {
    id: number;
    payload: Record<string, unknown>;
  }) => Promise<{ data?: unknown; status: "ok" }>;
};

const financeORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const financeORPCClient = createORPCClient<FinanceORPCClient>(financeORPCLink, {
  path: ["api", "orpc", "finance", "rpc"],
});

export function toFinanceApiError(error: unknown): ApiError {
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
