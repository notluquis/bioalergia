import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { FinanceContract } from "@finanzas/orpc-contracts/finance";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type FinanceORPCClient = ContractRouterClient<FinanceContract>;

const financeORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const financeORPCClient = createORPCClient<FinanceORPCClient>(financeORPCLink, {
  path: ["api", "orpc", "finance", "rpc"],
});

export const toFinanceApiError = toApiError;
