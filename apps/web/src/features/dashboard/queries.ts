import { queryOptions } from "@tanstack/react-query";

import { fetchRecentMovements, fetchStats } from "./api";

type StatsParams = {
  from: string;
  to: string;
};

const RECENT_MOVEMENTS_PARAMS = { page: 1, pageSize: 5, includeAmounts: true };

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: (params: StatsParams) =>
    queryOptions({
      queryKey: ["dashboard", "stats", params],
      queryFn: () => fetchStats(params.from, params.to),
    }),
  recentMovements: () =>
    queryOptions({
      queryKey: ["dashboard", "recentMovements", RECENT_MOVEMENTS_PARAMS],
      queryFn: fetchRecentMovements,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    }),
};
