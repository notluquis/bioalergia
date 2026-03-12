import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { InternalSettings } from "./api";
import type { AppSettings } from "./hooks/use-settings";

type SettingsORPCClient = {
  app: () => Promise<AppSettings>;
  updateApp: (input: AppSettings) => Promise<{
    message?: string;
    status: string;
  }>;
  internal: () => Promise<{ internal: InternalSettings }>;
  updateInternal: (input: { upsertChunkSize?: number }) => Promise<{
    message?: string;
    status: string;
  }>;
  uploadAsset: (input: { assetType: "favicon" | "logo" }) => Promise<{
    message?: string;
    status: string;
  }>;
};

const settingsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const settingsORPCClient = createORPCClient<SettingsORPCClient>(settingsORPCLink, {
  path: ["api", "orpc", "settings", "rpc"],
});

export function toSettingsApiError(error: unknown): ApiError {
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
