import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalSeriesContract } from "@finanzas/orpc-contracts/clinical-series";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const clinicalSeriesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ClinicalSeriesORPCClient = ContractRouterClient<ClinicalSeriesContract>;

export const clinicalSeriesORPCClient = createORPCClient(clinicalSeriesORPCLink, {
  path: ["api", "orpc", "clinical-series", "rpc"],
}) as ClinicalSeriesORPCClient;

export const toClinicalSeriesApiError = toApiError;
