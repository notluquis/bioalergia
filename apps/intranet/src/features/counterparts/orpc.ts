import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type {
  CounterpartsContract,
  counterpartPayloadSchema,
} from "@finanzas/orpc-contracts/counterparts";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { toApiError } from "@/lib/api-client";
import type { z } from "zod";
import { csrfFetch } from "@/lib/csrf-fetch";

type CounterpartUpsertPayload = z.input<typeof counterpartPayloadSchema>;

const counterpartsORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type CounterpartsORPCClient = ContractRouterClient<CounterpartsContract>;

export const counterpartsORPCClient = createORPCClient(counterpartsORPCLink, {
  path: ["api", "orpc", "counterparts", "rpc"],
}) as CounterpartsORPCClient;

export const toCounterpartsApiError = toApiError;

export type { CounterpartUpsertPayload };
