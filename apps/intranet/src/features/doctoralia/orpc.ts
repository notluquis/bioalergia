import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DoctoraliaContract } from "@finanzas/orpc-contracts/doctoralia";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const doctoraliaORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type DoctoraliaORPCClient = ContractRouterClient<DoctoraliaContract>;

export const doctoraliaORPCClient = createORPCClient(doctoraliaORPCLink, {
  path: ["api", "orpc", "doctoralia", "rpc"],
}) as DoctoraliaORPCClient;

export const toDoctoraliaApiError = toApiError;
