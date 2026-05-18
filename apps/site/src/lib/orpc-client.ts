import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";

import { csrfFetch } from "@/lib/csrf-fetch";

const apiBase = import.meta.env.VITE_API_URL ?? window.location.origin;

const link = new RPCLink({
  url: `${apiBase}`,
  fetch: csrfFetch,
});

export const catalogClient = createORPCClient(link, {
  path: ["api", "orpc", "catalog", "rpc"],
}) as ContractRouterClient<CatalogContract>;

export const cartClient = createORPCClient(link, {
  path: ["api", "orpc", "cart", "rpc"],
}) as ContractRouterClient<CartContract>;

export const checkoutClient = createORPCClient(link, {
  path: ["api", "orpc", "checkout", "rpc"],
}) as ContractRouterClient<CheckoutContract>;
