import { createORPCClient, ORPCError } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { IntegrationsContract } from "@finanzas/orpc-contracts/integrations";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import { csrfFetch } from "@/lib/csrf-fetch";

export type GoogleDriveORPCClient = ContractRouterClient<IntegrationsContract>;

const googleDriveORPCLink = new SuperJSONLink({
  fetch: csrfFetch,
  url: () => window.location.origin,
});

export const googleDriveORPCClient = createORPCClient(googleDriveORPCLink, {
  path: ["api", "orpc", "integrations", "rpc"],
}) as GoogleDriveORPCClient;

export function toGoogleDriveApiError(error: unknown): ApiError {
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
