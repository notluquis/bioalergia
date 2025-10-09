import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../../../context/AuthContext";
import { fetchParticipantLeaderboard } from "../../participants/api";
import type { ParticipantSummaryRow } from "../../participants/types";
import type { BalancesApiResponse } from "../../balances/types";
import { fetchBalances } from "../../balances/api";
import { useQuickDateRange } from "../../balances/hooks/useQuickDateRange";
import { apiClient } from "../../../lib/apiClient";

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
  const [from, setFrom] = useState(dayjs().subtract(3, "month").startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [balancesReport, setBalancesReport] = useState<BalancesApiResponse | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [topParticipants, setTopParticipants] = useState<ParticipantSummaryRow[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const { quickMonths } = useQuickDateRange();

  const quickRange = useMemo(() => {
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  }, [quickMonths, from, to]);

  const loadBalances = useCallback(async (fromValue: string, toValue: string) => {
    if (!fromValue || !toValue) {
      setBalancesReport(null);
      return;
    }

    setBalancesLoading(true);
    setBalancesError(null);
    try {
      const payload = await fetchBalances(fromValue, toValue);
      setBalancesReport(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los saldos diarios";
      setBalancesError(message);
      setBalancesReport(null);
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async (fromValue: string, toValue: string) => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const params: { limit: number; mode: "outgoing" | "combined"; from?: string; to?: string } = {
        limit: 5,
        mode: "outgoing",
      };
      if (fromValue) params.from = fromValue;
      if (toValue) params.to = toValue;
      const response = await fetchParticipantLeaderboard(params);
      setTopParticipants(response.participants);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los retiros principales";
      setParticipantsError(message);
      setTopParticipants([]);
    } finally {
      setParticipantsLoading(false);
    }
  }, []);

  const fetchStatsWithRange = useCallback(
    async (fromValue: string, toValue: string) => {
      if (!canView) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (fromValue) params.set("from", fromValue);
        if (toValue) params.set("to", toValue);
        const payload = await apiClient.get<StatsResponse>(`/api/transactions/stats?${params.toString()}`);
        setData(payload);
        await Promise.all([loadBalances(fromValue, toValue), loadLeaderboard(fromValue, toValue)]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [canView, loadBalances, loadLeaderboard]
  );

  const fetchStats = useCallback(async () => {
    await fetchStatsWithRange(from, to);
  }, [from, to, fetchStatsWithRange]);

  useEffect(() => {
    if (!canView) return;
    fetchStats();
  }, [canView, fetchStats]);

  return {
    from,
    setFrom,
    to,
    setTo,
    quickRange,
    quickMonths,
    loading,
    error,
    data,
    balancesReport,
    balancesLoading,
    balancesError,
    topParticipants,
    participantsLoading,
    participantsError,
    fetchStats,
    fetchStatsWithRange,
  };
}
