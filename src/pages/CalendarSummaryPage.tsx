import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";

import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { MultiSelectFilter, type MultiSelectOption } from "../features/calendar/components/MultiSelectFilter";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type { CalendarAggregateByDate } from "../features/calendar/types";
import { Link } from "react-router-dom";
import { MonthlyHeatmap } from "../features/calendar/components/MonthlyHeatmap";

dayjs.locale("es");
dayjs.extend(isoWeek);

const numberFormatter = new Intl.NumberFormat("es-CL");
const currencyFormatter = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
const weekdayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

type AggregationRow = {
  label: string;
  value: number;
  amountExpected?: number;
  amountPaid?: number;
  hint?: string;
};

function AggregationCard({ title, rows }: { title: string; rows: AggregationRow[] }) {
  return (
    <section className="glass-card glass-underlay-gradient space-y-3 rounded-2xl border border-white/60 p-5 text-sm shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--brand-secondary)]">{title}</h3>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-500">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">Sin datos para los filtros aplicados.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={`${row.label}-${row.hint ?? ""}`} className="flex items-baseline justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">{row.label}</span>
                {row.hint && <span className="text-xs text-slate-400">{row.hint}</span>}
              </div>
              <span className="text-sm font-semibold text-[var(--brand-primary)]">
                {numberFormatter.format(row.value)}
              </span>
              {(row.amountExpected != null || row.amountPaid != null) && (
                <span className="text-[11px] text-slate-500">
                  {row.amountExpected != null ? `Esperado ${currencyFormatter.format(row.amountExpected)}` : ""}
                  {row.amountExpected != null && row.amountPaid != null ? " · " : ""}
                  {row.amountPaid != null ? `Pagado ${currencyFormatter.format(row.amountPaid)}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatMonthLabel(entry: { year: number; month: number }) {
  const monthIndex = Math.max(1, Math.min(12, entry.month));
  const monthName = dayjs().month(monthIndex - 1).format("MMM");
  return {
    label: `${entry.year}-${monthIndex.toString().padStart(2, "0")}`,
    hint: monthName.charAt(0).toUpperCase() + monthName.slice(1),
  };
}

const formatWeekdayLabel = (weekday: number) => weekdayLabels[weekday] ?? `Día ${weekday}`;

function topDates(byDate: CalendarAggregateByDate[], limit = 10): AggregationRow[] {
  return [...byDate]
    .sort((a, b) => (a.total === b.total ? (a.date < b.date ? -1 : 1) : b.total - a.total))
    .slice(0, limit)
    .map((entry) => ({
      label: dayjs(entry.date).format("DD MMM YYYY"),
      value: entry.total,
      amountExpected: entry.amountExpected,
      amountPaid: entry.amountPaid,
    }));
}

function CalendarSummaryPage() {
  const {
    filters,
    summary,
    loading,
    error,
    isDirty,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    syncing,
    syncError,
    lastSyncInfo,
    syncNow,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const totals = useMemo(
    () => ({
      events: summary?.totals.events ?? 0,
      days: summary?.totals.days ?? 0,
      amountExpected: summary?.totals.amountExpected ?? 0,
      amountPaid: summary?.totals.amountPaid ?? 0,
    }),
    [summary?.totals.amountExpected, summary?.totals.amountPaid, summary?.totals.days, summary?.totals.events]
  );

  const toggleCalendar = (calendarId: string) => {
    updateFilters(
      "calendarIds",
      filters.calendarIds.includes(calendarId)
        ? filters.calendarIds.filter((id) => id !== calendarId)
        : [...filters.calendarIds, calendarId]
    );
  };

  const toggleEventType = (value: string) => {
    updateFilters(
      "eventTypes",
      filters.eventTypes.includes(value)
        ? filters.eventTypes.filter((id) => id !== value)
        : [...filters.eventTypes, value]
    );
  };

  const toggleCategory = (value: string) => {
    updateFilters(
      "categories",
      filters.categories.includes(value)
        ? filters.categories.filter((id) => id !== value)
        : [...filters.categories, value]
    );
  };

  const aggregationRows = useMemo(() => {
    if (!summary) {
      return {
        byYear: [] as AggregationRow[],
        byMonth: [] as AggregationRow[],
        byWeek: [] as AggregationRow[],
        byWeekday: [] as AggregationRow[],
        topDates: [] as AggregationRow[],
      };
    }

    const currentYear = dayjs().year();

    const byMonth = summary.aggregates.byMonth
      .filter((entry) => entry.year === currentYear)
      .map((entry) => {
        const { label, hint } = formatMonthLabel(entry);
        return { label, value: entry.total, hint, amountExpected: entry.amountExpected, amountPaid: entry.amountPaid };
      });

    const byDateCurrentYear = summary.aggregates.byDate.filter((entry) => dayjs(entry.date).year() === currentYear);

    const weekBuckets = new Map<
      number,
      Map<number, { events: number; amountExpected: number; amountPaid: number }>
    >();
    byDateCurrentYear.forEach((entry) => {
      const date = dayjs(entry.date);
      const month = date.month() + 1;
      const week = date.isoWeek();
      if (!weekBuckets.has(month)) weekBuckets.set(month, new Map());
      const monthMap = weekBuckets.get(month)!;
      const bucket = monthMap.get(week) ?? { events: 0, amountExpected: 0, amountPaid: 0 };
      bucket.events += entry.total;
      bucket.amountExpected += entry.amountExpected ?? 0;
      bucket.amountPaid += entry.amountPaid ?? 0;
      monthMap.set(week, bucket);
    });

    const byWeek: AggregationRow[] = Array.from(weekBuckets.entries())
      .sort(([monthA], [monthB]) => monthA - monthB)
      .flatMap(([month, weeks]) => {
        const monthName = dayjs().month(month - 1).format("MMMM");
        return Array.from(weeks.entries())
          .sort(([weekA], [weekB]) => weekA - weekB)
          .map(([week, bucket]) => ({
            label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} · Semana ${week
              .toString()
              .padStart(2, "0")}`,
            value: bucket.events,
            amountExpected: bucket.amountExpected,
            amountPaid: bucket.amountPaid,
          }));
      });

    const byWeekday = summary.aggregates.byWeekday
      .filter((entry) => entry.weekday <= 5)
      .map((entry) => ({
        label: formatWeekdayLabel(entry.weekday),
        value: entry.total,
        amountExpected: entry.amountExpected,
        amountPaid: entry.amountPaid,
      }));

    return {
      byYear: summary.aggregates.byYear
        .filter((entry) => entry.year === currentYear)
        .map((entry) => ({
          label: entry.year.toString(),
          value: entry.total,
          amountExpected: entry.amountExpected,
          amountPaid: entry.amountPaid,
        })),
      byMonth,
      byWeek,
      byWeekday,
      topDates: topDates(byDateCurrentYear.length ? byDateCurrentYear : summary.aggregates.byDate),
    };
  }, [summary]);

  const calendarOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCalendars.map((entry) => ({
        value: entry.calendarId,
        label: `${entry.calendarId} · ${numberFormatter.format(entry.total)}`,
      })),
    [availableCalendars]
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

  const eventTypeOptions: MultiSelectOption[] = useMemo(
    () =>
      availableEventTypes.map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableEventTypes]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Eventos de Calendario</h1>
          <p className="text-sm text-slate-600">
            Visualiza los eventos sincronizados desde Google Calendar y analiza su distribución por periodos.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button onClick={syncNow} disabled={syncing} className="self-start sm:self-auto">
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
          <Link to="/calendar/classify" className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-secondary)] underline">
            Clasificar pendientes
          </Link>
        </div>
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
          onToggle={toggleCalendar}
          placeholder="Todos"
        />
        <MultiSelectFilter
          label="Tipos de evento"
          options={eventTypeOptions}
          selected={filters.eventTypes}
          onToggle={toggleEventType}
          placeholder="Todos"
        />
        <MultiSelectFilter
          label="Clasificación"
          options={categoryOptions}
          selected={filters.categories}
          onToggle={toggleCategory}
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

      {syncing && (
        <Alert variant="info">
          <span className="font-semibold text-slate-700">Sincronizando calendario…</span>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-600">
            <li>Consultando Google Calendar y descargando los eventos nuevos o modificados.</li>
            <li>Actualizando la base de datos con los cambios detectados.</li>
            <li>Eliminando eventos que quedaron excluidos por reglas de filtrado.</li>
            <li>Recalculando totales y montos para el panel.</li>
          </ul>
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {syncError && <Alert variant="error">{syncError}</Alert>}
      {lastSyncInfo && !syncError && (
        <Alert variant="success">
          <span className="font-semibold text-slate-700">Sincronización completada</span>
          <div className="mt-2 space-y-1 text-[11px] text-slate-600">
            <p>
              <span className="font-semibold text-slate-700">Nuevas:</span>{" "}
              {numberFormatter.format(lastSyncInfo.inserted)} eventos que no existían y se agregaron.
            </p>
            <p>
              <span className="font-semibold text-slate-700">Actualizadas:</span>{" "}
              {numberFormatter.format(lastSyncInfo.updated)} eventos existentes que tenían cambios.
            </p>
            <p>
              <span className="font-semibold text-slate-700">Omitidas:</span>{" "}
              {numberFormatter.format(lastSyncInfo.skipped)} eventos sin cambios desde la última sincronización.
            </p>
            <p>
              <span className="font-semibold text-slate-700">Filtradas:</span>{" "}
              {numberFormatter.format(lastSyncInfo.excluded)} eventos descartados por coincidencias con las reglas de
              exclusión (palabras clave configuradas).
            </p>
          </div>
          <br />
          <span className="text-xs text-slate-500">
            Ejecutado: {dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY HH:mm")}
            {lastSyncInfo.logId ? (
              <>
                {" • "}
                <Link to="/calendar/history" className="underline">
                  Ver historial
                </Link>
              </>
            ) : null}
          </span>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos en el rango</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.events)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días con eventos</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.days)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto esperado</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(totals.amountExpected)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto pagado</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(totals.amountPaid)}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mapa de calor mensual</h2>
          <span className="text-[11px] text-slate-500">Vista rápida de actividad reciente</span>
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

      <section className="grid gap-4 lg:grid-cols-2">
        <AggregationCard title="Eventos por año" rows={aggregationRows.byYear} />
        <AggregationCard title="Eventos por mes" rows={aggregationRows.byMonth} />
        <AggregationCard title="Eventos por semana" rows={aggregationRows.byWeek} />
        <AggregationCard title="Eventos por día de la semana" rows={aggregationRows.byWeekday} />
        <AggregationCard title="Top días por cantidad" rows={aggregationRows.topDates} />
      </section>
    </section>
  );
}

export default CalendarSummaryPage;
