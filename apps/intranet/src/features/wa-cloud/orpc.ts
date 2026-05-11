import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { WaCloudContract } from "@finanzas/orpc-contracts/wa-cloud";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type WaCloudORPCClient = ContractRouterClient<WaCloudContract>;

const link = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const waCloudORPCClient = createORPCClient(link, {
  path: ["api", "orpc", "wa-cloud", "rpc"],
}) as WaCloudORPCClient;

export function toWaCloudApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ORPCError) return new ApiError(error.message, error.status, error.data);
  if (error instanceof Error) return new ApiError(error.message, 500);
  return new ApiError("Error inesperado", 500, error);
}
