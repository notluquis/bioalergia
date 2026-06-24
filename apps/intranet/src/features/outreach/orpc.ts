import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { OutreachContract } from "@finanzas/orpc-contracts/outreach";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type OutreachORPCClient = ContractRouterClient<OutreachContract>;

const outreachLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const outreachORPCClient = createORPCClient(outreachLink, {
  path: ["api", "orpc", "outreach", "rpc"],
}) as OutreachORPCClient;

export const toOutreachApiError = toApiError;
