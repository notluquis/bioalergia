import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { BalancesContract } from "@finanzas/orpc-contracts/balances";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const balancesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type BalancesORPCClient = ContractRouterClient<BalancesContract>;

export const balancesORPCClient = createORPCClient(balancesORPCLink, {
  path: ["api", "orpc", "balances", "rpc"],
}) as BalancesORPCClient;

export const toBalancesApiError = toApiError;
