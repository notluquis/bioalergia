import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { today } from "@/lib/dates";
import {
  fetchCalendarDaily,
  fetchCalendarSummary,
  fetchCalendarSyncLogs,
  syncCalendarEvents,
} from "../api";
import { calendarSyncQueries } from "../queries";
import {
  type CalendarDaily,
  type CalendarFilters,
  type CalendarSearchParams,
  type CalendarSummary,
  type CalendarSyncLog,
  type CalendarSyncStep,
  calendarSearchSchema,
} from "../types";
import { computeDefaultFilters, normalizeFilters } from "../utils/filters";

type SyncProgressEntry = CalendarSyncStep & { status: SyncProgressStatus };

type SyncProgressStatus = "completed" | "error" | "in_progress" | "pending";

const SYNC_STEPS_TEMPLATE: { id: CalendarSyncStep["id"]; label: string }[] = [
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

const resolveRefetchInterval = (logs: CalendarSyncLog[] | undefined): number | undefined => {
  return hasFreshRunningSync(logs) ? 5000 : undefined;
};

const markAllAsError = (entries: SyncProgressEntry[]) => entries.map((e) => markEntryAsError(e));

function deriveEffectiveFilters(
  search: CalendarSearchParams,
  filters: CalendarFilters,
): CalendarFilters {
  const dateParam = search.date ? dayjs(search.date) : null;
  const maxDaysRaw = search.maxDays ?? filters.maxDays;
  const maxDays =
    Number.isFinite(maxDaysRaw) && maxDaysRaw > 0 ? Math.min(Math.floor(maxDaysRaw), 120) : 31;

  const dateWindow =
    dateParam && dateParam.isValid()
      ? (() => {
          const half = Math.floor((maxDays - 1) / 2);
          const from = dateParam.subtract(half, "day").format("YYYY-MM-DD");
          const to = dateParam.add(maxDays - half - 1, "day").format("YYYY-MM-DD");
          return { from, to };
        })()
      : null;

  const routeFrom = search.from ?? (dateWindow ? dateWindow.from : filters.from);
  const routeTo = search.to ?? (dateWindow ? dateWindow.to : filters.to);

  return {
    calendarIds: search.calendarId ?? filters.calendarIds,
    categories: search.category.length > 0 ? search.category : filters.categories,
    from: routeFrom,
    maxDays,
    search: search.search ?? filters.search,
    to: routeTo,
  };
}

/**
 * Internal hook for managing calendar synchronization state and polling.
 * Extracted to reduce useCalendarEvents complexity.
 */
function useCalendarSync(queryClient: ReturnType<typeof useQueryClient>) {
  const { error: showError } = useToast();
  const [syncProgress, setSyncProgress] = useState<SyncProgressEntry[]>([]);
  const [syncDurationMs, setSyncDurationMs] = useState<null | number>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<null | {
    excluded: number;
    fetchedAt: Date;
    inserted: number;
    logId?: number;
    skipped: number;
    updated: number;
  }>(null);
  const [syncError, setSyncError] = useState<null | string>(null);

  const startPolling = (logId: number) => {
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes max (5s interval)

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy polling logic
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
              : null,
          );
          setSyncProgress(
            SYNC_STEPS_TEMPLATE.map((step) => ({
              details: {},
              durationMs: 0,
              id: step.id,
              label: step.label,
              status: "completed" as SyncProgressStatus,
            })),
          );
          setLastSyncInfo({
            excluded: currentLog.excluded,
            fetchedAt: currentLog.fetchedAt ?? new Date(),
            inserted: currentLog.inserted,
            logId: currentLog.id,
            skipped: currentLog.skipped,
            updated: currentLog.updated,
          });
          setSyncing(false);
          queryClient.invalidateQueries({ queryKey: ["calendar"] }).catch(() => {
            /* handled */
          });
        } else if (currentLog.status === "ERROR") {
          clearInterval(pollInterval);
          const msg = currentLog.errorMessage ?? "Error desconocido durante la sincronización";
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
        const message =
          error_ instanceof Error ? error_.message : "Error al verificar estado de sincronización";
        setSyncError(message);
        showError(message);
        setSyncing(false);
      }
    }, 5000); // Poll every 5 seconds
  };

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
        })),
      );
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo iniciar la sincronización";
      setSyncError(message);
      showError(message); // Toast
      setSyncProgress((prev) =>
        prev.map((entry) => ({
          ...entry,
          status: "error" as SyncProgressStatus,
        })),
      );
      setSyncing(false);
    },
    onSuccess: (result) => {
      startPolling(result.logId);
    },
  });

  return {
    lastSyncInfo,
    sync: syncMutation.mutate,
    syncDurationMs,
    syncError,
    syncProgress,
    syncing,
  };
}

