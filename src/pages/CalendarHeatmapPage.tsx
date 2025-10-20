import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import { useTranslation } from "react-i18next";

import Button from "../components/Button";
import Input from "../components/Input";
import Alert from "../components/Alert";
import { MultiSelectFilter, type MultiSelectOption } from "../features/calendar/components/MultiSelectFilter";
import { HeatmapMonth } from "../features/calendar/components/HeatmapMonth";
import { apiClient } from "../lib/apiClient";
import type { CalendarSummary } from "../features/calendar/types";

dayjs.locale("es");

const numberFormatter = new Intl.NumberFormat("es-CL");
const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

type HeatmapFilters = {
  from: string;
  to: string;
  calendarIds: string[];
  eventTypes: string[];
  categories: string[];
  search: string;
};

type CalendarSummaryResponse = CalendarSummary & { status: "ok" };

const createInitialFilters = (): HeatmapFilters => {
  const start = dayjs().startOf("month").subtract(2, "month");
  const end = dayjs().endOf("month").add(2, "month");
  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
    calendarIds: [],
    eventTypes: [],
    categories: [],
    search: "",
  };
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function filtersEqual(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.search.trim() === b.search.trim() &&
    arraysEqual(a.calendarIds, b.calendarIds) &&
    arraysEqual(a.eventTypes, b.eventTypes) &&
    arraysEqual(a.categories, b.categories)
  );
}

function buildQuery(filters: HeatmapFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (filters.calendarIds.length) query.calendarId = filters.calendarIds;
  if (filters.eventTypes.length) query.eventType = filters.eventTypes;
  if (filters.categories.length) query.category = filters.categories;
  if (filters.search.trim()) query.search = filters.search.trim();
  return query;
}

