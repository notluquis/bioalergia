import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { OperationalRegistersContract } from "@finanzas/orpc-contracts/operational-registers";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type OperationalRegistersORPCClient = ContractRouterClient<OperationalRegistersContract>;

const operationalRegistersORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const operationalRegistersORPCClient = createORPCClient(operationalRegistersORPCLink, {
  path: ["api", "orpc", "operational-registers", "rpc"],
}) as OperationalRegistersORPCClient;

export const toOperationalRegistersApiError = toApiError;
