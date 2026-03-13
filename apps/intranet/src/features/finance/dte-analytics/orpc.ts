import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DteAnalyticsContract } from "@finanzas/orpc-contracts/dte-analytics";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type DteAnalyticsORPCClient = ContractRouterClient<DteAnalyticsContract>;

const dteAnalyticsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteAnalyticsORPCClient = createORPCClient(dteAnalyticsORPCLink, {
  path: ["api", "orpc", "dte-analytics", "rpc"],
}) as DteAnalyticsORPCClient;

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
