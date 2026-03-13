import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SuppliesContract } from "@finanzas/orpc-contracts/supplies";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

const suppliesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type SuppliesORPCClient = ContractRouterClient<SuppliesContract>;

export const suppliesORPCClient = createORPCClient(suppliesORPCLink, {
  path: ["api", "orpc", "supplies", "rpc"],
}) as SuppliesORPCClient;

export function toSuppliesApiError(error: unknown): ApiError {
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
