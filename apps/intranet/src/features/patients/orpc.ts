import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { PatientsContract } from "@finanzas/orpc-contracts/patients";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const patientsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type PatientsORPCClient = ContractRouterClient<PatientsContract>;

export const patientsORPCClient = createORPCClient(patientsORPCLink, {
  path: ["api", "orpc", "patients", "rpc"],
}) as PatientsORPCClient;

export const toPatientsApiError = toApiError;
