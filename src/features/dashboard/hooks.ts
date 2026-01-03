import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DbMovement } from "@/features/finance/transactions/types";
import { queryKeys } from "@/lib/queryKeys";

import { fetchRecentMovements, fetchStats, type StatsResponse } from "./api";

type StatsParams = {
  from: string;
  to: string;
};

const RECENT_MOVEMENTS_PARAMS = { page: 1, pageSize: 5, includeAmounts: true };

export function useDashboardStats(params: StatsParams, options?: { enabled?: boolean }) {
  return useQuery<StatsResponse>({
    queryKey: queryKeys.dashboard.stats(params),
    queryFn: () => fetchStats(params.from, params.to),
    enabled: Boolean(params.from && params.to) && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useRecentMovements(options?: { enabled?: boolean }) {
  return useQuery<DbMovement[]>({
    queryKey: queryKeys.dashboard.recentMovements(RECENT_MOVEMENTS_PARAMS),
    queryFn: fetchRecentMovements,
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
