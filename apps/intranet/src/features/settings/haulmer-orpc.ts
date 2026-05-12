import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { HaulmerContract } from "@finanzas/orpc-contracts/haulmer";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type HaulmerORPCClient = ContractRouterClient<HaulmerContract>;

const haulmerORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const haulmerORPCClient = createORPCClient(haulmerORPCLink, {
  path: ["api", "orpc", "haulmer", "rpc"],
}) as HaulmerORPCClient;

export function toHaulmerApiError(error: unknown): ApiError {
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
