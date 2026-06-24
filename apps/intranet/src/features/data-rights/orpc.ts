import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { DataRightsContract } from "@finanzas/orpc-contracts/data-rights";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type DataRightsORPCClient = ContractRouterClient<DataRightsContract>;

const dataRightsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const dataRightsORPCClient = createORPCClient(dataRightsORPCLink, {
  path: ["api", "orpc", "data-rights", "rpc"],
}) as DataRightsORPCClient;

export const toDataRightsApiError = toApiError;
