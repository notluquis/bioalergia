import type { SiteContentContract } from "@finanzas/orpc-contracts/site-content";
import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";

import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const siteContentORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type SiteContentORPCClient = ContractRouterClient<SiteContentContract>;

export const siteContentORPCClient = createORPCClient(siteContentORPCLink, {
  path: ["api", "orpc", "site-content", "rpc"],
}) as SiteContentORPCClient;

export function toSiteContentApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}
