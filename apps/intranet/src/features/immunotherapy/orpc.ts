import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ImmunotherapyContract } from "@finanzas/orpc-contracts/immunotherapy";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const immunotherapyORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ImmunotherapyORPCClient = ContractRouterClient<ImmunotherapyContract>;

export const immunotherapyORPCClient = createORPCClient(immunotherapyORPCLink, {
  path: ["api", "orpc", "immunotherapy", "rpc"],
}) as ImmunotherapyORPCClient;

export function toImmunotherapyApiError(error: unknown): ApiError {
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
