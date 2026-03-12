import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { ProductionBalancesORPCRouter } from "../../../../api/src/orpc/production-balances";

const productionBalancesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type ProductionBalancesORPCClient = RouterClient<ProductionBalancesORPCRouter>;

export const productionBalancesORPCClient = createORPCClient<ProductionBalancesORPCClient>(
  productionBalancesORPCLink,
  {
    path: ["api", "orpc", "production-balances", "rpc"],
  }
);

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
