import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchRecentMovements, fetchStats, type StatsResponse } from "./api";
import type { DbMovement } from "../transactions/types";
import { queryKeys } from "../../lib/queryKeys";

type StatsParams = {
  from: string;
  to: string;
};

const RECENT_MOVEMENTS_PARAMS = { page: 1, pageSize: 5, includeAmounts: true };

export function useDashboardStats(params: StatsParams) {
  return useQuery<StatsResponse>({
    queryKey: queryKeys.dashboard.stats(params),
    queryFn: () => fetchStats(params.from, params.to),
    enabled: Boolean(params.from && params.to),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useRecentMovements() {
  return useQuery<DbMovement[]>({
    queryKey: queryKeys.dashboard.recentMovements(RECENT_MOVEMENTS_PARAMS),
    queryFn: fetchRecentMovements,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
