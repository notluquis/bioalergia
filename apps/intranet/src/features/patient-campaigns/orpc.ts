import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { PatientCampaignsContract } from "@finanzas/orpc-contracts/patient-campaigns";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const patientCampaignsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type PatientCampaignsORPCClient = ContractRouterClient<PatientCampaignsContract>;

export const patientCampaignsORPCClient = createORPCClient(patientCampaignsORPCLink, {
  path: ["api", "orpc", "patient-campaigns", "rpc"],
}) as PatientCampaignsORPCClient;

export const toPatientCampaignsApiError = toApiError;
