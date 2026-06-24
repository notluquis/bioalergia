import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { MlContract } from "@finanzas/orpc-contracts/ml";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { csrfFetch } from "@/lib/csrf-fetch";

export type MlORPCClient = ContractRouterClient<MlContract>;

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const mlORPCClient = createORPCClient(link, {
  path: ["api", "orpc", "ml", "rpc"],
}) as MlORPCClient;
