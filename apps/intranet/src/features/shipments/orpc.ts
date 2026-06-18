import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ShipmentsContract } from "@finanzas/orpc-contracts/shipments";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const shipmentsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type ShipmentsORPCClient = ContractRouterClient<ShipmentsContract>;

export const shipmentsORPCClient = createORPCClient(shipmentsORPCLink, {
  path: ["api", "orpc", "shipments", "rpc"],
}) as ShipmentsORPCClient;

export const toShipmentsApiError = toApiError;
