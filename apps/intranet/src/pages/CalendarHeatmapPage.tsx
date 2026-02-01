import { Popover } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs, { type Dayjs } from "dayjs";
import { Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fetchCalendarSummary } from "@/features/calendar/api";
import { CalendarFilterPanel } from "@/features/calendar/components/CalendarFilterPanel";
import HeatmapMonth from "@/features/calendar/components/HeatmapMonth";
import type { CalendarFilters } from "@/features/calendar/types";
import { useDisclosure } from "@/hooks/use-disclosure";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { Route } from "@/routes/_authed/calendar/heatmap";

import "dayjs/locale/es";

dayjs.locale("es");

interface HeatmapFilters {
  categories: string[];
  from: string;
  to: string;
}

const createInitialFilters = (): HeatmapFilters => {
  const start = dayjs().startOf("month").subtract(1, "month");
  const end = dayjs().endOf("month").add(1, "month");
  return {
    categories: [],
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = a.toSorted((x, y) => x.localeCompare(y));
  const sortedB = b.toSorted((x, y) => x.localeCompare(y));
  return sortedA.every((value, index) => value === sortedB[index]);
}

function CalendarHeatmapPage() {
  const navigate = Route.useNavigate();
  const searchParams = Route.useSearch();

  // Create defaults once (constant reference logic)
  const defaults = createInitialFilters();

  // 1. Source of Truth: URL Params with fallback to defaults
  const activeFilters = {
    categories: searchParams.categories ?? defaults.categories,
    from: searchParams.from ?? defaults.from,
    to: searchParams.to ?? defaults.to,
  };

  // 2. Local Form State (initialized from activeFilters)
  const [filters, setFilters] = useState<HeatmapFilters>(activeFilters);

  // Sync local state when URL params change (e.g. Browser Back/Forward)
  useEffect(() => {
    setFilters(activeFilters);
  }, [searchParams]);

  const { t } = useTranslation();
  const tc = (key: string, options?: Record<string, unknown>) => t(`calendar.${key}`, options);

  const { data: summary } = useSuspenseQuery({
    queryFn: () => {
      const apiFilters: CalendarFilters = {
        ...activeFilters,
        maxDays: 366,
      };
      return fetchCalendarSummary(apiFilters);
    },
    queryKey: ["calendar-heatmap", activeFilters],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const isDirty = !filtersEqual(filters, activeFilters);

  // --- Logic: Stats By Date ---
  const statsByDate = new Map<
    string,
    {
      amountExpected: number;
      amountPaid: number;
      total: number;
      typeCounts: Record<string, number>;
    }
  >();
  const typeCountsByDate = new Map<string, Record<string, number>>();

  for (const entry of summary?.aggregates?.byDate ?? []) {
    const key = String(entry.date).slice(0, 10);
    statsByDate.set(key, {
      amountExpected: entry.amountExpected ?? 0,
      amountPaid: entry.amountPaid ?? 0,
      total: entry.total,
      typeCounts: typeCountsByDate.get(key) ?? {},
    });
  }

  // --- Logic: Heatmap Months ---
  // Using activeFilters (URL) as source of truth for display
  const sourceFrom = summary?.filters.from || activeFilters.from;
  const sourceTo = summary?.filters.to || activeFilters.to;

  let start = sourceFrom
    ? dayjs(sourceFrom).startOf("month")
    : dayjs().startOf("month").subtract(1, "month");
  let end = sourceTo ? dayjs(sourceTo).startOf("month") : dayjs().startOf("month").add(1, "month");

  if (!start.isValid()) {
    start = dayjs().startOf("month").subtract(1, "month");
  }
  if (!end.isValid() || end.isBefore(start)) {
    end = start.add(2, "month");
  }

  const heatmapMonths: Dayjs[] = [];
  let cursor = start.clone();
  let guard = 0;
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    heatmapMonths.push(cursor);
    cursor = cursor.add(1, "month");
    guard += 1;
    if (guard > 18) break;
  }

  // --- Logic: Max Value ---
  const heatmapMonthKeys = new Set(heatmapMonths.map((month) => month.format("YYYY-MM")));
  let max = 0;
  if (summary) {
    if (summary.totals.maxEventCount !== undefined && summary.totals.maxEventCount !== null) {
      max = summary.totals.maxEventCount;
    } else {
      for (const entry of summary.aggregates.byDate) {
        const monthKey = String(entry.date).slice(0, 7);
        if (heatmapMonthKeys.has(monthKey)) {
          max = Math.max(max, entry.total);
        }
      }
    }
  }
  const heatmapMaxValue = max;

  // --- Helpers ---
  const handleApply = () => {
    void navigate({
      search: {
        ...filters,
        // Strip empty array to keep URL clean (optional, but good practice)
        categories: filters.categories.length > 0 ? filters.categories : undefined,
      },
    });
  };

  const handleReset = () => {
    void navigate({ search: {} });
  };

  const busy = false;
  const rangeStartLabel = heatmapMonths[0]?.format("MMM YYYY") ?? "—";
  const rangeEndLabel = heatmapMonths.at(-1)?.format("MMM YYYY") ?? "—";

  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  // --- Logic: Preview Count ---
  let previewCount: number | undefined;

  // Key check: do the dates in form match what we fetched (active)?
  // If yes, we can use fetched data to preview filtering
  if (summary && filters.from === activeFilters.from && filters.to === activeFilters.to) {
    if (filters.categories.length > 0) {
      const selected = new Set(filters.categories);
      previewCount = summary.available.categories
        .filter((c) => c.category && selected.has(c.category))
        .reduce((sum, c) => sum + c.total, 0);
    } else {
      const totalAvailable = summary.available.categories.reduce((sum, c) => sum + c.total, 0);
      if (summary.totals.events === 0 && totalAvailable > 0) {
        previewCount = totalAvailable;
      } else {
        previewCount = summary.totals.events;
      }
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-default-500">Heatmap</span>
          <span className="text-default-400 text-xs">
            {rangeStartLabel} - {rangeEndLabel}
          </span>
        </div>

        <Popover isOpen={filtersOpen} onOpenChange={setFiltersOpen}>
          <Popover.Trigger>
            <Button
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
                filtersOpen && "bg-default-50",
              )}
              size="sm"
              variant="outline"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </Popover.Trigger>
          <Popover.Content className="z-50 max-h-[80svh] overflow-y-auto p-0" offset={8}>
            <Popover.Dialog className="p-0">
              <div className="w-[min(92vw,520px)]">
                <Card className="rounded-xl border border-default-200/70 bg-content1/90 shadow-lg backdrop-blur">
                  <CalendarFilterPanel
                    availableCategories={summary?.available.categories ?? []}
                    filters={{
                      categories: filters.categories,
                      from: filters.from,
                      search: "",
                      to: filters.to,
                    }}
                    formClassName="p-3"
                    isDirty={isDirty}
                    loading={busy}
                    applyCount={previewCount ?? summary?.totals.events}
                    layout="dropdown"
                    onApply={() => {
                      handleApply();
                      setFiltersOpen(false);
                    }}
                    onFilterChange={(key, value) => {
                      if (key === "categories") {
                        setFilters((prev) => ({ ...prev, categories: value as string[] }));
                        return;
                      }
                      if (key === "from") {
                        setFilters((prev) => ({ ...prev, from: String(value ?? "") }));
                        return;
                      }
                      if (key === "to") {
                        setFilters((prev) => ({ ...prev, to: String(value ?? "") }));
                      }
                    }}
                    onReset={handleReset}
                    showDateRange
                    showSearch={false}
                    showSync={false}
                    variant="plain"
                  />
                </Card>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-default-500 text-sm font-semibold tracking-wide uppercase">
            {tc("heatmapSection")}
          </h2>
          <span className="text-default-500 text-xs">
            {tc("heatmapRange", {
              end: rangeEndLabel,
              start: rangeStartLabel,
            })}
          </span>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          {heatmapMonths.map((month) => (
            <HeatmapMonth
              key={month.format("YYYY-MM")}
              maxValue={heatmapMaxValue}
              month={month}
              statsByDate={statsByDate}
            />
          ))}
        </div>
        <p className="text-default-500 text-xs">
          {tc("heatmapTotals", {
            events: numberFormatter.format(summary.totals.events),
            expected: currencyFormatter.format(summary.totals.amountExpected),
            paid: currencyFormatter.format(summary.totals.amountPaid),
          })}
        </p>
      </section>
    </section>
  );
}

function filtersEqual(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.from === b.from && a.to === b.to && arraysEqual(a.categories, b.categories);
}

export default CalendarHeatmapPage;
