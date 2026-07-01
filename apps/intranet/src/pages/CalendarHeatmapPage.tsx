import { Button, Card, Modal, Surface } from "@heroui/react";
import { getRouteApi } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";
import { HeatmapMonth } from "@/features/calendar/components/HeatmapMonth";
import { MetricCard } from "@/features/calendar/components/MetricCard";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import type { CalendarSummary } from "@/features/calendar/types";
import { useDisclosure } from "@/hooks/use-disclosure";
import { addMonths, chileDay, formatChile, iterateMonths, today } from "@/lib/dates";
import { currencyFormatter, numberFormatter } from "@/lib/format";

const routeApi = getRouteApi("/_authed/calendar/");

interface HeatmapDayData {
  amountExpected: number;
  amountPaid: number;
  total: number;
  typeCounts: Record<string, number>;
}

interface MonthlyKpiData {
  amountExpected: number;
  amountPaid: number;
  avgTicket: number;
  collectionRate: number;
  events: number;
  gap: number;
  key: string;
  label: string;
}

function resolveActiveMonthKey(
  monthlyKpis: MonthlyKpiData[],
  manualSelectedMonthKey: null | string,
  currentMonthKey: string
): null | string {
  if (monthlyKpis.length === 0) {
    return null;
  }

  if (manualSelectedMonthKey && monthlyKpis.some((entry) => entry.key === manualSelectedMonthKey)) {
    return manualSelectedMonthKey;
  }

  if (monthlyKpis.some((entry) => entry.key === currentMonthKey)) {
    return currentMonthKey;
  }

  return monthlyKpis.at(-1)?.key ?? monthlyKpis[0]?.key ?? null;
}

function processHeatmapData(
  summary: CalendarSummary | null | undefined,
  from: string,
  to: string
): {
  heatmapMaxValue: number;
  heatmapMonths: string[];
  statsByDate: Map<string, HeatmapDayData>;
} {
  const stats = new Map<string, HeatmapDayData>();
  for (const entry of summary?.aggregates?.byDate ?? []) {
    // Use UTC to avoid off-by-one day shifts from timezone conversion of date-only values.
    const key = new Date(entry.date).toISOString().slice(0, 10);
    stats.set(key, {
      amountExpected: entry.amountExpected ?? 0,
      amountPaid: entry.amountPaid ?? 0,
      total: entry.total,
      typeCounts: {},
    });
  }

  const curYM = today().slice(0, 7);
  const fromValid = from && !Number.isNaN(new Date(from).getTime());
  const toValid = to && !Number.isNaN(new Date(to).getTime());
  const startYM = (fromValid ? from : addMonths(`${curYM}-01`, -1)).slice(0, 7);
  let endYM = (toValid ? to : addMonths(`${curYM}-01`, 1)).slice(0, 7);
  if (endYM < startYM) {
    endYM = addMonths(`${startYM}-01`, 2).slice(0, 7);
  }
  const heatmapMonths = iterateMonths(startYM, endYM).slice(0, 36);

  const totals = summary?.aggregates?.byDate.map((d) => d.total) ?? [];
  const heatmapMaxValue = totals.length > 0 ? Math.max(...totals) : 10;

  return { heatmapMaxValue, heatmapMonths, statsByDate: stats };
}

