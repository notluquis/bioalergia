import { skipToken, useSuspenseQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import type { Transaction } from "../finance/types";
import { fetchRecentMovements, fetchStats, type StatsResponse } from "./api";

type StatsParams = {
  from: string;
  to: string;
};

const RECENT_MOVEMENTS_PARAMS = { page: 1, pageSize: 5, includeAmounts: true };

export function useDashboardStats(params: StatsParams, options?: { enabled?: boolean }) {
  const shouldFetch = Boolean(params.from && params.to) && (options?.enabled ?? true);

  return useSuspenseQuery<StatsResponse>({
    queryKey: queryKeys.dashboard.stats(params),
    queryFn: shouldFetch ? () => fetchStats(params.from, params.to) : (skipToken as any),
    staleTime: 2 * 60 * 1000,
  });
}

export function useRecentMovements(options?: { enabled?: boolean }) {
  const shouldFetch = options?.enabled ?? true;

  return useSuspenseQuery<Transaction[]>({
    queryKey: queryKeys.dashboard.recentMovements(RECENT_MOVEMENTS_PARAMS),
    queryFn: shouldFetch ? fetchRecentMovements : (skipToken as any),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
