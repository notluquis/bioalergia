import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalAllergensContract } from "@finanzas/orpc-contracts/clinical-allergens";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const clinicalAllergensORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ClinicalAllergensORPCClient = ContractRouterClient<ClinicalAllergensContract>;

export const clinicalAllergensORPCClient = createORPCClient(clinicalAllergensORPCLink, {
  path: ["api", "orpc", "clinical-allergens", "rpc"],
}) as ClinicalAllergensORPCClient;

export function toAllergensApiError(error: unknown): ApiError {
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
