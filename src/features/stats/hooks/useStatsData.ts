import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useAuth } from "../../../context/AuthContext";
import { fetchParticipantLeaderboard } from "../../participants/api";
import type { ParticipantSummaryRow } from "../../participants/types";
import type { BalancesApiResponse } from "../../balances/types";
import { fetchBalances } from "../../balances/api";
import { useQuickDateRange } from "../../balances/hooks/useQuickDateRange";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys } from "../../../lib/queryKeys";
import { useParticipantLeaderboardQuery } from "../../participants/hooks";

type StatsResponse = {
  status: "ok";
  monthly: Array<{ month: string; in: number; out: number; net: number }>;
  totals: Record<string, number>;
  byType: Array<{ description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }>;
};

interface UseStatsDataResult {
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  quickRange: string;
  quickMonths: Array<{ value: string; label: string; from: string; to: string }>;
  loading: boolean;
  error: string | null;
  data: StatsResponse | null;
  balancesReport: BalancesApiResponse | null;
  balancesLoading: boolean;
  balancesError: string | null;
  topParticipants: ParticipantSummaryRow[];
  participantsLoading: boolean;
  participantsError: string | null;
  fetchStats: () => Promise<void>;
  fetchStatsWithRange: (fromValue: string, toValue: string) => Promise<void>;
}

export function useStatsData(): UseStatsDataResult {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(
    dayjs().subtract(3, "month").startOf("month").format("YYYY-MM-DD")
  );
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const { quickMonths } = useQuickDateRange();

  const quickRange = useMemo(() => {
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  }, [quickMonths, from, to]);

  const fetchStatsForRange = useCallback((fromValue: string, toValue: string) => {
    const params = new URLSearchParams();
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    return apiClient.get<StatsResponse>(`/api/transactions/stats?${params.toString()}`);
  }, []);

  const statsQuery = useQuery<StatsResponse, Error>({
    queryKey: queryKeys.stats.overview({ from, to }),
    queryFn: () => fetchStatsForRange(from, to),
    enabled: canView && Boolean(from && to),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });

  const balancesQuery = useQuery<BalancesApiResponse, Error>({
    queryKey: queryKeys.balances.report({ from, to }),
    queryFn: () => fetchBalances(from, to),
    enabled: canView && Boolean(from && to),
    staleTime: 2 * 60 * 1000,
  });

  const participantsQuery = useParticipantLeaderboardQuery(
    { from, to, limit: 5, mode: "outgoing" },
    { enabled: canView && Boolean(from && to) }
  );

  const fetchStats = useCallback(async () => {
    if (!canView) return;
    await Promise.all([
      statsQuery.refetch(),
      balancesQuery.refetch(),
      participantsQuery.refetch?.(),
    ]);
  }, [canView, statsQuery, balancesQuery, participantsQuery]);

  const fetchStatsWithRange = useCallback(
    async (fromValue: string, toValue: string) => {
      if (!canView) return;
      setFrom(fromValue);
      setTo(toValue);
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.stats.overview({ from: fromValue, to: toValue }),
          queryFn: () => fetchStatsForRange(fromValue, toValue),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.balances.report({ from: fromValue, to: toValue }),
          queryFn: () => fetchBalances(fromValue, toValue),
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.participants.leaderboard({
            from: fromValue,
            to: toValue,
            limit: 5,
            mode: "outgoing",
          }),
          queryFn: () =>
            fetchParticipantLeaderboard({
              from: fromValue,
              to: toValue,
              limit: 5,
              mode: "outgoing",
            }),
        }),
      ]);
    },
    [canView, queryClient, fetchStatsForRange]
  );

  return {
    from,
    setFrom,
    to,
    setTo,
    quickRange,
    quickMonths,
    loading: statsQuery.isPending || statsQuery.isFetching,
    error: statsQuery.error?.message ?? null,
    data: statsQuery.data ?? null,
    balancesReport: balancesQuery.data ?? null,
    balancesLoading: balancesQuery.isPending || balancesQuery.isFetching,
    balancesError: balancesQuery.error?.message ?? null,
    topParticipants: participantsQuery.data ?? [],
    participantsLoading: participantsQuery.isPending || participantsQuery.isFetching,
    participantsError: participantsQuery.error instanceof Error ? participantsQuery.error.message : null,
    fetchStats,
    fetchStatsWithRange,
  };
}
