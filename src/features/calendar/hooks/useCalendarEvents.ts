import { useMemo, useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchCalendarDaily, fetchCalendarSummary, syncCalendarEvents } from "../api";
import type { CalendarDaily, CalendarFilters, CalendarSummary, CalendarSyncStep } from "../types";
import { useSettings } from "../../../context/settings-context";
import { useCalendarFilterStore } from "../../../store/calendarFilters";

type SyncProgressStatus = "pending" | "in_progress" | "completed" | "error";

type SyncProgressEntry = CalendarSyncStep & { status: SyncProgressStatus };

const SYNC_STEPS_TEMPLATE: Array<{ id: CalendarSyncStep["id"]; label: string }> = [
  { id: "fetch", label: "Consultando Google Calendar" },
  { id: "upsert", label: "Actualizando base de datos" },
  { id: "exclude", label: "Eliminando eventos excluidos" },
  { id: "snapshot", label: "Guardando snapshot" },
];

function normalizeFilters(filters: CalendarFilters): CalendarFilters {
  const unique = (values: string[]) => Array.from(new Set(values)).sort();
  return {
    ...filters,
    calendarIds: unique(filters.calendarIds),
    eventTypes: unique(filters.eventTypes),
    categories: unique(filters.categories),
    search: filters.search.trim(),
  };
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function filtersEqual(a: CalendarFilters, b: CalendarFilters) {
  return (
    a.from === b.from &&
    a.to === b.to &&
    arraysEqual([...a.calendarIds].sort(), [...b.calendarIds].sort()) &&
    arraysEqual([...a.eventTypes].sort(), [...b.eventTypes].sort()) &&
    arraysEqual([...a.categories].sort(), [...b.categories].sort()) &&
    a.search.trim() === b.search.trim() &&
    a.maxDays === b.maxDays
  );
}

export function useCalendarEvents() {
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const filters = useCalendarFilterStore((state) => state);
  const setFilters = useCalendarFilterStore((state) => state.setFilters);

  const computeDefaults = useCallback((): CalendarFilters => {
    const syncStart = settings.calendarSyncStart?.trim() || "2000-01-01";
    const lookaheadRaw = Number(settings.calendarSyncLookaheadDays ?? "365");
    const lookahead =
      Number.isFinite(lookaheadRaw) && lookaheadRaw > 0 ? Math.min(Math.floor(lookaheadRaw), 1095) : 365;
    const defaultMax = Number(settings.calendarDailyMaxDays ?? "365");
    const configuredMax = Number.isFinite(defaultMax) && defaultMax > 0 ? Math.min(Math.floor(defaultMax), 365) : 365;
    const defaultFrom = dayjs().startOf("month").subtract(2, "month");
    const defaultTo = dayjs().endOf("month").add(2, "month");
    const startDate = dayjs(syncStart);
    const from = startDate.isValid() && startDate.isAfter(defaultFrom) ? startDate : defaultFrom;
    const maxForward = dayjs().add(lookahead, "day");
    const toCandidate = defaultTo.isAfter(maxForward) ? maxForward : defaultTo;
    const spanDays = Math.max(1, toCandidate.diff(from, "day") + 1);
    const maxDays = Math.min(Math.max(spanDays, configuredMax), 365);
    return {
      from: from.format("YYYY-MM-DD"),
      to: toCandidate.format("YYYY-MM-DD"),
      calendarIds: [],
      eventTypes: [],
      categories: [],
      search: "",
      maxDays,
    };
  }, [settings]);

  const initialDefaults = useMemo(() => computeDefaults(), [computeDefaults]);
  const [appliedFilters, setAppliedFilters] = useState<CalendarFilters>(initialDefaults);
  const [syncProgress, setSyncProgress] = useState<SyncProgressEntry[]>([]);
  const [syncDurationMs, setSyncDurationMs] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<{
    fetchedAt: string;
    inserted: number;
    updated: number;
    skipped: number;
    excluded: number;
    logId?: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const defaults = initialDefaults;
    setFilters(defaults);
    setAppliedFilters(defaults);
  }, [initialDefaults, setFilters]);

  const normalizedApplied = useMemo(() => normalizeFilters(appliedFilters), [appliedFilters]);

  const summaryQuery = useQuery<CalendarSummary, Error>({
    queryKey: ["calendar", "summary", normalizedApplied],
    queryFn: () => fetchCalendarSummary(normalizedApplied),
    enabled: Boolean(normalizedApplied.from && normalizedApplied.to),
  });

  const dailyQuery = useQuery<CalendarDaily, Error>({
    queryKey: ["calendar", "daily", normalizedApplied],
    queryFn: () => fetchCalendarDaily(normalizedApplied),
    enabled: Boolean(normalizedApplied.from && normalizedApplied.to),
  });

  const summary = summaryQuery.data ?? null;
  const daily = dailyQuery.data ?? null;
  const loading = summaryQuery.isLoading || dailyQuery.isLoading;
  const error = summaryQuery.error?.message || dailyQuery.error?.message || null;

  const normalizedDraft = useMemo(() => normalizeFilters(filters), [filters]);
  const isDirty = useMemo(
    () => !filtersEqual(normalizedDraft, normalizedApplied),
    [normalizedDraft, normalizedApplied]
  );

  const updateFilters = useCallback(
    <K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) => {
      setFilters({ [key]: value } as Partial<CalendarFilters>);
    },
    [setFilters]
  );

  const applyFilters = useCallback(() => {
    const fromDate = dayjs(normalizedDraft.from);
    const toDate = dayjs(normalizedDraft.to);
    const spanDays = fromDate.isValid() && toDate.isValid() ? Math.max(1, toDate.diff(fromDate, "day") + 1) : 1;
    const resolvedMaxDays = Math.min(Math.max(spanDays, normalizedDraft.maxDays, 1), 365);
    const next = { ...normalizedDraft, maxDays: resolvedMaxDays };
    setAppliedFilters(next);
    setFilters(next);
  }, [normalizedDraft, setFilters]);

  const resetFilters = useCallback(() => {
    const defaults = computeDefaults();
    setFilters(defaults);
    setAppliedFilters(defaults);
  }, [computeDefaults, setFilters]);

  const availableCalendars = summary?.available.calendars ?? [];
  const availableEventTypes = summary?.available.eventTypes ?? [];
  const availableCategories = summary?.available.categories ?? [];

  const syncMutation = useMutation({
    mutationFn: syncCalendarEvents,
    onMutate: () => {
      setSyncing(true);
      setSyncError(null);
      setSyncDurationMs(null);
      setSyncProgress(
        SYNC_STEPS_TEMPLATE.map((step, index) => ({
          id: step.id,
          label: step.label,
          durationMs: 0,
          details: {},
          status: index === 0 ? "in_progress" : "pending",
        }))
      );
    },
    onSuccess: (result) => {
      setSyncDurationMs(result.totalDurationMs ?? null);
      setSyncProgress(
        SYNC_STEPS_TEMPLATE.map((step) => {
          const payloadStep = result.steps.find((entry) => entry.id === step.id);
          return {
            id: step.id,
            label: step.label,
            durationMs: payloadStep?.durationMs ?? 0,
            details: payloadStep?.details ?? {},
            status: "completed" as SyncProgressStatus,
          };
        })
      );
      setLastSyncInfo({
        fetchedAt: result.fetchedAt,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        excluded: result.excluded,
        logId: result.logId,
      });
      queryClient.invalidateQueries({ queryKey: ["calendar"] }).catch(() => {
        /* handled */
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo sincronizar";
      setSyncError(message);
      setSyncProgress((prev) =>
        prev.map((entry) =>
          entry.status === "in_progress"
            ? {
                ...entry,
                status: "error" as SyncProgressStatus,
              }
            : entry
        )
      );
    },
    onSettled: () => {
      setSyncing(false);
    },
  });

  const syncNow = useCallback(() => {
    syncMutation.mutate();
  }, [syncMutation]);

  return {
    filters,
    appliedFilters,
    summary,
    daily,
    loading,
    error,
    isDirty,
    updateFilters,
    applyFilters,
    resetFilters,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    syncing,
    syncError,
    lastSyncInfo,
    syncProgress,
    syncDurationMs,
    syncNow,
  };
}
