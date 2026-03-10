import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { ListResponse as SettlementListResponse } from "./settlements/types";

type SettlementTransactionsORPCClient = {
  detail: (input: { id: number }) => Promise<{ data: unknown; status: "ok" }>;
  list: (input?: {
    from?: string;
    page?: number;
    pageSize?: number;
    paymentMethod?: string;
    search?: string;
    to?: string;
    transactionType?: string;
  }) => Promise<SettlementListResponse>;
};

const settlementTransactionsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const settlementTransactionsORPCClient = createORPCClient<SettlementTransactionsORPCClient>(
  settlementTransactionsORPCLink,
  {
    path: ["api", "orpc", "settlement-transactions", "rpc"],
  },
);

export function toSettlementTransactionsApiError(error: unknown): ApiError {
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
