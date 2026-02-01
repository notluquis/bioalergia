import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import HeatmapMonth from "@/features/calendar/components/HeatmapMonth";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import type { CalendarSummary } from "@/features/calendar/types";
import { useDisclosure } from "@/hooks/use-disclosure";
import { currencyFormatter, numberFormatter } from "@/lib/format";

const routeApi = getRouteApi("/_authed/calendar/heatmap");
import "dayjs/locale/es";

dayjs.locale("es");

interface HeatmapDayData {
  amountExpected: number;
  amountPaid: number;
  total: number;
  typeCounts: Record<string, number>;
}

function processHeatmapData(
  summary: CalendarSummary | null | undefined,
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

  const totals = summary?.aggregates?.byDate.map((d) => d.total) ?? [];
  const heatmapMaxValue = totals.length > 0 ? Math.max(...totals) : 10;

  return { heatmapMaxValue, heatmapMonths, statsByDate: stats };
}

function CalendarHeatmapPage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { t } = useTranslation();
  const tc = (key: string, options?: Record<string, unknown>) => t(`calendar.${key}`, options);

  const { appliedFilters, availableCategories, defaults, loading, summary } = useCalendarEvents();

  // Local state for filter draft
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  // Sync draft with active filters when popover is closed
  React.useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters(appliedFilters);
    }
  }, [appliedFilters, filtersOpen]);

  const isDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters],
  );

  const { heatmapMaxValue, heatmapMonths, statsByDate } = useMemo(() => {
    return processHeatmapData(summary, appliedFilters.from, appliedFilters.to);
  }, [summary, appliedFilters]);

  const previewCount = useMemo(() => {
    if (!summary) return 0;
    if (draftFilters.categories.length > 0) {
      const selected = new Set(draftFilters.categories);
      return summary.available.categories
        .filter((c) => c.category && selected.has(c.category))
        .reduce((sum, c) => sum + c.total, 0);
    }
    return summary.totals.events;
  }, [summary, draftFilters.categories]);

  const rangeStartLabel = heatmapMonths[0]?.format("MMM YYYY") ?? "—";
  const rangeEndLabel = heatmapMonths.at(-1)?.format("MMM YYYY") ?? "—";

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-default-500">Heatmap</span>
          <span className="text-default-400 text-xs">
            {rangeStartLabel} - {rangeEndLabel}
          </span>
        </div>
        <CalendarFiltersPopover
          applyCount={previewCount}
          availableCategories={availableCategories}
          filters={draftFilters}
          isDirty={isDirty}
          isOpen={filtersOpen}
          layout="dropdown"
          loading={loading}
          onApply={() => {
            void navigate({
              search: {
                ...search,
                calendarId: draftFilters.calendarIds?.length ? draftFilters.calendarIds : undefined,
                category: draftFilters.categories,
                search: draftFilters.search || undefined,
              },
            });
            setFiltersOpen(false);
          }}
          onFilterChange={(key, value) => {
            setDraftFilters((prev) => ({ ...prev, [key]: value }));
          }}
          onOpenChange={setFiltersOpen}
          onReset={() => {
            setDraftFilters(defaults);
            void navigate({
              search: (prev) => ({
                ...prev,
                from: undefined,
                to: undefined,
                calendarId: undefined,
                category: [],
                search: undefined,
              }),
            });
          }}
          showDateRange
        />
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
