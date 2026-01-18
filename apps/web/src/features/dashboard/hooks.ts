import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

import type { Transaction } from "../finance/types";

import { fetchRecentMovements, fetchStats, type StatsResponse } from "./api";

interface StatsParams {
  from: string;
  to: string;
}

const RECENT_MOVEMENTS_PARAMS = { includeAmounts: true, page: 1, pageSize: 5 };

export function useDashboardStats(params: StatsParams, options?: { enabled?: boolean }) {
  const shouldFetch = Boolean(params.from && params.to) && (options?.enabled ?? true);

  return useQuery<StatsResponse>({
    enabled: shouldFetch,
    queryFn: () => fetchStats(params.from, params.to),
    queryKey: queryKeys.dashboard.stats(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useRecentMovements(options?: { enabled?: boolean }) {
  const shouldFetch = options?.enabled ?? true;

  return useQuery<Transaction[]>({
    enabled: shouldFetch,
    gcTime: 5 * 60 * 1000,
    queryFn: fetchRecentMovements,
    queryKey: queryKeys.dashboard.recentMovements(RECENT_MOVEMENTS_PARAMS),
    staleTime: 60 * 1000,
  });
}
