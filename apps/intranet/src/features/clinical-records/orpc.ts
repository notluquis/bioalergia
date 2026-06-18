import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ClinicalRecordsContract } from "@finanzas/orpc-contracts/clinical-records";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const clinicalRecordsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ClinicalRecordsORPCClient = ContractRouterClient<ClinicalRecordsContract>;

export const clinicalRecordsORPCClient = createORPCClient(clinicalRecordsORPCLink, {
  path: ["api", "orpc", "clinical-records", "rpc"],
}) as ClinicalRecordsORPCClient;

export const toClinicalRecordsApiError = toApiError;
