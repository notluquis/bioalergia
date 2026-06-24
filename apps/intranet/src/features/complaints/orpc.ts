import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ComplaintsContract } from "@finanzas/orpc-contracts/complaints";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type ComplaintsORPCClient = ContractRouterClient<ComplaintsContract>;

const complaintsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const complaintsORPCClient = createORPCClient(complaintsORPCLink, {
  path: ["api", "orpc", "complaints", "rpc"],
}) as ComplaintsORPCClient;

export const toComplaintsApiError = toApiError;
