/**
 * Statistics Data Hook
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { balanceKeys } from "@/features/finance/balances/queries";
import type { BalancesApiResponse } from "@/features/finance/balances/types";

import { statsKeys } from "../queries";
import type { StatsResponse, TopParticipantData } from "../types";

interface UseStatsDataResult {
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  loading: boolean;
  error: string | null;
  data: StatsResponse | null;
  balancesReport: BalancesApiResponse | null;
  balancesLoading: boolean;
  balancesError: string | null;
  topParticipants: TopParticipantData[];
  participantsLoading: boolean;
  participantsError: string | null;
  refetch: () => Promise<void>;
}

export function useStatsData(): UseStatsDataResult {
  const { can } = useAuth();
  const [from, setFrom] = useState(dayjs().subtract(3, "month").startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  const canView = can("read", "Transaction");

  // Stats query
  const statsQuery = useSuspenseQuery(statsKeys.main(from, to));

  // Balances query
  const balancesQuery = useSuspenseQuery(balanceKeys.range(from, to));

  // Top participants query
  const participantsQuery = useSuspenseQuery(statsKeys.participants(from, to));

  const refetch = async () => {
    if (!canView) return;
    await Promise.all([statsQuery.refetch(), balancesQuery.refetch(), participantsQuery.refetch()]);
  };

  return {
    from,
    setFrom,
    to,
    setTo,
    loading: statsQuery.isPending || statsQuery.isFetching,
    error: statsQuery.error?.message ?? null,
    data: statsQuery.data ?? null,
    balancesReport: balancesQuery.data ?? null,
    balancesLoading: balancesQuery.isPending || balancesQuery.isFetching,
    balancesError: balancesQuery.error?.message ?? null,
    topParticipants: participantsQuery.data ?? [],
    participantsLoading: participantsQuery.isPending || participantsQuery.isFetching,
    participantsError: participantsQuery.error?.message ?? null,
    refetch,
  };
}