function CalendarHeatmapPage() {
  const initialFilters = useMemo(() => createInitialFilters(), []);
  const [filters, setFilters] = useState<HeatmapFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<HeatmapFilters>(initialFilters);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const tc = useCallback((key: string, options?: Record<string, unknown>) => t(`calendar.${key}`, options), [t]);

  const fetchSummary = useCallback(async (target: HeatmapFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<CalendarSummaryResponse>("/api/calendar/events/summary", {
        query: buildQuery(target),
      });
      if (response.status !== "ok") {
        throw new Error("No se pudo cargar el resumen de calendario");
      }
      const normalizedServerFilters: HeatmapFilters = {
        from: response.filters.from ?? "",
        to: response.filters.to ?? "",
        calendarIds: response.filters.calendarIds ?? [],
        eventTypes: response.filters.eventTypes ?? [],
        categories: response.filters.categories ?? [],
        search: response.filters.search ?? "",
      };

      setSummary({
        filters: response.filters,
        totals: response.totals,
        aggregates: response.aggregates,
        available: response.available,
      });
      setFilters(normalizedServerFilters);
      setAppliedFilters(normalizedServerFilters);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener los datos";
      setError(message);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(initialFilters).catch(() => {
      /* handled */
    });
  }, [fetchSummary, initialFilters]);

  const isDirty = useMemo(() => !filtersEqual(filters, appliedFilters), [filters, appliedFilters]);

  const availableCalendars: MultiSelectOption[] = useMemo(
    () =>
      (summary?.available.calendars ?? []).map((entry) => ({
        value: entry.calendarId,
        label: `${entry.calendarId} · ${numberFormatter.format(entry.total)}`,
      })),
    [summary?.available.calendars]
  );

  const availableEventTypes: MultiSelectOption[] = useMemo(
    () =>
      (summary?.available.eventTypes ?? []).map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [summary?.available.eventTypes]
  );

  const availableCategories: MultiSelectOption[] = useMemo(
    () =>
      (summary?.available.categories ?? []).map((entry) => {
        const value = entry.category ?? NULL_CATEGORY_VALUE;
        const label = entry.category ?? "Sin clasificación";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [summary?.available.categories]
  );

  const statsByDate = useMemo(() => {
    const map = new Map<string, { total: number; amountExpected: number; amountPaid: number }>();
    summary?.aggregates.byDate.forEach((entry) => {
      const key = dayjs(entry.date).format("YYYY-MM-DD");
      map.set(key, {
        total: entry.total,
        amountExpected: entry.amountExpected ?? 0,
        amountPaid: entry.amountPaid ?? 0,
      });
    });
    return map;
  }, [summary?.aggregates.byDate]);

  const heatmapMonths = useMemo(() => {
    const sourceFrom = summary?.filters.from || filters.from;
    const sourceTo = summary?.filters.to || filters.to;

    let start = sourceFrom ? dayjs(sourceFrom).startOf("month") : dayjs().startOf("month").subtract(1, "month");
    let end = sourceTo ? dayjs(sourceTo).startOf("month") : dayjs().startOf("month").add(1, "month");

    if (!start.isValid()) {
      start = dayjs().startOf("month").subtract(1, "month");
    }
    if (!end.isValid() || end.isBefore(start)) {
      end = start.add(2, "month");
    }

    const months: Dayjs[] = [];
    let cursor = start.clone();
    let guard = 0;
    while (cursor.isBefore(end) || cursor.isSame(end)) {
      months.push(cursor);
      cursor = cursor.add(1, "month");
      guard += 1;
      if (guard > 18) break;
    }
    return months;
  }, [summary?.filters.from, summary?.filters.to, filters.from, filters.to]);

  const heatmapMonthKeys = useMemo(
    () => new Set(heatmapMonths.map((month) => month.format("YYYY-MM"))),
    [heatmapMonths]
  );

  const heatmapMaxValue = useMemo(() => {
    if (!summary) return 0;
    let max = 0;
    summary.aggregates.byDate.forEach((entry) => {
      if (heatmapMonthKeys.has(dayjs(entry.date).format("YYYY-MM"))) {
        max = Math.max(max, entry.total);
      }
    });
    return max;
  }, [summary, heatmapMonthKeys]);

  const handleToggle = (key: "calendarIds" | "eventTypes" | "categories", value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }));
  };

  const handleApply = async () => {
    await fetchSummary(filters);
  };

  const handleReset = async () => {
    const defaults = createInitialFilters();
    setFilters(defaults);
    await fetchSummary(defaults);
  };

  const busy = loading || initializing;
  const rangeStartLabel = heatmapMonths[0]?.format("MMM YYYY") ?? "—";
  const rangeEndLabel = heatmapMonths[heatmapMonths.length - 1]?.format("MMM YYYY") ?? "—";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">{tc("heatmapTitle")}</h1>
        <p className="text-sm text-slate-600">{tc("heatmapDescription")}</p>
      </header>

      <form
        className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white/80 p-6 text-xs text-slate-600 shadow-sm md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          handleApply().catch(() => {
            /* handled */
          });
        }}
      >
        <Input
          label={tc("filters.from")}
          type="date"
          value={filters.from}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setFilters((prev) => ({ ...prev, from: event.target.value }))
          }
        />
        <Input
          label={tc("filters.to")}
          type="date"
          value={filters.to}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setFilters((prev) => ({ ...prev, to: event.target.value }))
          }
        />
        <MultiSelectFilter
          label={tc("filters.calendars")}
          options={availableCalendars}
          selected={filters.calendarIds}
          onToggle={(value) => handleToggle("calendarIds", value)}
          placeholder={tc("filters.all")}
        />
        <MultiSelectFilter
          label={tc("filters.eventTypes")}
          options={availableEventTypes}
          selected={filters.eventTypes}
          onToggle={(value) => handleToggle("eventTypes", value)}
          placeholder={tc("filters.all")}
        />
        <MultiSelectFilter
          label={tc("filters.categories")}
          options={availableCategories}
          selected={filters.categories}
          onToggle={(value) => handleToggle("categories", value)}
          placeholder={tc("filters.allCategories")}
        />
        <Input
          label={tc("filters.search")}
          placeholder={tc("searchPlaceholder")}
          value={filters.search}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setFilters((prev) => ({ ...prev, search: event.target.value }))
          }
        />
        <div className="flex items-end gap-2 md:col-span-2">
          <Button type="submit" size="lg" disabled={busy}>
            {loading ? tc("loading") : tc("applyFilters")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={busy || !isDirty}
            onClick={() => {
              handleReset().catch(() => {
                /* handled */
              });
            }}
          >
            {tc("resetFilters")}
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {initializing && !summary ? (
        <p className="text-sm text-slate-500">{tc("loading")}</p>
      ) : summary ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tc("heatmapSection")}</h2>
            <span className="text-[11px] text-slate-500">
              {tc("heatmapRange", {
                start: rangeStartLabel,
                end: rangeEndLabel,
              })}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {heatmapMonths.map((month) => (
              <HeatmapMonth
                key={month.format("YYYY-MM")}
                month={month}
                statsByDate={statsByDate}
                maxValue={heatmapMaxValue}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {tc("heatmapTotals", {
              events: numberFormatter.format(summary.totals.events),
              expected: currencyFormatter.format(summary.totals.amountExpected),
              paid: currencyFormatter.format(summary.totals.amountPaid),
            })}
          </p>
        </section>
      ) : (
        <Alert variant="warning">No se encontraron datos para mostrar.</Alert>
      )}
    </section>
  );
}

export default CalendarHeatmapPage;
