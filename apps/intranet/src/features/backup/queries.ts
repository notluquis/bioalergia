import { queryOptions } from "@tanstack/react-query";

import { fetchBackups, fetchTables } from "./api";
import { ApiError } from "@/lib/api-client";

function shouldRetryBackupTables(failureCount: number, error: Error) {
  if (failureCount >= 1) {
    return false;
  }

  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429;
  }

  return true;
}

export const backupKeys = {
  all: ["backups"] as const,
  lists: () =>
    queryOptions({
      queryFn: fetchBackups,
      queryKey: ["backups"],
    }),
  tables: (fileId: string) =>
    queryOptions({
      queryFn: () => fetchTables(fileId),
      queryKey: ["backup-tables", fileId],
      retry: shouldRetryBackupTables,
      staleTime: 60_000,
    }),
};
