import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DteContract } from "@finanzas/orpc-contracts/dte";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type DTESyncORPCClient = ContractRouterClient<DteContract>;

const dteSyncORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const dteSyncORPCClient = createORPCClient(dteSyncORPCLink, {
  path: ["api", "orpc", "dte", "rpc"],
}) as DTESyncORPCClient;

export function toDTESyncApiError(error: unknown): ApiError {
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
