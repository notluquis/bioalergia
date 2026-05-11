import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { PatientCampaignsContract } from "@finanzas/orpc-contracts/patient-campaigns";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const patientCampaignsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type PatientCampaignsORPCClient = ContractRouterClient<PatientCampaignsContract>;

export const patientCampaignsORPCClient = createORPCClient(patientCampaignsORPCLink, {
  path: ["api", "orpc", "patient-campaigns", "rpc"],
}) as PatientCampaignsORPCClient;

export function toPatientCampaignsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}
