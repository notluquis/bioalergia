import type { SiteContentContract } from "@finanzas/orpc-contracts/site-content";
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";

import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const siteContentORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type SiteContentORPCClient = ContractRouterClient<SiteContentContract>;

export const siteContentORPCClient = createORPCClient(siteContentORPCLink, {
  path: ["api", "orpc", "site-content", "rpc"],
}) as SiteContentORPCClient;

export const toSiteContentApiError = toApiError;
