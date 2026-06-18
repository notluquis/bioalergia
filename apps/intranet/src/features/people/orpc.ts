import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { PeopleContract } from "@finanzas/orpc-contracts/people";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const peopleORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type PeopleORPCClient = ContractRouterClient<PeopleContract>;

export const peopleORPCClient = createORPCClient(peopleORPCLink, {
  path: ["api", "orpc", "people", "rpc"],
}) as PeopleORPCClient;

export const toPeopleApiError = toApiError;
