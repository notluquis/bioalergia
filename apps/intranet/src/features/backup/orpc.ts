import { createORPCClient, ORPCError } from "@orpc/client";
import { SuperJSONLink } from "@/features/calendar/orpc";
import { ApiError } from "@/lib/api-client";
import type { BackupFile, BackupJob, RestoreJob } from "./types";

type BackupsORPCClient = {
  history: () => Promise<{ history: unknown[]; status: "ok" }>;
  list: () => Promise<{
    backups: BackupFile[];
    error?: string;
    jobs: unknown[];
    status: "ok";
    warning?: string;
  }>;
  logs: () => Promise<{ logs: unknown[]; status: "ok" }>;
  restore: (input: { fileId: string; tables?: string[] }) => Promise<{
    job: RestoreJob;
    status: "ok";
  }>;
  tables: (input: { fileId: string }) => Promise<{ status: "ok"; tables: string[] }>;
  trigger: () => Promise<{ job: BackupJob; message: string; status: "ok" }>;
};

const backupsORPCLink = new SuperJSONLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const backupsORPCClient = createORPCClient<BackupsORPCClient>(backupsORPCLink, {
  path: ["api", "orpc", "backups", "rpc"],
});

export function toBackupsApiError(error: unknown): ApiError {
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
