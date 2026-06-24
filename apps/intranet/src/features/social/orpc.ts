import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { SocialContract } from "@finanzas/orpc-contracts/social";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const socialORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type SocialORPCClient = ContractRouterClient<SocialContract>;

export const socialORPCClient = createORPCClient(socialORPCLink, {
  path: ["api", "orpc", "social", "rpc"],
}) as SocialORPCClient;

export const toSocialApiError = toApiError;
