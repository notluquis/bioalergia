import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";

import { fetchCalendarDaily, fetchCalendarSummary, syncCalendarEvents } from "../api";
import type { CalendarDaily, CalendarFilters, CalendarSummary } from "../types";
import { useSettings } from "../../../context/settings-context";

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

  const computeDefaults = useCallback((): CalendarFilters => {
    const syncStart = settings.calendarSyncStart?.trim() || "2000-01-01";
    const lookaheadRaw = Number(settings.calendarSyncLookaheadDays ?? "365");
    const lookahead = Number.isFinite(lookaheadRaw) && lookaheadRaw > 0 ? Math.min(Math.floor(lookaheadRaw), 1095) : 365;
    const defaultMax = Number(settings.calendarDailyMaxDays ?? "31");
    const maxDays = Number.isFinite(defaultMax) && defaultMax > 0 ? Math.min(Math.floor(defaultMax), 120) : 31;
    const startDate = dayjs(syncStart);
    const monthStart = dayjs().startOf("month");
    const monthEnd = dayjs().endOf("month");
    const from = startDate.isValid() && startDate.isAfter(monthStart) ? startDate : monthStart;
    const maxForward = dayjs().add(lookahead, "day");
    const to = monthEnd.isBefore(maxForward) ? monthEnd : maxForward;
    return {
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
      calendarIds: [],
      eventTypes: [],
      categories: [],
      search: "",
      maxDays,
    };
  }, [settings]);

  const initialDefaults = useMemo(() => computeDefaults(), [computeDefaults]);
  const defaultFiltersRef = useRef<CalendarFilters>(initialDefaults);
  const [filters, setFilters] = useState<CalendarFilters>(initialDefaults);
  const [appliedFilters, setAppliedFilters] = useState<CalendarFilters>(initialDefaults);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [daily, setDaily] = useState<CalendarDaily | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<{
    fetchedAt: string;
    inserted: number;
    updated: number;
    skipped: number;
    excluded: number;
    logId?: number;
  } | null>(null);

  const fetchData = useCallback(async (nextFilters: CalendarFilters) => {
    setLoading(true);
    setError(null);
    const normalized = normalizeFilters(nextFilters);
    try {
      const [summaryResponse, dailyResponse] = await Promise.all([
        fetchCalendarSummary(normalized),
        fetchCalendarDaily(normalized),
      ]);
      setSummary(summaryResponse);
      setDaily(dailyResponse);
      setAppliedFilters(normalized);
      setFilters(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los eventos";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const defaults = computeDefaults();
    defaultFiltersRef.current = defaults;
    setFilters(defaults);
    setAppliedFilters(defaults);
    fetchData(defaults).catch(() => {
      /* handled */
    });
  }, [computeDefaults, fetchData]);

  const updateFilters = useCallback(<K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFilters = useCallback(async () => {
    await fetchData(filters).catch(() => {
      /* handled */
    });
  }, [fetchData, filters]);

  const resetFilters = useCallback(async () => {
    const defaults = defaultFiltersRef.current ?? computeDefaults();
    setFilters(defaults);
    await fetchData(defaults).catch(() => {
      /* handled */
    });
  }, [fetchData, computeDefaults]);

  const isDirty = useMemo(() => !filtersEqual(filters, appliedFilters), [filters, appliedFilters]);

  const availableCalendars = summary?.available.calendars ?? [];
  const availableEventTypes = summary?.available.eventTypes ?? [];
  const availableCategories = summary?.available.categories ?? [];

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncCalendarEvents();
        setLastSyncInfo({
          fetchedAt: result.fetchedAt,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          excluded: result.excluded,
          logId: result.logId,
        });
      await fetchData(filters).catch(() => {
        /* handled */
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo sincronizar";
      setSyncError(message);
    } finally {
      setSyncing(false);
    }
  }, [fetchData, filters]);

  return {
    filters,
    appliedFilters,
    summary,
    daily,
    loading,
    error,
    isDirty,
    updateFilters,
    setFilters,
    applyFilters,
    resetFilters,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    syncing,
    syncError,
    lastSyncInfo,
    syncNow,
  };
}
