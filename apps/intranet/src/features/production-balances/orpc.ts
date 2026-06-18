import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProductionBalancesContract } from "@finanzas/orpc-contracts/production-balances";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const productionBalancesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ProductionBalancesORPCClient = ContractRouterClient<ProductionBalancesContract>;

export const productionBalancesORPCClient = createORPCClient(productionBalancesORPCLink, {
  path: ["api", "orpc", "production-balances", "rpc"],
}) as ProductionBalancesORPCClient;

export const toProductionBalancesApiError = toApiError;
