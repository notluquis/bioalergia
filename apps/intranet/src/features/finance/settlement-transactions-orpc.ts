import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SettlementTransactionsContract } from "@finanzas/orpc-contracts/settlement-transactions";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type SettlementTransactionsORPCClient = ContractRouterClient<SettlementTransactionsContract>;

const settlementTransactionsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const settlementTransactionsORPCClient = createORPCClient(settlementTransactionsORPCLink, {
  path: ["api", "orpc", "settlement-transactions", "rpc"],
}) as SettlementTransactionsORPCClient;

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
