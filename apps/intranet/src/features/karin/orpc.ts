import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { KarinContract } from "@finanzas/orpc-contracts/karin";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type KarinORPCClient = ContractRouterClient<KarinContract>;

const karinORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const karinORPCClient = createORPCClient(karinORPCLink, {
  path: ["api", "orpc", "karin", "rpc"],
}) as KarinORPCClient;

export const toKarinApiError = toApiError;
