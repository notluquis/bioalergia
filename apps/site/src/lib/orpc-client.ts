import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";

const apiBase = import.meta.env.VITE_API_URL ?? window.location.origin;

const link = new RPCLink({
  url: `${apiBase}`,
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});

export const catalogClient = createORPCClient(link, {
  path: ["api", "orpc", "catalog", "rpc"],
}) as ContractRouterClient<CatalogContract>;

export const cartClient = createORPCClient(link, {
  path: ["api", "orpc", "cart", "rpc"],
}) as ContractRouterClient<CartContract>;
