import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { OrdersAdminContract } from "@finanzas/orpc-contracts/orders-admin";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const ordersAdminORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type OrdersAdminORPCClient = ContractRouterClient<OrdersAdminContract>;

export const ordersAdminORPCClient = createORPCClient(ordersAdminORPCLink, {
  path: ["api", "orpc", "orders-admin", "rpc"],
}) as OrdersAdminORPCClient;

export const toOrdersAdminApiError = toApiError;
