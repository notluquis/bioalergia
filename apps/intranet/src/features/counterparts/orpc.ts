import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import {
  type CounterpartsContract,
  counterpartPayloadSchema,
} from "@finanzas/orpc-contracts/counterparts";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { z } from "zod";

type CounterpartUpsertPayload = z.input<typeof counterpartPayloadSchema>;

const counterpartsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type CounterpartsORPCClient = ContractRouterClient<CounterpartsContract>;

export const counterpartsORPCClient = createORPCClient(counterpartsORPCLink, {
  path: ["api", "orpc", "counterparts", "rpc"],
}) as CounterpartsORPCClient;

export function toCounterpartsApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}

export type { CounterpartUpsertPayload };
