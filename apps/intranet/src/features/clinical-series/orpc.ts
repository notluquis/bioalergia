import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalSeriesContract } from "@finanzas/orpc-contracts/clinical-series";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const clinicalSeriesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ClinicalSeriesORPCClient = ContractRouterClient<ClinicalSeriesContract>;

export const clinicalSeriesORPCClient = createORPCClient(clinicalSeriesORPCLink, {
  path: ["api", "orpc", "clinical-series", "rpc"],
}) as ClinicalSeriesORPCClient;

export function toClinicalSeriesApiError(error: unknown): ApiError {
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
