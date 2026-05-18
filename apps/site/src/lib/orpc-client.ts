import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AccountContract } from "@finanzas/orpc-contracts/account";
import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";
import type { SiteAuthContract } from "@finanzas/orpc-contracts/site-auth";

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

export const siteAuthClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "site-auth", "rpc"],
}) as ContractRouterClient<SiteAuthContract>;

export const accountClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "account", "rpc"],
}) as ContractRouterClient<AccountContract>;
