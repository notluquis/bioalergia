import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { VerificationContract } from "@finanzas/orpc-contracts/verification";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type VerificationORPCClient = ContractRouterClient<VerificationContract>;

const verificationORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const verificationORPCClient = createORPCClient(verificationORPCLink, {
  path: ["api", "orpc", "verification", "rpc"],
}) as VerificationORPCClient;

export const toVerificationApiError = toApiError;
