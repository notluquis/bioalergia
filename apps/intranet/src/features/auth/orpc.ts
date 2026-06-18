import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AuthContract } from "@finanzas/orpc-contracts/auth";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type AuthORPCClient = ContractRouterClient<AuthContract>;

const authORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const authORPCClient = createORPCClient<AuthORPCClient>(authORPCLink, {
  path: ["api", "orpc", "auth", "rpc"],
});

export const toAuthApiError = toApiError;
