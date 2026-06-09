/**
 * Statistics Data Hook
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { addMonths, today } from "@/lib/dates";
import { balanceKeys } from "@/features/finance/balances/queries";
import type { BalancesApiResponse } from "@/features/finance/balances/types";
import { statsKeys } from "../queries";
import type { StatsResponse, TopParticipantData } from "../types";

interface UseStatsDataResult {
  balancesError: null | string;
  balancesLoading: boolean;
  balancesReport: BalancesApiResponse | null;
  data: null | StatsResponse;
  error: null | string;
  from: string;
  loading: boolean;
  participantsError: null | string;
  participantsLoading: boolean;
  refetch: () => Promise<void>;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  to: string;
  topParticipants: TopParticipantData[];
}

export function useStatsData(): UseStatsDataResult {
  const { can } = useAuth();
  const [from, setFrom] = useState(addMonths(today(), -3));
  const [to, setTo] = useState(today());

  const canView = can("read", "Transaction");

  // Stats query
  const statsQuery = useSuspenseQuery(statsKeys.main(from, to));

  // Balances query
  const balancesQuery = useSuspenseQuery(balanceKeys.range(from, to));

  // Top participants query
  const participantsQuery = useSuspenseQuery(statsKeys.participants(from, to));

  const refetch = async () => {
    if (!canView) {
      return;
    }
    await Promise.all([statsQuery.refetch(), balancesQuery.refetch(), participantsQuery.refetch()]);
  };

  return {
    balancesError: balancesQuery.error?.message ?? null,
    balancesLoading: balancesQuery.isPending || balancesQuery.isFetching,
    balancesReport: balancesQuery.data ?? null,
    data: statsQuery.data ?? null,
    error: statsQuery.error?.message ?? null,
    from,
    loading: statsQuery.isPending || statsQuery.isFetching,
    participantsError: participantsQuery.error?.message ?? null,
    participantsLoading: participantsQuery.isPending || participantsQuery.isFetching,
    refetch,
    setFrom,
    setTo,
    to,
    topParticipants: participantsQuery.data ?? [],
  };
}
