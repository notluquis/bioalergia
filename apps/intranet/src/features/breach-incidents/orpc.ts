import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { BreachIncidentsContract } from "@finanzas/orpc-contracts/breach-incidents";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type BreachIncidentsORPCClient = ContractRouterClient<BreachIncidentsContract>;

const breachIncidentsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const breachIncidentsORPCClient = createORPCClient(breachIncidentsORPCLink, {
  path: ["api", "orpc", "breach-incidents", "rpc"],
}) as BreachIncidentsORPCClient;

export const toBreachIncidentsApiError = toApiError;
