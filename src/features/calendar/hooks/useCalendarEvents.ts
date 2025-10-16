import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";

import { fetchCalendarDaily, fetchCalendarSummary } from "../api";
import type { CalendarDaily, CalendarFilters, CalendarSummary } from "../types";

const DEFAULT_MAX_DAYS = 31;

function createDefaultFilters(): CalendarFilters {
  const today = dayjs().startOf("day");
  const from = today.subtract(30, "day");
  return {
    from: from.format("YYYY-MM-DD"),
    to: today.format("YYYY-MM-DD"),
    calendarIds: [],
    eventTypes: [],
    search: "",
    maxDays: DEFAULT_MAX_DAYS,
  };
}

function normalizeFilters(filters: CalendarFilters): CalendarFilters {
  const unique = (values: string[]) => Array.from(new Set(values)).sort();
  return {
    ...filters,
    calendarIds: unique(filters.calendarIds),
    eventTypes: unique(filters.eventTypes),
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
    a.search.trim() === b.search.trim() &&
    a.maxDays === b.maxDays
  );
}

export function useCalendarEvents() {
  const defaultFiltersRef = useRef<CalendarFilters>(createDefaultFilters());
  const [filters, setFilters] = useState<CalendarFilters>(() => ({ ...defaultFiltersRef.current }));
  const [appliedFilters, setAppliedFilters] = useState<CalendarFilters>(() => ({ ...defaultFiltersRef.current }));
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [daily, setDaily] = useState<CalendarDaily | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    fetchData(defaultFiltersRef.current).catch(() => {
      // El error se maneja en el estado interno; evitamos logs duplicados.
    });
  }, [fetchData]);

  const updateFilters = useCallback(<K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFilters = useCallback(async () => {
    await fetchData(filters).catch(() => {
      /* handled */
    });
  }, [fetchData, filters]);

  const resetFilters = useCallback(async () => {
    const defaults = createDefaultFilters();
    setFilters(defaults);
    await fetchData(defaults).catch(() => {
      /* handled */
    });
  }, [fetchData]);

  const isDirty = useMemo(() => !filtersEqual(filters, appliedFilters), [filters, appliedFilters]);

  const availableCalendars = summary?.available.calendars ?? [];
  const availableEventTypes = summary?.available.eventTypes ?? [];

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
  };
}
