import { queryOptions } from "@tanstack/react-query";

import { fetchBackups, fetchTables } from "./api";

export const backupKeys = {
  all: ["backups"] as const,
  lists: () =>
    queryOptions({
      queryKey: ["backups"],
      queryFn: fetchBackups,
    }),
  tables: (fileId: string) =>
    queryOptions({
      queryKey: ["backup-tables", fileId],
      queryFn: () => fetchTables(fileId),
    }),
};
