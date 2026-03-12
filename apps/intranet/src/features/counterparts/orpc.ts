import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { CounterpartCategory } from "./types";
import type { CounterpartsORPCRouter } from "../../../../api/src/orpc/counterparts";

type CounterpartUpsertPayload = {
  bankAccountHolder: string;
  category?: CounterpartCategory;
  identificationNumber: string;
  notes?: null | string;
};

const counterpartsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type CounterpartsORPCClient = RouterClient<CounterpartsORPCRouter>;

export const counterpartsORPCClient = createORPCClient<CounterpartsORPCClient>(
  counterpartsORPCLink,
  {
    path: ["api", "orpc", "counterparts", "rpc"],
  }
);

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
