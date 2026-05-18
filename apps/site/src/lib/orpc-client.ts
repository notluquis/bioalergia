import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";

import { siteSuperJSONLink } from "@/lib/superjson-link";

export const catalogClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "catalog", "rpc"],
}) as ContractRouterClient<CatalogContract>;

export const cartClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "cart", "rpc"],
}) as ContractRouterClient<CartContract>;

export const checkoutClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "checkout", "rpc"],
}) as ContractRouterClient<CheckoutContract>;
