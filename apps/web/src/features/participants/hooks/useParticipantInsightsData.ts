import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";

import { formatRut } from "@/lib/rut";

import { type LeaderboardParams, participantQueries } from "../queries";
import type { LeaderboardDisplayRow } from "../types";

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
  // Filters
  const [participantId, setParticipantId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quickMonth, setQuickMonth] = useState("current");
  const [leaderboardLimit, setLeaderboardLimit] = useState(10);
  const [leaderboardGrouping, setLeaderboardGrouping] = useState<"account" | "rut">("account");
  const [selectedRange, setSelectedRange] = useState<RangeParams>(() => resolveRange("current", "", ""));

  // Derived
  const activeParticipantId = (participantId || "").trim();

  // Queries
  const leaderboardParams: LeaderboardParams = {
    ...selectedRange,
    limit: leaderboardLimit,
    mode: "outgoing",
  };

  // 1. Leaderboard (Suspense-enabled)
  const { data: leaderboardData } = useSuspenseQuery(participantQueries.leaderboard(leaderboardParams));
  const leaderboard = leaderboardData.participants || [];

  // 2. Details (Click-to-fetch, keeps useQuery)
  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailErrorObj,
  } = useQuery(
    participantQueries.detail({
      participantId: activeParticipantId,
      ...selectedRange,
    })
  );

  const monthly = detailData?.monthly || [];
  const counterparts = detailData?.counterparts || [];
  const detailError = detailErrorObj instanceof Error ? detailErrorObj.message : null;
  const visible = !!detailData && !detailLoading && !detailError;

  // Transformations (Memoization via React 19 Compiler, logic moved inline or simplifed)

  // Account Grouping
  const accountRows: LeaderboardDisplayRow[] = leaderboard.map((row) => {
    const selectKey = row.participant || row.bankAccountNumber || row.withdrawId || row.identificationNumber || "";
    const displayName = row.bankAccountHolder || row.displayName || row.participant || "(sin información)";
    const rutValue =
      row.identificationNumber && typeof row.identificationNumber === "string"
        ? formatRut(String(row.identificationNumber))
        : "";
    const rut = rutValue || "-";
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

  // RUT Grouping
  const rutRows = (() => {
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
      const key = row.rut === "-" ? row.displayName : row.rut;
      if (!map.has(key)) {
        map.set(key, {
          displayName: row.displayName,
          rut: row.rut === "-" ? "-" : row.rut,
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

    return [...map.entries()]
      .map(([key, entry]) => ({
        key,
        displayName: entry.displayName,
        rut: entry.rut,
        account: entry.accounts.size > 0 ? [...entry.accounts].slice(0, 4).join(", ") : "-",
        outgoingCount: entry.outgoingCount,
        outgoingAmount: entry.outgoingAmount,
        selectKey: entry.selectKey,
      }))
      .toSorted((a, b) => {
        if (b.outgoingAmount !== a.outgoingAmount) return b.outgoingAmount - a.outgoingAmount;
        return b.outgoingCount - a.outgoingCount;
      });
  })();

  const displayedLeaderboard: LeaderboardDisplayRow[] = leaderboardGrouping === "account" ? accountRows : rutRows;

  // Options
  const quickMonthOptions = (() => {
    const options = [{ value: "current", label: "Mes actual" }];
    for (let i = 1; i < MAX_MONTHS; i += 1) {
      const date = dayjs().subtract(i, "month");
      options.push({ value: date.format("YYYY-MM"), label: date.format("MMMM YYYY") });
    }
    options.push({ value: "custom", label: "Personalizado" });
    return options;
  })();

  // Handlers
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rangeParams = resolveRange(quickMonth, from, to);
    setSelectedRange(rangeParams);
    // Query auto-refetches due to key change
  };

  const handleSelectParticipant = (participant: string) => {
    setParticipantId(participant);
    // Query auto-refetches when id changes
  };

  return {
    // Filters & State
    participantId,
    setParticipantId,
    from,
    setFrom,
    to,
    setTo,
    quickMonth,
    setQuickMonth,
    leaderboardLimit,
    setLeaderboardLimit,
    leaderboardGrouping,
    setLeaderboardGrouping,
    quickMonthOptions,

    // Data (Leaderboard)
    leaderboard,
    displayedLeaderboard,
    leaderboardLoading: false, // Suspense handles initial, mutation handles updates? No, query handles all.
    leaderboardError: null, // ErrorBoundary handles this

    // Data (Details)
    monthly,
    counterparts,
    visible,
    detailLoading,
    detailError,

    // Handlers
    handleSubmit,
    handleSelectParticipant,
  };
}
