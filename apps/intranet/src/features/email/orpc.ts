import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { EmailContract } from "@finanzas/orpc-contracts/email";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const emailORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type EmailORPCClient = ContractRouterClient<EmailContract>;

export const emailORPCClient = createORPCClient(emailORPCLink, {
  path: ["api", "orpc", "email", "rpc"],
}) as EmailORPCClient;

export const toEmailApiError = toApiError;
