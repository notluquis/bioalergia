import { createORPCClient, ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { IntegrationsORPCRouter } from "../../../../api/src/orpc/integrations";

export type GoogleDriveStatus = {
  configured: boolean;
  error?: string;
  errorCode?: "invalid_grant" | "token_expired" | "token_revoked" | "unknown";
  source: "db" | "env" | "none";
  valid: boolean;
};

const googleDriveORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export type GoogleDriveORPCClient = RouterClient<IntegrationsORPCRouter>;

export const googleDriveORPCClient = createORPCClient<GoogleDriveORPCClient>(googleDriveORPCLink, {
  path: ["api", "orpc", "integrations", "rpc"],
});

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
