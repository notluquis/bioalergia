import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LOADING_SPINNER_SM, PAGE_CONTAINER } from "@/lib/styles";
import { MultiSelectFilter, type MultiSelectOption } from "@/features/calendar/components/MultiSelectFilter";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarAggregateByDate } from "@/features/calendar/types";
import { Link } from "react-router-dom";
import { numberFormatter, currencyFormatter } from "@/lib/format";

dayjs.locale("es");
dayjs.extend(isoWeek);

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
    <section className="border-base-300 bg-base-100 space-y-3 rounded-2xl border p-5 text-sm shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-secondary text-base font-semibold">{title}</h3>
        <span className="bg-base-200 text-base-content/80 rounded-full px-3 py-1 text-xs font-semibold">
          {rows.length}
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="text-base-content/60 text-xs">Sin datos para los filtros aplicados.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={`${row.label}-${row.hint ?? ""}`} className="flex items-baseline justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-base-content text-sm font-medium">{row.label}</span>
                {row.hint && <span className="text-base-content/50 text-xs">{row.hint}</span>}
              </div>
              <span className="text-primary text-sm font-semibold">{numberFormatter.format(row.value)}</span>
              {(row.amountExpected != null || row.amountPaid != null) && (
                <span className="text-base-content/60 text-xs">
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

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm">
      <p className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-primary mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-base-content/60 text-xs">{hint}</p>}
    </div>
  );
}

function HighlightCard({
  title,
  primary,
  secondary,
  caption,
}: {
  title: string;
  primary: string;
  secondary?: string;
  caption?: string;
}) {
  return (
    <div className="border-base-300 bg-base-100/80 rounded-xl border p-4">
      <p className="text-secondary text-xs font-semibold tracking-wide uppercase">{title}</p>
      <p className="text-base-content mt-1 text-lg font-semibold">{primary}</p>
      {secondary && <p className="text-primary mt-1 text-sm font-semibold">{secondary}</p>}
      {caption && <p className="text-base-content/60 text-xs">{caption}</p>}
    </div>
  );
}

