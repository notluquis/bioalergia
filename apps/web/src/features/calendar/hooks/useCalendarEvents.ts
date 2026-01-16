import { skipToken, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";

import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { calendarFilterStore, updateFilters } from "@/store/calendarFilters";

import { fetchCalendarDaily, fetchCalendarSummary, fetchCalendarSyncLogs, syncCalendarEvents } from "../api";
import { calendarSyncQueries } from "../queries";
import type { CalendarDaily, CalendarFilters, CalendarSummary, CalendarSyncLog, CalendarSyncStep } from "../types";
import { computeDefaultFilters, filtersEqual, normalizeFilters } from "../utils/filters";

type SyncProgressStatus = "pending" | "in_progress" | "completed" | "error";

type SyncProgressEntry = CalendarSyncStep & { status: SyncProgressStatus };

const SYNC_STEPS_TEMPLATE: Array<{ id: CalendarSyncStep["id"]; label: string }> = [
  { id: "fetch", label: "Consultando Google Calendar" },
  { id: "upsert", label: "Actualizando base de datos" },
  { id: "exclude", label: "Eliminando eventos excluidos" },
  { id: "snapshot", label: "Guardando snapshot" },
];
const STALE_SYNC_WINDOW_MS = 15 * 60 * 1000; // keep in sync with backend stale lock
// Deleted CALENDAR_SYNC_LOGS_QUERY_KEY

const hasFreshRunningSync = (logs: CalendarSyncLog[] | undefined) => {
  if (!logs?.length) return false;
  return logs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    return started.isValid() && Date.now() - started.valueOf() < STALE_SYNC_WINDOW_MS;
  });
};

const markEntryAsError = (entry: SyncProgressEntry): SyncProgressEntry => ({
  ...entry,
  status: "error",
});

// eslint-disable-next-line sonarjs/function-return-type
const resolveRefetchInterval = (logs: CalendarSyncLog[] | undefined): number | false => {
  return hasFreshRunningSync(logs) ? 5000 : false;
};

const markAllAsError = (entries: SyncProgressEntry[]) => entries.map((e) => markEntryAsError(e));

export function useCalendarEvents() {
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const filters = useStore(calendarFilterStore, (state) => state);
  const { error: showError } = useToast();

  const computeDefaults = () =>
    computeDefaultFilters({
      calendarSyncStart: settings.calendarSyncStart,
      calendarSyncLookaheadDays: settings.calendarSyncLookaheadDays,
      calendarDailyMaxDays: settings.calendarDailyMaxDays,
    });

  // We only want to compute this once on mount, basically
  const [initialDefaults] = useState(() => {
    const defaults = computeDefaults();
    // Initialize store immediately to avoid empty state
    updateFilters(defaults);
    return defaults;
  });
  // Don't initialize with initialDefaults - let useEffect handle it
  const [appliedFilters, setAppliedFilters] = useState<CalendarFilters>(() => ({
    from: "",
    to: "",
    calendarIds: [],
    eventTypes: [],
    categories: [],
    search: "",
    maxDays: 28,
  }));
  const hasAppliedInitialFilters = useRef(false);

  // CRITICAL FIX: Apply initial filters on mount to ensure queries run
  // This solves the issue where pages show "0 events" despite having data
  useEffect(() => {
    if (!hasAppliedInitialFilters.current) {
      hasAppliedInitialFilters.current = true;
      // Apply the initial defaults immediately with a new object reference
      setAppliedFilters({ ...initialDefaults });
    }
  }, [initialDefaults]);
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

  const normalizedApplied = normalizeFilters(appliedFilters);
  const shouldFetch = Boolean(normalizedApplied.from && normalizedApplied.to);

  const summaryQuery = useSuspenseQuery<CalendarSummary>({
    queryKey: ["calendar", "summary", normalizedApplied],
    queryFn: shouldFetch ? () => fetchCalendarSummary(normalizedApplied) : (skipToken as any),
  });

  const dailyQuery = useSuspenseQuery<CalendarDaily>({
    queryKey: ["calendar", "daily", normalizedApplied],
    queryFn: shouldFetch ? () => fetchCalendarDaily(normalizedApplied) : (skipToken as any),
  });

  // Single source of truth for sync logs (shared across pages)
  const {
    data: syncLogsData = [],
    isLoading: isLoadingSyncLogs,
    refetch: refetchSyncLogs,
  } = useQuery({
    ...calendarSyncQueries.logs(50),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    refetchInterval: (query) => resolveRefetchInterval(query.state.data),
    placeholderData: [],
  });

  const hasRunningSyncFromOtherSource = hasFreshRunningSync(syncLogsData);

  const summary = summaryQuery.data;
  const daily = dailyQuery.data;
  const syncLogs = syncLogsData ?? [];
  const loading = false;
  const error = null;

  const normalizedDraft = normalizeFilters(filters);
  const isDirty = !filtersEqual(normalizedDraft, normalizedApplied);

  const handleUpdateFilters = <K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) => {
    updateFilters({ [key]: value } as Partial<CalendarFilters>);
  };

  const applyFilters = () => {
    const draft = normalizeFilters(calendarFilterStore.state);
    const fromDate = dayjs(draft.from);
    const toDate = dayjs(draft.to);
    const spanDays = fromDate.isValid() && toDate.isValid() ? Math.max(1, toDate.diff(fromDate, "day") + 1) : 1;
    const resolvedMaxDays = Math.min(Math.max(spanDays, draft.maxDays, 1), 365);
    const next = { ...draft, maxDays: resolvedMaxDays };
    setAppliedFilters(next);
    updateFilters(next);
  };

  const handleResetFilters = () => {
    const defaults = computeDefaults();
    updateFilters(defaults);
    setAppliedFilters(defaults);
  };

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
      startPolling(result.logId);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo iniciar la sincronización";
      setSyncError(message);
      showError(message); // Toast
      setSyncProgress((prev) =>
        prev.map((entry) => ({
          ...entry,
          status: "error" as SyncProgressStatus,
        }))
      );
      setSyncing(false);
    },
  });

  const startPolling = (logId: number) => {
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
          const msg = currentLog.errorMessage || "Error desconocido durante la sincronización";
          setSyncError(msg);
          showError(msg);

          setSyncProgress(markAllAsError);
          setSyncing(false);
        } else if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setSyncError("Timeout: la sincronización tardó demasiado");
          showError("Timeout: la sincronización tardó demasiado");
          setSyncing(false);
        }
        // else: still RUNNING, keep polling
      } catch (error_) {
        clearInterval(pollInterval);
        const message = error_ instanceof Error ? error_.message : "Error al verificar estado de sincronización";
        setSyncError(message);
        showError(message);
        setSyncing(false);
      }
    }, 5000); // Poll every 5 seconds
  };

  const { mutate: sync } = syncMutation;

  const syncNow = () => {
    sync();
  };

  return {
    filters,
    appliedFilters,
    summary,
    daily,
    loading,
    error,
    isDirty,
    updateFilters: handleUpdateFilters,
    applyFilters,
    resetFilters: handleResetFilters,
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
