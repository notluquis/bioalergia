import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ReactivosContract } from "@finanzas/orpc-contracts/reactivos";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const reactivosORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ReactivosORPCClient = ContractRouterClient<ReactivosContract>;

export const reactivosORPCClient = createORPCClient(reactivosORPCLink, {
  path: ["api", "orpc", "reactivos", "rpc"],
}) as ReactivosORPCClient;

export function toReactivosApiError(error: unknown): ApiError {
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