export function useCalendarEvents() {
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const rawSearch = useSearch({ strict: false });
  const search = calendarSearchSchema.parse(rawSearch);

  const computeDefaults = () =>
    computeDefaultFilters({
      calendarDailyMaxDays: settings.calendarDailyMaxDays,
      calendarSyncLookaheadDays: settings.calendarSyncLookaheadDays,
      calendarSyncStart: settings.calendarSyncStart,
    });

  // Derived effective filters (Source of Truth: URL > Defaults)
  const defaults = computeDefaults();
  const effectiveApplied = deriveEffectiveFilters(search, defaults);

  const normalizedApplied = normalizeFilters(effectiveApplied);
  const shouldFetch = Boolean(normalizedApplied.from && normalizedApplied.to);

  const summaryQuery = useQuery<CalendarSummary>({
    queryFn: shouldFetch ? () => fetchCalendarSummary(normalizedApplied) : skipToken,
    queryKey: ["calendar", "summary", normalizedApplied],
  });

  const dailyQuery = useQuery<CalendarDaily>({
    queryFn: shouldFetch ? () => fetchCalendarDaily(normalizedApplied) : skipToken,
    queryKey: ["calendar", "daily", normalizedApplied],
  });

  // Single source of truth for sync logs (shared across pages)
  const {
    data: syncLogsData = [],
    error: syncLogsError,
    isError: isErrorSyncLogs,
    isLoading: isLoadingSyncLogs,
    refetch: refetchSyncLogs,
  } = useQuery({
    ...calendarSyncQueries.logs(50),
    placeholderData: [],
    refetchInterval: (query) => resolveRefetchInterval(query.state.data),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasRunningSyncFromOtherSource = hasFreshRunningSync(syncLogsData);

  const summary = summaryQuery.data;
  const daily = dailyQuery.data;
  const syncLogs = syncLogsData;
  const loading = summaryQuery.isLoading || dailyQuery.isLoading;
  const error = summaryQuery.error || dailyQuery.error;

  const { lastSyncInfo, sync, syncDurationMs, syncError, syncProgress, syncing } =
    useCalendarSync(queryClient);

  const syncNow = () => {
    sync();
  };

  // Display date defaults to today (unless explicitly set via URL param)
  // This is separate from the data range (from/to) which buffers -2 weeks for performance
  const currentSelectedDate = dayjs(search.date ?? today()).toDate();
  const availableCalendars = summary?.available.calendars ?? [];
  const availableCategories = summary?.available.categories ?? [];

  return {
    appliedFilters: normalizedApplied,
    availableCalendars,
    availableCategories,
    daily,
    error,
    hasRunningSyncFromOtherSource,
    isErrorSyncLogs,
    isLoadingSyncLogs,
    lastSyncInfo,
    loading,
    refetchSyncLogs,
    summary,
    syncDurationMs,
    syncError,
    syncLogsError,
    syncing,
    syncLogs,
    currentSelectedDate,
    syncNow,
    syncProgress,
    defaults,
  };
}
