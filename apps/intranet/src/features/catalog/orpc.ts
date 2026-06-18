import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type CatalogORPCClient = ContractRouterClient<CatalogContract>;

const catalogORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const catalogORPCClient = createORPCClient(catalogORPCLink, {
  path: ["api", "orpc", "catalog", "rpc"],
}) as CatalogORPCClient;

export const toCatalogApiError = toApiError;
