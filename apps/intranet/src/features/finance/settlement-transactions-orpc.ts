import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { SettlementTransactionsORPCRouter } from "../../../../api/src/orpc/settlement-transactions";

export type SettlementTransactionsORPCClient = RouterClient<SettlementTransactionsORPCRouter>;

const settlementTransactionsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const settlementTransactionsORPCClient = createORPCClient<SettlementTransactionsORPCClient>(
  settlementTransactionsORPCLink,
  {
    path: ["api", "orpc", "settlement-transactions", "rpc"],
  }
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
