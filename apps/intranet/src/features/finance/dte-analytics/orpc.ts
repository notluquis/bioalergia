import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DteAnalyticsContract } from "@finanzas/orpc-contracts/dte-analytics";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type DteAnalyticsORPCClient = ContractRouterClient<DteAnalyticsContract>;

const dteAnalyticsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const dteAnalyticsORPCClient = createORPCClient(dteAnalyticsORPCLink, {
  path: ["api", "orpc", "dte-analytics", "rpc"],
}) as DteAnalyticsORPCClient;

export const toDteAnalyticsApiError = toApiError;