function formatMonthLabel(entry: { year: number; month: number }) {
  const monthIndex = Math.max(1, Math.min(12, entry.month));
  const monthName = dayjs()
    .month(monthIndex - 1)
    .format("MMM");
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
    syncProgress,
    syncDurationMs,
    syncNow,
    updateFilters,
    applyFilters,
    resetFilters,
    hasRunningSyncFromOtherSource,
  } = useCalendarEvents();

  const isSyncing = syncing || hasRunningSyncFromOtherSource;

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

  const setMonthOffset = (offsetMonths: number) => {
    const targetDate = dayjs().add(offsetMonths, "month");
    updateFilters("from", targetDate.startOf("month").format("YYYY-MM-DD"));
    updateFilters("to", targetDate.endOf("month").format("YYYY-MM-DD"));
    applyFilters();
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

    const weekBuckets = new Map<number, Map<number, { events: number; amountExpected: number; amountPaid: number }>>();
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
        const monthName = dayjs()
          .month(month - 1)
          .format("MMMM");
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

  const eventTypeOptions: MultiSelectOption[] = useMemo(
    () =>
      availableEventTypes.map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableEventTypes]
  );

  const highlights = useMemo(() => {
    if (!summary) {
      return { month: null, week: null, day: aggregationRows.topDates[0] ?? null, category: null };
    }
    const currentYear = dayjs().year();
    const month =
      summary.aggregates.byMonth.filter((entry) => entry.year === currentYear).sort((a, b) => b.total - a.total)[0] ??
      null;
    const week =
      aggregationRows.byWeek.slice().sort((a, b) => b.value - a.value)[0] ??
      aggregationRows.topDates.map((entry) => ({
        ...entry,
        label: `Semana de ${entry.label}`,
      }))[0] ??
      null;
    const category =
      summary.available.categories.slice().sort((a, b) => b.total - a.total)[0] ??
      (summary.available.categories.length ? summary.available.categories[0] : null);
    const day = aggregationRows.topDates[0] ?? null;

    return { month, week, day, category };
  }, [aggregationRows.byWeek, aggregationRows.topDates, summary]);

  return (
    <section className={PAGE_CONTAINER}>
      <header className="border-base-300 bg-base-100/80 flex flex-col gap-3 rounded-2xl border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-primary text-2xl font-bold">Resumen de calendario</h1>
          <p className="text-base-content/70 text-sm">
            Mira el pulso de tus eventos y cobros en un vistazo. Usa accesos rápidos para saltar de mes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={syncNow} disabled={isSyncing}>
            {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
          <Link
            to="/calendar/classify"
            className="text-secondary text-xs font-semibold tracking-wide uppercase underline"
          >
            Clasificar pendientes
          </Link>
        </div>
      </header>

      <section className="grid items-start gap-4 lg:grid-cols-3">
        <div className="bg-base-100 border-base-300 rounded-2xl border p-5 shadow-sm">
          <p className="text-base-content/80 mb-3 text-xs font-semibold tracking-wide uppercase">Accesos rápidos</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMonthOffset(-2)} disabled={loading}>
              {dayjs().subtract(2, "month").format("MMM YYYY")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMonthOffset(-1)} disabled={loading}>
              {dayjs().subtract(1, "month").format("MMM YYYY")}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setMonthOffset(0)} disabled={loading}>
              {dayjs().format("MMM YYYY")} (Actual)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMonthOffset(1)} disabled={loading}>
              {dayjs().add(1, "month").format("MMM YYYY")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMonthOffset(2)} disabled={loading}>
              {dayjs().add(2, "month").format("MMM YYYY")}
            </Button>
          </div>
        </div>

        <div className="bg-base-100 border-base-300 rounded-2xl border p-5 shadow-sm">
          <p className="text-base-content/80 mb-2 text-xs font-semibold tracking-wide uppercase">Sync</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isSyncing && <span className={LOADING_SPINNER_SM} aria-label="Sincronizando" />}
              <p className="text-base-content text-sm font-semibold">
                {isSyncing ? "Sincronizando calendario..." : "Último estado listo"}
              </p>
            </div>
            {lastSyncInfo && !syncing && (
              <p className="text-base-content/70 text-xs">
                Nuevas {numberFormatter.format(lastSyncInfo.inserted)} · Actualizadas{" "}
                {numberFormatter.format(lastSyncInfo.updated)} · Filtradas{" "}
                {numberFormatter.format(lastSyncInfo.excluded)} ({dayjs(lastSyncInfo.fetchedAt).format("DD MMM HH:mm")})
                {lastSyncInfo.logId && (
                  <>
                    {" · "}
                    <Link to="/calendar/history" className="underline">
                      Ver historial
                    </Link>
                  </>
                )}
              </p>
            )}
            {syncError && <p className="text-error text-xs">{syncError}</p>}
          </div>
        </div>

        <div className="bg-base-100 border-base-300 rounded-2xl border p-5 shadow-sm">
          <p className="text-base-content/80 mb-2 text-xs font-semibold tracking-wide uppercase">Filtros rápidos</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={applyFilters} disabled={loading}>
              Aplicar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={loading || !isDirty}
              onClick={() => {
                resetFilters();
              }}
            >
              Reestablecer
            </Button>
          </div>
          <p className="text-base-content/60 mt-2 text-xs">
            Ajusta fechas o selecciones abajo y aplica desde aquí para refrescar.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Eventos en el rango" value={numberFormatter.format(totals.events)} />
        <StatCard label="Días con eventos" value={numberFormatter.format(totals.days)} />
        <StatCard label="Monto esperado" value={currencyFormatter.format(totals.amountExpected)} />
        <StatCard label="Monto pagado" value={currencyFormatter.format(totals.amountPaid)} />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-3">
        <form
          className="border-primary/15 bg-base-100 text-base-content grid grid-cols-1 gap-4 rounded-2xl border p-6 text-xs shadow-sm sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3 xl:grid-cols-4"
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
          <div className="col-span-full flex flex-wrap items-end gap-2">
            <Button type="submit" disabled={loading} className="min-w-35">
              {loading ? "Actualizando..." : "Aplicar filtros"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !isDirty}
              onClick={() => {
                resetFilters();
              }}
              className="min-w-35"
            >
              Reestablecer
            </Button>
          </div>
        </form>

        <div className="bg-base-100 border-base-300 rounded-2xl border p-5 shadow-sm">
          <p className="text-base-content/80 mb-3 text-xs font-semibold tracking-wide uppercase">Highlights rápidos</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <HighlightCard
              title="Mes con más eventos"
              primary={highlights.month ? `${formatMonthLabel(highlights.month).hint} ${highlights.month.year}` : "—"}
              secondary={
                highlights.month ? `${numberFormatter.format(highlights.month.total)} eventos` : "Sin datos en rango"
              }
            />
            <HighlightCard
              title="Semana más activa"
              primary={highlights.week?.label ?? "—"}
              secondary={highlights.week ? `${numberFormatter.format(highlights.week.value)} eventos` : undefined}
            />
            <HighlightCard
              title="Día destacado"
              primary={highlights.day ? highlights.day.label : "—"}
              secondary={highlights.day ? `${numberFormatter.format(highlights.day.value)} eventos` : undefined}
            />
            <HighlightCard
              title="Clasificación más frecuente"
              primary={highlights.category?.category ?? "Sin clasificación"}
              secondary={
                highlights.category ? `${numberFormatter.format(highlights.category.total)} eventos` : "Sin datos"
              }
            />
          </div>
        </div>

        <SyncProgressPanel
          syncing={syncing}
          syncError={syncError}
          syncProgress={syncProgress}
          syncDurationMs={syncDurationMs}
          lastSyncInfo={lastSyncInfo ?? undefined}
          showLastSyncInfo
        />
      </section>

      {error && <Alert variant="error">{error}</Alert>}

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
