import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalRecordsContract } from "@finanzas/orpc-contracts/clinical-records";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const clinicalRecordsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ClinicalRecordsORPCClient = ContractRouterClient<ClinicalRecordsContract>;

export const clinicalRecordsORPCClient = createORPCClient(clinicalRecordsORPCLink, {
  path: ["api", "orpc", "clinical-records", "rpc"],
}) as ClinicalRecordsORPCClient;

export function toClinicalRecordsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}
