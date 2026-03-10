import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { BalancesApiResponse } from "./types";

type BalancesORPCClient = {
  list: (input: { from: string; to: string }) => Promise<BalancesApiResponse>;
  save: (input: { balance: number; date: string; note?: string }) => Promise<{ status: "ok" }>;
};

const balancesORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const balancesORPCClient = createORPCClient<BalancesORPCClient>(balancesORPCLink, {
  path: ["api", "orpc", "balances", "rpc"],
});

export function toBalancesApiError(error: unknown): ApiError {
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
