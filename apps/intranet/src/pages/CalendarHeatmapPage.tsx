import { Popover } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { Filter } from "lucide-react";
import { useMemo, useState } from "react";
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
  const sortedA = [...a].sort((x, y) => x.localeCompare(y));
  const sortedB = [...b].sort((x, y) => x.localeCompare(y));
  return sortedA.every((value, index) => value === sortedB[index]);
}

function filtersEqual(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.from === b.from && a.to === b.to && arraysEqual(a.categories, b.categories);
}

interface HeatmapDayData {
  amountExpected: number;
  amountPaid: number;
  total: number;
  typeCounts: Record<string, number>;
}

function processHeatmapData(
  summary: any,
  from: string,
  to: string,
): {
  heatmapMaxValue: number;
  heatmapMonths: dayjs.Dayjs[];
  statsByDate: Map<string, HeatmapDayData>;
} {
  const stats = new Map<string, HeatmapDayData>();
  for (const entry of summary?.aggregates?.byDate ?? []) {
    const key = String(entry.date).slice(0, 10);
    stats.set(key, {
      amountExpected: entry.amountExpected ?? 0,
      amountPaid: entry.amountPaid ?? 0,
      total: entry.total,
      typeCounts: {},
    });
  }

  const start = dayjs(from).isValid()
    ? dayjs(from).startOf("month")
    : dayjs().startOf("month").subtract(1, "month");

  let end = dayjs(to).isValid()
    ? dayjs(to).startOf("month")
    : dayjs().startOf("month").add(1, "month");

  if (end.isBefore(start)) end = start.add(2, "month");

  const heatmapMonths: dayjs.Dayjs[] = [];
  let current = start;
  while (current.isBefore(end) || current.isSame(end, "month")) {
    heatmapMonths.push(current);
    current = current.add(1, "month");
    if (heatmapMonths.length > 36) break; // Safety
  }

  const totals = summary?.aggregates?.byDate.map((d: any) => d.total) ?? [];
  const heatmapMaxValue = totals.length > 0 ? Math.max(...totals) : 10;

  return { heatmapMaxValue, heatmapMonths, statsByDate: stats };
}

function CalendarHeatmapPage() {
  const navigate = Route.useNavigate();
  const searchParams = Route.useSearch();
  const { t } = useTranslation();
  const tc = (key: string, options?: Record<string, unknown>) => t(`calendar.${key}`, options);

  const defaults = useMemo(() => createInitialFilters(), []);

  const activeFilters = useMemo(
    () => ({
      categories: searchParams.categories ?? defaults.categories,
      from: searchParams.from ?? defaults.from,
      to: searchParams.to ?? defaults.to,
    }),
    [searchParams, defaults],
  );

  const [filters, setFilters] = useState<HeatmapFilters>(activeFilters);

  const { data: summary } = useSuspenseQuery({
    queryFn: () => {
      const apiFilters: CalendarFilters = { ...activeFilters, maxDays: 366 };
      return fetchCalendarSummary(apiFilters);
    },
    queryKey: ["calendar-heatmap", activeFilters],
    staleTime: 5 * 60 * 1000,
  });

  const isDirty = useMemo(() => !filtersEqual(filters, activeFilters), [filters, activeFilters]);

  const { heatmapMaxValue, heatmapMonths, statsByDate } = useMemo(() => {
    return processHeatmapData(summary, activeFilters.from, activeFilters.to);
  }, [summary, activeFilters]);

  const previewCount = useMemo(() => {
    if (!summary || filters.from !== activeFilters.from || filters.to !== activeFilters.to)
      return summary?.totals.events;
    if (filters.categories.length > 0) {
      const selected = new Set(filters.categories);
      return summary.available.categories
        .filter((c) => c.category && selected.has(c.category))
        .reduce((sum, c) => sum + c.total, 0);
    }
    const totalAvailable = summary.available.categories.reduce((sum, c) => sum + c.total, 0);
    return summary.totals.events === 0 && totalAvailable > 0
      ? totalAvailable
      : summary.totals.events;
  }, [summary, filters, activeFilters]);

  const rangeStartLabel = heatmapMonths[0]?.format("MMM YYYY") ?? "—";
  const rangeEndLabel = heatmapMonths.at(-1)?.format("MMM YYYY") ?? "—";
  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

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
                    loading={false}
                    applyCount={previewCount ?? summary?.totals.events}
                    layout="dropdown"
                    onApply={() => {
                      void navigate({
                        search: {
                          ...filters,
                          categories:
                            filters.categories.length > 0 ? filters.categories : undefined,
                        },
                      });
                      setFiltersOpen(false);
                    }}
                    onFilterChange={(key, value) => {
                      if (key === "categories")
                        setFilters((prev) => ({ ...prev, categories: value as string[] }));
                      else if (key === "from")
                        setFilters((prev) => ({ ...prev, from: String(value ?? "") }));
                      else if (key === "to")
                        setFilters((prev) => ({ ...prev, to: String(value ?? "") }));
                    }}
                    onReset={() => {
                      void navigate({
                        search: (prev) => ({
                          ...prev,
                          from: undefined,
                          to: undefined,
                          categories: undefined,
                        }),
                      });
                    }}
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
            {tc("heatmapRange", { end: rangeEndLabel, start: rangeStartLabel })}
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
        {summary && (
          <p className="text-default-500 text-xs">
            {tc("heatmapTotals", {
              events: numberFormatter.format(summary.totals.events),
              expected: currencyFormatter.format(summary.totals.amountExpected),
              paid: currencyFormatter.format(summary.totals.amountPaid),
            })}
          </p>
        )}
      </section>
    </section>
  );
}

export default CalendarHeatmapPage;
