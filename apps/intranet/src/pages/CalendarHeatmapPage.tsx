import { Card, Modal, Surface } from "@heroui/react";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/ui/StatCard";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";
import { HeatmapMonth } from "@/features/calendar/components/HeatmapMonth";
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
    // Use UTC to avoid off-by-one day shifts from timezone conversion of date-only values.
    const key = dayjs.utc(entry.date).format("YYYY-MM-DD");
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

  if (end.isBefore(start)) {
    end = start.add(2, "month");
  }

  const heatmapMonths: dayjs.Dayjs[] = [];
  let current = start;
  while (current.isBefore(end) || current.isSame(end, "month")) {
    heatmapMonths.push(current);
    current = current.add(1, "month");
    if (heatmapMonths.length > 36) {
      break; // Safety
    }
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
    [draftFilters, appliedFilters],
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

  const rangeStartLabel = heatmapMonths[0]?.format("MMM YYYY") ?? "—";
  const rangeEndLabel = heatmapMonths.at(-1)?.format("MMM YYYY") ?? "—";
  const selectedDay = useMemo(() => {
    if (!selectedDate) {
      return null;
    }
    const matched = daily?.days.find(
      (day) => dayjs(day.date).format("YYYY-MM-DD") === selectedDate,
    );
    return matched ?? null;
  }, [daily?.days, selectedDate]);
  const selectedDayLabel = selectedDate ? dayjs(selectedDate).format("dddd DD MMMM YYYY") : "";

  const kpis = useMemo(() => {
    const totalEvents = summary?.totals.events ?? 0;
    const amountExpected = summary?.totals.amountExpected ?? 0;
    const amountPaid = summary?.totals.amountPaid ?? 0;
    const collectionRate = amountExpected > 0 ? (amountPaid / amountExpected) * 100 : 0;
    const uncategorizedEvents =
      summary?.available.categories
        .filter((entry) => !entry.category || entry.category.trim() === "")
        .reduce((sum, entry) => sum + entry.total, 0) ?? 0;

    const noShowCount =
      daily?.days.reduce(
        (sum, day) => sum + day.events.filter((event) => event.attended === false).length,
        0,
      ) ?? 0;

    const today = dayjs().startOf("day");
    let pastOutstanding = 0;
    let futureOutstanding = 0;
    for (const entry of summary?.aggregates.byDate ?? []) {
      const date = dayjs.utc(entry.date).startOf("day");
      const outstanding = Math.max((entry.amountExpected ?? 0) - (entry.amountPaid ?? 0), 0);
      if (date.isBefore(today, "day")) {
        pastOutstanding += outstanding;
      } else {
        futureOutstanding += outstanding;
      }
    }

    const avgTicket = totalEvents > 0 ? amountExpected / totalEvents : 0;

    return {
      amountExpected,
      amountPaid,
      avgTicket,
      collectionRate,
      futureOutstanding,
      noShowCount,
      pastOutstanding,
      totalEvents,
      uncategorizedEvents,
    };
  }, [summary, daily?.days]);

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
      </Surface>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          size="sm"
          subtitle="Total del rango seleccionado"
          title="Eventos"
          tone="primary"
          value={numberFormatter.format(kpis.totalEvents)}
        />
        <StatCard
          size="sm"
          subtitle="No asistió / no llegó"
          title="No Show"
          tone={kpis.noShowCount > 0 ? "warning" : "default"}
          value={numberFormatter.format(kpis.noShowCount)}
        />
        <StatCard
          size="sm"
          subtitle="Sin categoría"
          title="Sin Clasificar"
          tone={kpis.uncategorizedEvents > 0 ? "warning" : "default"}
          value={numberFormatter.format(kpis.uncategorizedEvents)}
        />
        <StatCard
          size="sm"
          subtitle="Pagado / esperado"
          suffix="%"
          title="Cobranza"
          tone={
            kpis.collectionRate >= 90 ? "success" : kpis.collectionRate >= 70 ? "warning" : "error"
          }
          value={kpis.collectionRate.toFixed(1)}
        />
        <StatCard
          size="sm"
          subtitle="Esperado por evento"
          title="Ticket Prom."
          value={currencyFormatter.format(kpis.avgTicket)}
        />
        <StatCard
          size="sm"
          subtitle="Esperado - pagado (pasado)"
          title="No Cobrado"
          tone={kpis.pastOutstanding > 0 ? "warning" : "default"}
          value={currencyFormatter.format(kpis.pastOutstanding)}
        />
        <StatCard
          size="sm"
          subtitle="Desde hoy en adelante"
          title="Restante"
          tone="primary"
          value={currencyFormatter.format(kpis.futureOutstanding)}
        />
        <StatCard
          size="sm"
          subtitle="Total del rango"
          title="Monto Esperado"
          value={currencyFormatter.format(kpis.amountExpected)}
        />
        <StatCard
          size="sm"
          subtitle="Total del rango"
          title="Monto Pagado"
          tone="success"
          value={currencyFormatter.format(kpis.amountPaid)}
        />
      </div>

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
                key={month.format("YYYY-MM")}
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
