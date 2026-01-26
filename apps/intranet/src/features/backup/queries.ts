import { queryOptions } from "@tanstack/react-query";

import { fetchBackups, fetchTables } from "./api";

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
    }),
};
