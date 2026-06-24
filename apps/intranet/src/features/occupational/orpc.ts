import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { OccupationalContract } from "@finanzas/orpc-contracts/occupational";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

const occupationalORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export type OccupationalORPCClient = ContractRouterClient<OccupationalContract>;

export const occupationalORPCClient = createORPCClient(occupationalORPCLink, {
  path: ["api", "orpc", "occupational", "rpc"],
}) as OccupationalORPCClient;

export function toOccupationalApiError(error: unknown): ApiError {
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
