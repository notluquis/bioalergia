import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";

import Button from "../components/Button";
import Input from "../components/Input";
import Alert from "../components/Alert";
import { MultiSelectFilter, type MultiSelectOption } from "../features/calendar/components/MultiSelectFilter";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import { MonthlyHeatmap } from "../features/calendar/components/MonthlyHeatmap";

dayjs.locale("es");

const numberFormatter = new Intl.NumberFormat("es-CL");
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

function CalendarHeatmapPage() {
  const {
    filters,
    summary,
    loading,
    error,
    isDirty,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const calendarOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCalendars.map((entry) => ({
        value: entry.calendarId,
        label: `${entry.calendarId} · ${numberFormatter.format(entry.total)}`,
      })),
    [availableCalendars]
  );

  const eventTypeOptions: MultiSelectOption[] = useMemo(
    () =>
      availableEventTypes.map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableEventTypes]
  );

  const categoryOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCategories.map((entry) => {
        const value = entry.category ?? NULL_CATEGORY_VALUE;
        const label = entry.category ?? "Sin clasificación";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableCategories]
  );

  const statsByDate = useMemo(() => {
    const map = new Map<string, { total: number; amountExpected: number; amountPaid: number }>();
    summary?.aggregates.byDate.forEach((entry) => {
      map.set(entry.date, {
        total: entry.total,
        amountExpected: entry.amountExpected ?? 0,
        amountPaid: entry.amountPaid ?? 0,
      });
    });
    return map;
  }, [summary?.aggregates.byDate]);

  const heatmapMonths = useMemo(() => {
    const now = dayjs();
    return [
      now.subtract(1, "month").startOf("month"),
      now.startOf("month"),
      now.add(1, "month").startOf("month"),
    ];
  }, []);

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

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Mapa de calor de calendario</h1>
        <p className="text-sm text-slate-600">
          Visualiza cómo se distribuyen los eventos por semana y día. Cambia los filtros para explorar distintos rangos
          y categorías.
        </p>
      </header>

      <form
        className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white/80 p-6 text-xs text-slate-600 shadow-sm md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <Input
          label="Desde"
          type="date"
          value={filters.from}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("from", event.target.value)}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.to}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("to", event.target.value)}
        />
        <MultiSelectFilter
          label="Calendarios"
          options={calendarOptions}
          selected={filters.calendarIds}
          onToggle={(value) => {
            updateFilters(
              "calendarIds",
              filters.calendarIds.includes(value)
                ? filters.calendarIds.filter((id) => id !== value)
                : [...filters.calendarIds, value]
            );
          }}
          placeholder="Todos"
        />
        <MultiSelectFilter
          label="Tipos de evento"
          options={eventTypeOptions}
          selected={filters.eventTypes}
          onToggle={(value) => {
            updateFilters(
              "eventTypes",
              filters.eventTypes.includes(value)
                ? filters.eventTypes.filter((id) => id !== value)
                : [...filters.eventTypes, value]
            );
          }}
          placeholder="Todos"
        />
        <MultiSelectFilter
          label="Clasificación"
          options={categoryOptions}
          selected={filters.categories}
          onToggle={(value) => {
            updateFilters(
              "categories",
              filters.categories.includes(value)
                ? filters.categories.filter((id) => id !== value)
                : [...filters.categories, value]
            );
          }}
          placeholder="Todas"
        />
        <Input
          label="Buscar"
          placeholder="Título o descripción"
          value={filters.search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("search", event.target.value)}
        />
        <div className="flex items-end gap-2 md:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Actualizando..." : "Aplicar filtros"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || !isDirty}
            onClick={() => {
              resetFilters();
            }}
          >
            Reestablecer
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mapa de calor mensual</h2>
          <span className="text-[11px] text-slate-500">
            Mostrando {heatmapMonths[0].format("MMM YYYY")} – {heatmapMonths[2].format("MMM YYYY")}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {heatmapMonths.map((month) => (
            <MonthlyHeatmap
              key={month.format("YYYY-MM")}
              month={month}
              statsByDate={statsByDate}
              maxValue={heatmapMaxValue}
              titleSuffix="Eventos"
            />
          ))}
        </div>
      </section>
    </section>
  );
}

export default CalendarHeatmapPage;
