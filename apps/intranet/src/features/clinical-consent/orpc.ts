import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalConsentContract } from "@finanzas/orpc-contracts/clinical-consent";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type ClinicalConsentORPCClient = ContractRouterClient<ClinicalConsentContract>;

const clinicalConsentORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const clinicalConsentORPCClient = createORPCClient(clinicalConsentORPCLink, {
  path: ["api", "orpc", "clinical-consent", "rpc"],
}) as ClinicalConsentORPCClient;

export const toClinicalConsentApiError = toApiError;
