import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AddressesContract } from "@finanzas/orpc-contracts/addresses";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const addressesORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type AddressesORPCClient = ContractRouterClient<AddressesContract>;

export const addressesORPCClient = createORPCClient(addressesORPCLink, {
  path: ["api", "orpc", "addresses", "rpc"],
}) as AddressesORPCClient;

export const toAddressesApiError = toApiError;
