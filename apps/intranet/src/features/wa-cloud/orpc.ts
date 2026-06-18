import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { WaCloudContract } from "@finanzas/orpc-contracts/wa-cloud";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type WaCloudORPCClient = ContractRouterClient<WaCloudContract>;

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const waCloudORPCClient = createORPCClient(link, {
  path: ["api", "orpc", "wa-cloud", "rpc"],
}) as WaCloudORPCClient;

export const toWaCloudApiError = toApiError;
