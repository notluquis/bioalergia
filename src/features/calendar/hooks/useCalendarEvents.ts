import { useMemo, useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchCalendarDaily, fetchCalendarSummary, syncCalendarEvents, fetchCalendarSyncLogs } from "../api";
import type { CalendarDaily, CalendarFilters, CalendarSummary, CalendarSyncLog, CalendarSyncStep } from "../types";
import { useSettings } from "@/context/SettingsContext";
import { useCalendarFilterStore } from "@/store/calendarFilters";

type SyncProgressStatus = "pending" | "in_progress" | "completed" | "error";

type SyncProgressEntry = CalendarSyncStep & { status: SyncProgressStatus };

const SYNC_STEPS_TEMPLATE: Array<{ id: CalendarSyncStep["id"]; label: string }> = [
  { id: "fetch", label: "Consultando Google Calendar" },
  { id: "upsert", label: "Actualizando base de datos" },
  { id: "exclude", label: "Eliminando eventos excluidos" },
  { id: "snapshot", label: "Guardando snapshot" },
];
const STALE_SYNC_WINDOW_MS = 15 * 60 * 1000; // keep in sync with backend stale lock
export const CALENDAR_SYNC_LOGS_QUERY_KEY = ["calendar", "sync-logs", "full"] as const;

const hasFreshRunningSync = (logs: CalendarSyncLog[] | undefined) => {
  if (!logs?.length) return false;
  return logs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    return started.isValid() && Date.now() - started.valueOf() < STALE_SYNC_WINDOW_MS;
  });
};

const resolveRefetchInterval = (logs: CalendarSyncLog[] | undefined) => {
  return hasFreshRunningSync(logs) ? 5000 : false;
};

function normalizeFilters(filters: CalendarFilters): CalendarFilters {
  const unique = (values: string[]) => Array.from(new Set(values)).sort();
  return {
    ...filters,
    calendarIds: unique(filters.calendarIds ?? []),
    eventTypes: unique(filters.eventTypes ?? []),
    categories: unique(filters.categories),
    search: (filters.search ?? "").trim(),
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
    arraysEqual([...(a.calendarIds ?? [])].sort(), [...(b.calendarIds ?? [])].sort()) &&
    arraysEqual([...(a.eventTypes ?? [])].sort(), [...(b.eventTypes ?? [])].sort()) &&
    arraysEqual([...a.categories].sort(), [...b.categories].sort()) &&
    (a.search ?? "").trim() === (b.search ?? "").trim() &&
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
    const defaultFrom = dayjs().startOf("month");
    const defaultTo = dayjs().endOf("month");
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

  // Single source of truth for sync logs (shared across pages)
  const {
    data: syncLogsData = [],
    isLoading: isLoadingSyncLogs,
    refetch: refetchSyncLogs,
  } = useQuery<CalendarSyncLog[], Error>({
    queryKey: CALENDAR_SYNC_LOGS_QUERY_KEY,
    queryFn: () => fetchCalendarSyncLogs(50),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => resolveRefetchInterval(query.state.data),
    placeholderData: [],
  });

  const hasRunningSyncFromOtherSource = hasFreshRunningSync(syncLogsData);

  const summary = summaryQuery.data ?? null;
  const daily = dailyQuery.data ?? null;
  const syncLogs = syncLogsData ?? [];
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
    const draft = normalizeFilters(useCalendarFilterStore.getState());
    const fromDate = dayjs(draft.from);
    const toDate = dayjs(draft.to);
    const spanDays = fromDate.isValid() && toDate.isValid() ? Math.max(1, toDate.diff(fromDate, "day") + 1) : 1;
    const resolvedMaxDays = Math.min(Math.max(spanDays, draft.maxDays, 1), 365);
    const next = { ...draft, maxDays: resolvedMaxDays };
    setAppliedFilters(next);
    setFilters(next);
  }, [setFilters]);

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
      // Sync started in background - poll for status
      const logId = result.logId;
      let pollCount = 0;
      const maxPolls = 60; // 5 minutes max (5s interval)

      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const logs = await fetchCalendarSyncLogs(10);
          const currentLog = logs.find((log) => log.id === logId);

          if (!currentLog) {
            clearInterval(pollInterval);
            setSyncError("No se encontró el log de sincronización");
            setSyncing(false);
            return;
          }

          if (currentLog.status === "SUCCESS") {
            clearInterval(pollInterval);
            setSyncDurationMs(
              currentLog.finishedAt && currentLog.startedAt
                ? new Date(currentLog.finishedAt).getTime() - new Date(currentLog.startedAt).getTime()
                : null
            );
            setSyncProgress(
              SYNC_STEPS_TEMPLATE.map((step) => ({
                id: step.id,
                label: step.label,
                durationMs: 0,
                details: {},
                status: "completed" as SyncProgressStatus,
              }))
            );
            setLastSyncInfo({
              fetchedAt: currentLog.fetchedAt ?? new Date().toISOString(),
              inserted: currentLog.inserted,
              updated: currentLog.updated,
              skipped: currentLog.skipped,
              excluded: currentLog.excluded,
              logId: currentLog.id,
            });
            setSyncing(false);
            queryClient.invalidateQueries({ queryKey: ["calendar"] }).catch(() => {
              /* handled */
            });
          } else if (currentLog.status === "ERROR") {
            clearInterval(pollInterval);
            setSyncError(currentLog.errorMessage || "Error desconocido durante la sincronización");
            setSyncProgress((prev) =>
              prev.map((entry) => ({
                ...entry,
                status: "error" as SyncProgressStatus,
              }))
            );
            setSyncing(false);
          } else if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setSyncError("Timeout: la sincronización tardó demasiado");
            setSyncing(false);
          }
          // else: still RUNNING, keep polling
        } catch (err) {
          clearInterval(pollInterval);
          const message = err instanceof Error ? err.message : "Error al verificar estado de sincronización";
          setSyncError(message);
          setSyncing(false);
        }
      }, 5000); // Poll every 5 seconds
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo iniciar la sincronización";
      setSyncError(message);
      setSyncProgress((prev) =>
        prev.map((entry) => ({
          ...entry,
          status: "error" as SyncProgressStatus,
        }))
      );
      setSyncing(false);
    },
  });

  const { mutate: sync } = syncMutation;

  const syncNow = useCallback(() => {
    sync();
  }, [sync]);

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
    syncLogs,
    refetchSyncLogs,
    isLoadingSyncLogs,
    hasRunningSyncFromOtherSource,
  };
}
