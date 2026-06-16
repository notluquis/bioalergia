import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DataRightsContract } from "@finanzas/orpc-contracts/data-rights";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type DataRightsORPCClient = ContractRouterClient<DataRightsContract>;

const dataRightsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const dataRightsORPCClient = createORPCClient(dataRightsORPCLink, {
  path: ["api", "orpc", "data-rights", "rpc"],
}) as DataRightsORPCClient;

export function toDataRightsApiError(error: unknown): ApiError {
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
