import "dayjs/locale/es";

import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronDown, Filter } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { fetchCalendarSummary } from "@/features/calendar/api";
import HeatmapMonth from "@/features/calendar/components/HeatmapMonth";
import { MultiSelectFilter, type MultiSelectOption } from "@/features/calendar/components/MultiSelectFilter";
import { NULL_CATEGORY_VALUE } from "@/features/calendar/constants";
import { type CalendarFilters } from "@/features/calendar/types";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { PAGE_CONTAINER } from "@/lib/styles";

dayjs.locale("es");

type HeatmapFilters = {
  from: string;
  to: string;
  categories: string[];
};

const createInitialFilters = (): HeatmapFilters => {
  const start = dayjs().startOf("month").subtract(2, "month");
  const end = dayjs().endOf("month").add(2, "month");
  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
    categories: [],
  };
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function filtersEqual(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.from === b.from && a.to === b.to && arraysEqual(a.categories, b.categories);
}

function CalendarHeatmapPage() {
  // React Compiler auto-memoizes function calls in useState initializer
  const [filters, setFilters] = useState<HeatmapFilters>(() => createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState<HeatmapFilters>(() => createInitialFilters());

  const { t } = useTranslation();
  // React Compiler auto-stabilizes helper functions
  const tc = (key: string, options?: Record<string, unknown>) => t(`calendar.${key}`, options);

  const {
    data: summary,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["calendar-heatmap", appliedFilters],
    queryFn: () => {
      const apiFilters: CalendarFilters = {
        ...appliedFilters,
        maxDays: 366,
      };
      return fetchCalendarSummary(apiFilters);
    },
    // Keep previous data while fetching new filter to avoid flicker
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;
  const initializing = loading && !summary;

  // NOTE: We no longer sync server filters back to UI to avoid overwriting user changes.
  // The user's `filters` state is the source of truth for the form.
  // `appliedFilters` drives the query, and changes when user clicks "Apply".

  // React Compiler auto-memoizes comparison functions
  const isDirty = !filtersEqual(filters, appliedFilters);

  // React Compiler auto-memoizes array transformations
  const availableCategories: MultiSelectOption[] = (summary?.available.categories ?? []).map((entry) => {
    const value = entry.category ?? NULL_CATEGORY_VALUE;
    const label = entry.category ?? "Sin clasificación";
    return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
  });

  // React Compiler auto-memoizes Map operations
  const getStatsByDate = () => {
    const map = new Map<string, { total: number; amountExpected: number; amountPaid: number }>();
    summary?.aggregates.byDate.forEach((entry) => {
      // Server now returns dates as "YYYY-MM-DD" strings via TO_CHAR in SQL
      const key = String(entry.date).slice(0, 10);
      map.set(key, {
        total: entry.total,
        amountExpected: entry.amountExpected ?? 0,
        amountPaid: entry.amountPaid ?? 0,
      });
    });
    return map;
  };
  const statsByDate = getStatsByDate();

  // React Compiler auto-memoizes complex calculations
  const getHeatmapMonths = () => {
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
  };
  const heatmapMonths = getHeatmapMonths();

  // React Compiler auto-memoizes Set creation
  const heatmapMonthKeys = new Set(heatmapMonths.map((month) => month.format("YYYY-MM")));

  // React Compiler auto-memoizes max value calculation
  const getHeatmapMaxValue = () => {
    if (!summary) return 0;
    let max = 0;
    summary.aggregates.byDate.forEach((entry) => {
      // Server now returns "YYYY-MM-DD" strings, extract month portion
      const monthKey = String(entry.date).slice(0, 7);
      if (heatmapMonthKeys.has(monthKey)) {
        max = Math.max(max, entry.total);
      }
    });
    return max;
  };
  const heatmapMaxValue = getHeatmapMaxValue();

  const handleToggle = (key: "categories", value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }));
  };

  const handleApply = () => {
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    const defaults = createInitialFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
  };

  const busy = loading || initializing;
  const rangeStartLabel = heatmapMonths[0]?.format("MMM YYYY") ?? "—";
  const rangeEndLabel = heatmapMonths[heatmapMonths.length - 1]?.format("MMM YYYY") ?? "—";

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className={PAGE_CONTAINER}>
      {/* Collapsible Filter Toolbar */}
      <Card className="overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="hover:bg-base-200/50 flex w-full items-center justify-between px-6 py-4 text-left transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
              <Filter className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-base-content text-sm font-medium">Filtros y Visualización</h3>
              <div className="text-base-content/60 mt-0.5 flex flex-wrap gap-2 text-xs">
                <span className="font-medium">
                  {rangeStartLabel} - {rangeEndLabel}
                </span>
              </div>
            </div>
          </div>

          <ChevronDown
            className={clsx(
              "text-base-content/40 h-5 w-5 transition-transform duration-300",
              showAdvanced && "rotate-180"
            )}
          />
        </button>

        <div
          className={clsx(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            showAdvanced ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <form
              className="border-base-200/50 space-y-6 border-t p-6 pt-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleApply();
                setShowAdvanced(false); // Auto-close on apply for cleaner UX
              }}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  label={tc("filters.categories")}
                  options={availableCategories}
                  selected={filters.categories}
                  onToggle={(value) => handleToggle("categories", value)}
                  placeholder={tc("filters.allCategories")}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    handleReset();
                  }}
                  disabled={busy || !isDirty}
                >
                  {tc("resetFilters")}
                </Button>
                <Button type="submit" disabled={busy}>
                  {loading ? tc("loading") : tc("applyFilters")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {initializing && !summary ? (
        <p className="text-base-content/60 text-sm">{tc("loading")}</p>
      ) : summary ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base-content/60 text-sm font-semibold tracking-wide uppercase">
              {tc("heatmapSection")}
            </h2>
            <span className="text-base-content/60 text-xs">
              {tc("heatmapRange", {
                start: rangeStartLabel,
                end: rangeEndLabel,
              })}
            </span>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            {heatmapMonths.map((month) => (
              <HeatmapMonth
                key={month.format("YYYY-MM")}
                month={month}
                statsByDate={statsByDate}
                maxValue={heatmapMaxValue}
              />
            ))}
          </div>
          <p className="text-base-content/60 text-xs">
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
