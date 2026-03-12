import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { BalancesORPCRouter } from "../../../../../api/src/orpc/balances";

const balancesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type BalancesORPCClient = RouterClient<BalancesORPCRouter>;

export const balancesORPCClient = createORPCClient<BalancesORPCClient>(balancesORPCLink, {
  path: ["api", "orpc", "balances", "rpc"],
});

export function toBalancesApiError(error: unknown): ApiError {
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
