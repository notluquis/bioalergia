import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { InventoryContract } from "@finanzas/orpc-contracts/inventory";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type InventoryORPCClient = ContractRouterClient<InventoryContract>;

const inventoryORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const inventoryORPCClient = createORPCClient(inventoryORPCLink, {
  path: ["api", "orpc", "inventory", "rpc"],
}) as InventoryORPCClient;

export const toInventoryApiError = toApiError;
