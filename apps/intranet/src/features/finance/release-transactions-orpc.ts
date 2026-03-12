import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { ReleaseTransactionsORPCRouter } from "../../../../api/src/orpc/release-transactions";

export type ReleaseTransactionsORPCClient = RouterClient<ReleaseTransactionsORPCRouter>;

const releaseTransactionsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const releaseTransactionsORPCClient = createORPCClient<ReleaseTransactionsORPCClient>(
  releaseTransactionsORPCLink,
  {
    path: ["api", "orpc", "release-transactions", "rpc"],
  }
);

export function toReleaseTransactionsApiError(error: unknown): ApiError {
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
