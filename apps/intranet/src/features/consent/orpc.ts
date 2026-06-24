import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { ConsentContract } from "@finanzas/orpc-contracts/consent";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type ConsentORPCClient = ContractRouterClient<ConsentContract>;

const consentORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const consentORPCClient = createORPCClient(consentORPCLink, {
  path: ["api", "orpc", "consent", "rpc"],
}) as ConsentORPCClient;

export const toConsentApiError = toApiError;
