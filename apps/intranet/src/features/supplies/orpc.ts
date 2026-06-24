import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SuppliesContract } from "@finanzas/orpc-contracts/supplies";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const suppliesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type SuppliesORPCClient = ContractRouterClient<SuppliesContract>;

export const suppliesORPCClient = createORPCClient(suppliesORPCLink, {
  path: ["api", "orpc", "supplies", "rpc"],
}) as SuppliesORPCClient;

export const toSuppliesApiError = toApiError;