function CalendarHeatmapPage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { t } = useTranslation();
  const tc = (key: string, options?: Record<string, unknown>) => t(`calendar.${key}`, options);

  const { appliedFilters, availableCategories, daily, defaults, loading, summary } =
    useCalendarEvents();

  // Local state for filter draft
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);
  const [selectedDate, setSelectedDate] = useState<null | string>(null);
  const { isOpen: dayDetailOpen, set: setDayDetailOpen } = useDisclosure(false);

  // Sync draft with active filters when popover is closed
  React.useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters(appliedFilters);
    }
  }, [appliedFilters, filtersOpen]);

  const isDirty = useMemo(
    () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
    [draftFilters, appliedFilters]
  );

  const { heatmapMaxValue, heatmapMonths, statsByDate } = useMemo(() => {
    return processHeatmapData(summary, appliedFilters.from, appliedFilters.to);
  }, [summary, appliedFilters]);

  const previewCount = useMemo(() => {
    if (!summary) {
      return 0;
    }
    if (draftFilters.categories.length > 0) {
      const selected = new Set(draftFilters.categories);
      return summary.available.categories
        .filter((c) => c.category && selected.has(c.category))
        .reduce((sum, c) => sum + c.total, 0);
    }
    return summary.totals.events;
  }, [summary, draftFilters.categories]);

  const rangeStartLabel = heatmapMonths[0]
    ? formatChile(`${heatmapMonths[0]}-01`, "MMM YYYY")
    : "—";
  const lastMonth = heatmapMonths.at(-1);
  const rangeEndLabel = lastMonth ? formatChile(`${lastMonth}-01`, "MMM YYYY") : "—";
  const selectedDay = useMemo(() => {
    if (!selectedDate) {
      return null;
    }
    const matched = daily?.days.find((day) => chileDay(day.date) === selectedDate);
    return matched ?? null;
  }, [daily?.days, selectedDate]);
  const selectedDayLabel = selectedDate ? formatChile(selectedDate, "dddd DD MMMM YYYY") : "";
  const monthlyKpis = useMemo<MonthlyKpiData[]>(() => {
    const monthMap = new Map<
      string,
      { amountExpected: number; amountPaid: number; events: number }
    >();
    for (const entry of summary?.aggregates.byMonth ?? []) {
      const key = `${entry.year}-${String(entry.month).padStart(2, "0")}`;
      monthMap.set(key, {
        amountExpected: entry.amountExpected ?? 0,
        amountPaid: entry.amountPaid ?? 0,
        events: entry.total ?? 0,
      });
    }

    return heatmapMonths.map((month) => {
      const key = month;
      const base = monthMap.get(key) ?? { amountExpected: 0, amountPaid: 0, events: 0 };
      const collectionRate =
        base.amountExpected > 0 ? (base.amountPaid / base.amountExpected) * 100 : 0;
      const avgTicket = base.events > 0 ? base.amountExpected / base.events : 0;
      const gap = Math.max(base.amountExpected - base.amountPaid, 0);

      return {
        amountExpected: base.amountExpected,
        amountPaid: base.amountPaid,
        avgTicket,
        collectionRate,
        events: base.events,
        gap,
        key,
        label: formatChile(`${month}-01`, "MMM YYYY"),
      };
    });
  }, [summary?.aggregates.byMonth, heatmapMonths]);

  const [manualSelectedMonthKey, setManualSelectedMonthKey] = useState<null | string>(null);
  const currentMonthKey = today().slice(0, 7);

  const activeMonthKey = useMemo(
    () => resolveActiveMonthKey(monthlyKpis, manualSelectedMonthKey, currentMonthKey),
    [currentMonthKey, manualSelectedMonthKey, monthlyKpis]
  );

  const activeMonthlyKpi = useMemo(() => {
    if (!activeMonthKey) {
      return null;
    }
    return monthlyKpis.find((entry) => entry.key === activeMonthKey) ?? null;
  }, [activeMonthKey, monthlyKpis]);

  return (
    <section className="space-y-4">
      <Surface
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-default-100 px-3 py-2 sm:px-4"
        variant="secondary"
      >
        <div className="flex items-center gap-2 font-medium text-sm">
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
                from: draftFilters.from || undefined,
                to: draftFilters.to || undefined,
                calendarId: draftFilters.calendarIds?.length ? draftFilters.calendarIds : undefined,
                category: draftFilters.categories.length ? draftFilters.categories : undefined,
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
                category: undefined,
                search: undefined,
              }),
            });
          }}
          showDateRange
        />
      </Surface>

      {activeMonthlyKpi && (
        <Card variant="secondary">
          <Card.Header className="flex flex-col items-start gap-3 pb-2">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-default-700 text-sm">KPI Mensuales</span>
              <span className="text-default-500 text-xs">Mes activo: {activeMonthlyKpi.label}</span>
            </div>
            <div className="flex w-full gap-2 overflow-x-auto pb-1">
              {monthlyKpis.map((month) => (
                <Button
                  className="shrink-0"
                  key={month.key}
                  onPress={() => setManualSelectedMonthKey(month.key)}
                  size="sm"
                  variant={month.key === activeMonthlyKpi.key ? "primary" : "secondary"}
                >
                  {month.label}
                </Button>
              ))}
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                size="sm"
                subtitle="Eventos del mes"
                title="Eventos"
                tone="primary"
                value={numberFormatter.format(activeMonthlyKpi.events)}
              />
              <MetricCard
                size="sm"
                subtitle="Total esperado"
                title="Monto Esperado"
                tone="warning"
                value={currencyFormatter.format(activeMonthlyKpi.amountExpected)}
              />
              <MetricCard
                size="sm"
                subtitle="Total pagado"
                title="Monto Pagado"
                tone="success"
                value={currencyFormatter.format(activeMonthlyKpi.amountPaid)}
              />
              <MetricCard
                size="sm"
                subtitle="Pagado / esperado"
                suffix="%"
                title="Cobranza"
                tone={
                  activeMonthlyKpi.collectionRate >= 90
                    ? "success"
                    : activeMonthlyKpi.collectionRate >= 70
                      ? "warning"
                      : "error"
                }
                value={activeMonthlyKpi.collectionRate.toFixed(1)}
              />
              <MetricCard
                size="sm"
                subtitle="Esperado por evento"
                title="Ticket Prom."
                value={currencyFormatter.format(activeMonthlyKpi.avgTicket)}
              />
              <MetricCard
                size="sm"
                subtitle="Esperado - pagado"
                title="Brecha"
                tone={activeMonthlyKpi.gap > 0 ? "warning" : "default"}
                value={currencyFormatter.format(activeMonthlyKpi.gap)}
              />
            </div>
          </Card.Content>
        </Card>
      )}

      <Card variant="secondary">
        <Card.Header className="pb-2">
          <span className="text-default-500 text-xs">
            {tc("heatmapRange", { end: rangeEndLabel, start: rangeStartLabel })}
          </span>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {heatmapMonths.map((month) => (
              <HeatmapMonth
                key={month}
                maxValue={heatmapMaxValue}
                month={month}
                onDayClick={(isoDate) => {
                  setSelectedDate(isoDate);
                  setDayDetailOpen(true);
                }}
                selectedDate={selectedDate ?? undefined}
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
        </Card.Content>
      </Card>

      <Modal.Backdrop isOpen={dayDetailOpen} onOpenChange={setDayDetailOpen} variant="blur">
        <Modal.Container placement="center" scroll="inside" size="lg">
          <Modal.Dialog className="w-full max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Detalle diario</Modal.Heading>
              <p className="text-default-500 text-sm capitalize">{selectedDayLabel}</p>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              {selectedDay ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-default-600 text-xs">
                    <span>Eventos: {numberFormatter.format(selectedDay.total)}</span>
                    <span>Esperado: {currencyFormatter.format(selectedDay.amountExpected)}</span>
                    <span>Pagado: {currencyFormatter.format(selectedDay.amountPaid)}</span>
                  </div>
                  {selectedDay.events.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDay.events.map((event) => (
                        <DailyEventCard
                          event={event}
                          key={`${event.eventId}-${event.calendarId}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card className="border border-default-200" variant="default">
                      <Card.Content className="py-6 text-center text-default-500 text-sm">
                        No hay eventos para este día.
                      </Card.Content>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="border border-default-200" variant="default">
                  <Card.Content className="py-6 text-center text-default-500 text-sm">
                    No se encontró información diaria para la fecha seleccionada.
                  </Card.Content>
                </Card>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}
export { CalendarHeatmapPage };
