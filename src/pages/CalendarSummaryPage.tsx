import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LOADING_SPINNER_SM } from "@/lib/styles";
import { MultiSelectFilter, type MultiSelectOption } from "@/features/calendar/components/MultiSelectFilter";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarAggregateByDate } from "@/features/calendar/types";
import { Link } from "react-router-dom";
import { numberFormatter, currencyFormatter } from "@/lib/format";
import { PAGE_CONTAINER } from "@/lib/styles";

dayjs.locale("es");
dayjs.extend(isoWeek);

const weekdayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";
type SyncProgressStatus = "pending" | "in_progress" | "completed" | "error";

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

  return (
    <section className={PAGE_CONTAINER}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-primary text-2xl font-bold">Eventos de calendario</h1>
          <p className="text-base-content/70 text-sm">
            Visualiza los eventos sincronizados desde Google Calendar y analiza su distribución por periodos.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button onClick={syncNow} disabled={syncing} className="self-start sm:self-auto">
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
          <Link
            to="/calendar/classify"
            className="text-secondary text-xs font-semibold tracking-wide uppercase underline"
          >
            Clasificar pendientes
          </Link>
        </div>
      </header>

      <form
        className="border-primary/15 bg-base-100 text-base-content grid gap-4 rounded-2xl border p-6 text-xs shadow-sm md:grid-cols-6"
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

      {error && <Alert variant="error">{error}</Alert>}

      {(() => {
        const hasProgress = syncProgress.length > 0;
        if (!syncing && !syncError && !hasProgress) {
          return null;
        }

        const title = syncError
          ? "Error al sincronizar"
          : syncing
            ? "Sincronizando calendario"
            : "Sincronización completada";

        const statusLabelMap: Record<SyncProgressStatus, string> = {
          pending: "Pendiente",
          in_progress: "En progreso",
          completed: "Listo",
          error: "Error",
        };

        const badgeClass: Record<SyncProgressStatus, string> = {
          pending: "bg-base-200 text-base-content/70",
          in_progress: "bg-primary/15 text-primary",
          completed: "bg-secondary/20 text-secondary",
          error: "bg-error/20 text-error",
        };

        const dotClass: Record<SyncProgressStatus, string> = {
          pending: "bg-base-300",
          in_progress: "bg-primary animate-pulse",
          completed: "bg-secondary",
          error: "bg-error",
        };

        const detailLabels: Record<string, string> = {
          calendars: "Calendarios",
          events: "Eventos",
          inserted: "Nuevas",
          updated: "Actualizadas",
          skipped: "Omitidas",
          excluded: "Excluidas",
          stored: "Snapshot",
        };

        const formatDuration = (value: number) => {
          if (!value) return null;
          if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
          return `${Math.round(value)} ms`;
        };

        const formatDetails = (details: Record<string, unknown>) => {
          const parts: string[] = [];
          Object.entries(details ?? {}).forEach(([key, rawValue]) => {
            if (rawValue == null) return;
            const label = detailLabels[key] ?? key;
            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
              parts.push(`${label}: ${numberFormatter.format(rawValue)}`);
            } else if (typeof rawValue === "boolean") {
              parts.push(`${label}: ${rawValue ? "Sí" : "No"}`);
            } else if (typeof rawValue === "string" && rawValue.length) {
              parts.push(`${label}: ${rawValue}`);
            }
          });
          return parts.join(" · ");
        };

        return (
          <section className="surface-elevated rounded-2xl p-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-base-200/60 rounded-xl px-3 py-2">
                  <p className="text-base-content text-sm font-semibold">{title}</p>
                  <p className="text-base-content/60 text-xs">
                    {syncing
                      ? "Consultando eventos y actualizando la base."
                      : syncError
                        ? "Vuelve a intentar más tarde."
                        : "Última ejecución completada correctamente."}
                  </p>
                </div>
                {syncing && <span className={LOADING_SPINNER_SM} aria-label="Sincronizando" />}
                {syncError && <span className="text-error text-xs font-semibold">Revisa los detalles abajo.</span>}
                {!syncing && syncDurationMs != null && !syncError && (
                  <span className="bg-base-200 text-base-content/70 rounded-full px-3 py-1 text-xs">
                    Duración total: {formatDuration(syncDurationMs)}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <span className="bg-base-200/80 text-base-content/70 rounded-full px-3 py-1 text-xs">
                  {dayjs().format("DD MMM YYYY · HH:mm")}
                </span>
                <Button type="button" variant="secondary" size="sm" disabled={syncing} onClick={() => syncNow()}>
                  {syncing ? "Sincronizando..." : "Sincronizar ahora"}
                </Button>
              </div>
            </div>

            {lastSyncInfo && !syncing && !syncError && (
              <div className="text-base-content mt-4 grid gap-2 text-xs md:grid-cols-2">
                <p>
                  <span className="text-base-content font-semibold">Nuevas:</span>{" "}
                  {numberFormatter.format(lastSyncInfo.inserted)}
                </p>
                <p>
                  <span className="text-base-content font-semibold">Actualizadas:</span>{" "}
                  {numberFormatter.format(lastSyncInfo.updated)}
                </p>
                <p>
                  <span className="text-base-content font-semibold">Omitidas:</span>{" "}
                  {numberFormatter.format(lastSyncInfo.skipped)}
                </p>
                <p>
                  <span className="text-base-content font-semibold">Filtradas:</span>{" "}
                  {numberFormatter.format(lastSyncInfo.excluded)}
                </p>
                <p className="text-base-content/60 md:col-span-2">
                  Ejecutado el {dayjs(lastSyncInfo.fetchedAt).format("DD MMM YYYY HH:mm")}
                  {lastSyncInfo.logId && (
                    <>
                      {" · "}
                      <Link to="/calendar/history" className="underline">
                        Ver historial
                      </Link>
                    </>
                  )}
                </p>
              </div>
            )}

            {syncError && <p className="text-error mt-3 text-xs">{syncError}</p>}

            {syncProgress.length > 0 && (
              <ul className="mt-4 space-y-3">
                {syncProgress.map((step) => {
                  const status = statusLabelMap[step.status];
                  const details = formatDetails(step.details);
                  const duration = formatDuration(step.durationMs);
                  return (
                    <li key={step.id} className="border-base-300/60 bg-base-100/70 rounded-2xl border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${dotClass[step.status]}`} />
                          <p className="text-base-content text-sm font-semibold">{step.label}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass[step.status]}`}>
                          {status}
                        </span>
                      </div>
                      {(details || duration) && (
                        <p className="text-base-content/60 mt-2 text-xs">
                          {details}
                          {details && duration ? " · " : ""}
                          {duration ? `Tiempo: ${duration}` : ""}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })()}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm">
          <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Eventos en el rango</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{numberFormatter.format(totals.events)}</p>
        </div>
        <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm">
          <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Días con eventos</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{numberFormatter.format(totals.days)}</p>
        </div>
        <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm">
          <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Monto esperado</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{currencyFormatter.format(totals.amountExpected)}</p>
        </div>
        <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm">
          <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Monto pagado</p>
          <p className="text-primary mt-2 text-2xl font-semibold">{currencyFormatter.format(totals.amountPaid)}</p>
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
