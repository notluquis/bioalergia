import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";

export type GoogleDriveStatus = {
  configured: boolean;
  error?: string;
  errorCode?: "invalid_grant" | "token_expired" | "token_revoked" | "unknown";
  source: "db" | "env" | "none";
  valid: boolean;
};

type GoogleDriveORPCClient = {
  googleDisconnect: (input: Record<string, never>) => Promise<{ success: true }>;
  googleStatus: () => Promise<GoogleDriveStatus>;
  googleUrl: () => Promise<{ url: string }>;
};

const googleDriveORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

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
