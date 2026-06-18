import type { ImmunotherapyContract } from "@finanzas/orpc-contracts/immunotherapy";
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const immunotherapyORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ImmunotherapyORPCClient = ContractRouterClient<ImmunotherapyContract>;

export const immunotherapyORPCClient = createORPCClient(immunotherapyORPCLink, {
  path: ["api", "orpc", "immunotherapy", "rpc"],
}) as ImmunotherapyORPCClient;

export const toImmunotherapyApiError = toApiError;
