import { queryOptions } from "@tanstack/react-query";

import { fetchCalendarSyncLogs } from "./api";

export const calendarSyncKeys = {
  all: ["calendar-sync"] as const,
  logs: (limit: number) => ["calendar-sync", "logs", limit] as const,
};

export const calendarSyncQueries = {
  logs: (limit = 50) =>
    queryOptions({
      queryKey: calendarSyncKeys.logs(limit),
      queryFn: () => fetchCalendarSyncLogs(limit),
      staleTime: 60 * 1000,
    }),
};
