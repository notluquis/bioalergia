import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AdherenceContract } from "@finanzas/orpc-contracts/adherence";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const adherenceORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type AdherenceORPCClient = ContractRouterClient<AdherenceContract>;

export const adherenceORPCClient = createORPCClient(adherenceORPCLink, {
  path: ["api", "orpc", "adherence", "rpc"],
}) as AdherenceORPCClient;

export function toAdherenceApiError(error: unknown): ApiError {
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
