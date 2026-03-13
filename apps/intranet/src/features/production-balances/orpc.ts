import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProductionBalancesContract } from "@finanzas/orpc-contracts/production-balances";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const productionBalancesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type ProductionBalancesORPCClient = ContractRouterClient<ProductionBalancesContract>;

export const productionBalancesORPCClient = createORPCClient(productionBalancesORPCLink, {
  path: ["api", "orpc", "production-balances", "rpc"],
}) as ProductionBalancesORPCClient;

export function toProductionBalancesApiError(error: unknown): ApiError {
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
