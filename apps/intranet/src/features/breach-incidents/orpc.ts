import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { BreachIncidentsContract } from "@finanzas/orpc-contracts/breach-incidents";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type BreachIncidentsORPCClient = ContractRouterClient<BreachIncidentsContract>;

const breachIncidentsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const breachIncidentsORPCClient = createORPCClient(breachIncidentsORPCLink, {
  path: ["api", "orpc", "breach-incidents", "rpc"],
}) as BreachIncidentsORPCClient;

export function toBreachIncidentsApiError(error: unknown): ApiError {
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
