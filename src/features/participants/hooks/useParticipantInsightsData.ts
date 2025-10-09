import { useState, useEffect, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import { fetchParticipantInsight, fetchParticipantLeaderboard } from "../api";
import type {
  ParticipantCounterpartRow,
  ParticipantMonthlyRow,
  ParticipantSummaryRow,
  LeaderboardDisplayRow,
} from "../types";
import { formatRut } from "../../../lib/rut";

const MAX_MONTHS = 12;

type RangeParams = {
  from?: string;
  to?: string;
};

function resolveRange(quickValue: string, fromValue: string, toValue: string): RangeParams {
  if (quickValue === "custom") {
    const range: RangeParams = {};
    if (fromValue) range.from = fromValue;
    if (toValue) range.to = toValue;
    return range;
  }

  const value = quickValue === "current" ? dayjs().format("YYYY-MM") : quickValue;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return {};
  }

  const start = dayjs(new Date(year, monthIndex, 1));
  const end = start.endOf("month");

  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}

export function useParticipantInsightsData() {
  const [participantId, setParticipantId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quickMonth, setQuickMonth] = useState("current");
  const [monthly, setMonthly] = useState<ParticipantMonthlyRow[]>([]);
  const [counterparts, setCounterparts] = useState<ParticipantCounterpartRow[]>([]);
  const [visible, setVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<ParticipantSummaryRow[]>([]);
  const [leaderboardLimit, setLeaderboardLimit] = useState(10);
  const [leaderboardGrouping, setLeaderboardGrouping] = useState<"account" | "rut">("account");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeParams>(() => resolveRange("current", "", ""));
  const activeParticipantId = participantId.trim();

  const accountRows = useMemo<LeaderboardDisplayRow[]>(() => {
    return leaderboard.map((row) => {
      const selectKey = row.participant || row.bankAccountNumber || row.withdrawId || row.identificationNumber || "";
      const displayName = row.bankAccountHolder || row.displayName || row.participant || "(sin información)";
      const rut = row.identificationNumber ? formatRut(row.identificationNumber) || "-" : "-";
      const account = row.bankAccountNumber || row.withdrawId || row.participant || "-";
      return {
        key: selectKey || `${displayName}-${account}`,
        displayName,
        rut,
        account,
        outgoingCount: row.outgoingCount,
        outgoingAmount: row.outgoingAmount,
        selectKey,
      };
    });
  }, [leaderboard]);

  const rutRows = useMemo<LeaderboardDisplayRow[]>(() => {
    const map = new Map<
      string,
      {
        displayName: string;
        rut: string;
        accounts: Set<string>;
        outgoingCount: number;
        outgoingAmount: number;
        selectKey: string;
      }
    >();
    accountRows.forEach((row) => {
      const key = row.rut !== "-" ? row.rut : row.displayName;
      if (!map.has(key)) {
        map.set(key, {
          displayName: row.displayName,
          rut: row.rut !== "-" ? row.rut : "-",
          accounts: new Set<string>(),
          outgoingCount: 0,
          outgoingAmount: 0,
          selectKey: row.selectKey,
        });
      }
      const entry = map.get(key)!;
      entry.outgoingCount += row.outgoingCount;
      entry.outgoingAmount += row.outgoingAmount;
      if (row.account && row.account !== "-") {
        entry.accounts.add(row.account);
      }
      if ((!entry.displayName || entry.displayName === "(sin información)") && row.displayName) {
        entry.displayName = row.displayName;
      }
      if (!entry.selectKey && row.selectKey) {
        entry.selectKey = row.selectKey;
      }
    });
    return Array.from(map.entries())
      .map(([key, entry]) => ({
        key,
        displayName: entry.displayName,
        rut: entry.rut,
        account: entry.accounts.size ? Array.from(entry.accounts).slice(0, 4).join(", ") : "-",
        outgoingCount: entry.outgoingCount,
        outgoingAmount: entry.outgoingAmount,
        selectKey: entry.selectKey,
      }))
      .sort((a, b) => {
        if (b.outgoingAmount !== a.outgoingAmount) return b.outgoingAmount - a.outgoingAmount;
        return b.outgoingCount - a.outgoingCount;
      });
  }, [accountRows]);

  const displayedLeaderboard = useMemo<LeaderboardDisplayRow[]>(
    () => (leaderboardGrouping === "account" ? accountRows : rutRows),
    [leaderboardGrouping, accountRows, rutRows]
  );

  const quickMonthOptions = useMemo(() => {
    const options = [{ value: "current", label: "Mes actual" }];
    for (let i = 1; i < MAX_MONTHS; i += 1) {
      const date = dayjs().subtract(i, "month");
      options.push({ value: date.format("YYYY-MM"), label: date.format("MMMM YYYY") });
    }
    options.push({ value: "custom", label: "Personalizado" });
    return options;
  }, []);

  const loadParticipant = useCallback(async (participant: string, range: RangeParams) => {
    const trimmed = participant.trim();
    if (!trimmed) {
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    try {
      const data = await fetchParticipantInsight(trimmed, range);
      setMonthly(data.monthly);
      setCounterparts(data.counterparts);
      setVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener la información";
      setDetailError(message);
      setMonthly([]);
      setCounterparts([]);
      setVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const rangeParams = resolveRange(quickMonth, from, to);
      setSelectedRange(rangeParams);

      const trimmedId = activeParticipantId;

      if (!trimmedId) {
        setDetailError(null);
        setMonthly([]);
        setCounterparts([]);
        setVisible(false);
        return;
      }

      await loadParticipant(trimmedId, rangeParams);
    },
    [activeParticipantId, from, loadParticipant, quickMonth, to]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError(null);

      try {
        const data = await fetchParticipantLeaderboard({
          ...selectedRange,
          limit: leaderboardLimit,
          mode: "outgoing",
        });

        if (!cancelled) {
          setLeaderboard(data.participants);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "No se pudo obtener el ranking de participantes";
          setLeaderboardError(message);
          setLeaderboard([]);
        }
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [selectedRange, leaderboardLimit]);

  const handleSelectParticipant = useCallback(
    async (participant: string) => {
      setParticipantId(participant);
      await loadParticipant(participant, selectedRange);
    },
    [loadParticipant, selectedRange]
  );

  return {
    participantId,
    setParticipantId,
    from,
    setFrom,
    to,
    setTo,
    quickMonth,
    setQuickMonth,
    monthly,
    counterparts,
    visible,
    detailLoading,
    detailError,
    leaderboard,
    leaderboardLimit,
    setLeaderboardLimit,
    leaderboardGrouping,
    setLeaderboardGrouping,
    leaderboardLoading,
    leaderboardError,
    selectedRange,
    activeParticipantId,
    accountRows,
    rutRows,
    displayedLeaderboard,
    quickMonthOptions,
    loadParticipant,
    handleSubmit,
    handleSelectParticipant,
  };
}
