import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SystemContract } from "@finanzas/orpc-contracts/system";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type SystemORPCClient = ContractRouterClient<SystemContract>;

const systemORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const systemORPCClient = createORPCClient(systemORPCLink, {
  path: ["api", "orpc", "system", "rpc"],
}) as SystemORPCClient;

export const toSystemApiError = toApiError;
