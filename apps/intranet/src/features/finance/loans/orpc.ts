import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { LoansContract } from "@finanzas/orpc-contracts/loans";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type LoansORPCClient = ContractRouterClient<LoansContract>;

const loansORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const loansORPCClient = createORPCClient(loansORPCLink, {
  path: ["api", "orpc", "loans", "rpc"],
}) as LoansORPCClient;

export const toLoansApiError = toApiError;
