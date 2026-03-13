import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ReleaseTransactionsContract } from "@finanzas/orpc-contracts/release-transactions";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type ReleaseTransactionsORPCClient = ContractRouterClient<ReleaseTransactionsContract>;

const releaseTransactionsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const releaseTransactionsORPCClient = createORPCClient(releaseTransactionsORPCLink, {
  path: ["api", "orpc", "release-transactions", "rpc"],
}) as ReleaseTransactionsORPCClient;

export function toReleaseTransactionsApiError(error: unknown): ApiError {
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
