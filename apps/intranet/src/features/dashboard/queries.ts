import { queryOptions } from "@tanstack/react-query";

import { fetchRecentMovements, fetchStats } from "./api";

interface StatsParams {
  from: string;
  to: string;
}

const RECENT_MOVEMENTS_PARAMS = { includeAmounts: true, page: 1, pageSize: 5 };

export const dashboardKeys = {
  all: ["dashboard"] as const,
  recentMovements: () =>
    queryOptions({
      gcTime: 5 * 60 * 1000,
      queryFn: fetchRecentMovements,
      queryKey: ["dashboard", "recentMovements", RECENT_MOVEMENTS_PARAMS],
      staleTime: 60 * 1000,
    }),
  stats: (params: StatsParams) =>
    queryOptions({
      queryFn: () => fetchStats(params.from, params.to),
      queryKey: ["dashboard", "stats", params],
    }),
};
