import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";

import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type { CalendarAggregateByDate, CalendarEventDetail } from "../features/calendar/types";

const numberFormatter = new Intl.NumberFormat("es-CL");
const weekdayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const NULL_EVENT_TYPE_VALUE = "__NULL__";

dayjs.locale("es");

type AggregationRow = {
  label: string;
  value: number;
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

function formatWeekLabel(entry: { isoYear: number; isoWeek: number }) {
  return `Semana ${entry.isoWeek.toString().padStart(2, "0")} · ${entry.isoYear}`;
}

function formatWeekdayLabel(weekday: number) {
  return weekdayLabels[weekday] ?? `Día ${weekday}`;
}

function topDates(byDate: CalendarAggregateByDate[], limit = 10): AggregationRow[] {
  return [...byDate]
    .sort((a, b) => (a.total === b.total ? (a.date < b.date ? -1 : 1) : b.total - a.total))
    .slice(0, limit)
    .map((entry) => ({
      label: dayjs(entry.date).format("DD MMM YYYY"),
      value: entry.total,
    }));
}

function formatEventTime(event: CalendarEventDetail) {
  if (event.startDateTime) {
    const start = dayjs(event.startDateTime);
    const startFormatted = start.format("HH:mm");
    if (event.endDateTime) {
      const end = dayjs(event.endDateTime);
      return `${startFormatted} – ${end.format("HH:mm")}`;
    }
    return `${startFormatted}`;
  }
  if (event.startDate) {
    return "Todo el día";
  }
  return "Sin horario";
}

function CalendarEventsPage() {
  const {
    filters,
    summary,
    daily,
    loading,
    error,
    isDirty,
    availableCalendars,
    availableEventTypes,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const totals = useMemo(() => {
    return {
      events: summary?.totals.events ?? 0,
      days: summary?.totals.days ?? 0,
      listedEvents: daily?.totals.events ?? 0,
      listedDays: daily?.totals.days ?? 0,
    };
  }, [daily?.totals.events, daily?.totals.days, summary?.totals.days, summary?.totals.events]);

  const handleCalendarChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    updateFilters("calendarIds", values);
  };

  const handleEventTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    updateFilters("eventTypes", values);
  };

  const handleMaxDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(parsed)) {
      updateFilters("maxDays", 1);
      return;
    }
    const bounded = Math.min(Math.max(parsed, 1), 120);
    updateFilters("maxDays", bounded);
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

    return {
      byYear: summary.aggregates.byYear.map((entry) => ({
        label: entry.year.toString(),
        value: entry.total,
      })),
      byMonth: summary.aggregates.byMonth.map((entry) => {
        const { label, hint } = formatMonthLabel(entry);
        return { label, value: entry.total, hint };
      }),
      byWeek: summary.aggregates.byWeek.map((entry) => ({
        label: formatWeekLabel(entry),
        value: entry.total,
      })),
      byWeekday: summary.aggregates.byWeekday.map((entry) => ({
        label: formatWeekdayLabel(entry.weekday),
        value: entry.total,
      })),
      topDates: topDates(summary.aggregates.byDate),
    };
  }, [summary]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Eventos de Calendario</h1>
        <p className="text-sm text-slate-600">
          Visualiza los eventos sincronizados desde Google Calendar, filtra por calendario, tipo o palabras clave y
          revisa los agregados por año, mes, semana y día.
        </p>
      </header>

      <form
        className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white/80 p-6 text-xs text-slate-600 shadow-sm md:grid-cols-5"
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
        <Input
          label="Calendarios"
          type="select"
          multiple
          size={Math.min(4, Math.max(availableCalendars.length, 2))}
          value={filters.calendarIds}
          onChange={handleCalendarChange}
        >
          {availableCalendars.length === 0 ? (
            <option value="" disabled>
              Sin datos
            </option>
          ) : (
            availableCalendars.map((entry) => (
              <option key={entry.calendarId} value={entry.calendarId}>
                {entry.calendarId} · {numberFormatter.format(entry.total)}
              </option>
            ))
          )}
        </Input>
        <Input
          label="Tipos de evento"
          type="select"
          multiple
          size={Math.min(4, Math.max(availableEventTypes.length, 2))}
          value={filters.eventTypes}
          onChange={handleEventTypeChange}
        >
          {availableEventTypes.length === 0 ? (
            <option value="" disabled>
              Sin datos
            </option>
          ) : (
            availableEventTypes.map((entry) => {
              const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
              const label = entry.eventType ?? "Sin tipo";
              return (
                <option key={value} value={value}>
                  {`${label} · ${numberFormatter.format(entry.total)}`}
                </option>
              );
            })
          )}
        </Input>
        <Input
          label="Buscar"
          placeholder="Titulo o descripción"
          value={filters.search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("search", event.target.value)}
        />
        <Input
          label="Días a listar"
          type="number"
          min={1}
          max={120}
          value={filters.maxDays}
          onChange={handleMaxDaysChange}
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos listados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.listedEvents)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días listados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.listedDays)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AggregationCard title="Eventos por año" rows={aggregationRows.byYear} />
        <AggregationCard title="Eventos por mes" rows={aggregationRows.byMonth} />
        <AggregationCard title="Eventos por semana" rows={aggregationRows.byWeek} />
        <AggregationCard title="Eventos por día de la semana" rows={aggregationRows.byWeekday} />
        <AggregationCard title="Top días por cantidad" rows={aggregationRows.topDates} />
      </section>

      <section className="space-y-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Lista diaria</h2>
          <p className="text-xs text-slate-500">
            Se muestran hasta {filters.maxDays} días (orden descendente). Expande cada jornada para revisar los detalles
            de los eventos sincronizados.
          </p>
        </header>

        {loading && !daily && <p className="text-sm text-slate-500">Cargando eventos...</p>}

        {!loading && daily && daily.days.length === 0 && (
          <Alert variant="warning">No se encontraron eventos con los filtros seleccionados.</Alert>
        )}

        {daily?.days.map((day) => (
          <section
            key={day.date}
            className="glass-card glass-underlay-gradient space-y-3 rounded-2xl border border-white/70 bg-white/85 p-5 text-sm shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--brand-primary)]">{dayjs(day.date).format("dddd DD MMM YYYY")}</h3>
                <p className="text-xs text-slate-500">
                  {numberFormatter.format(day.total)} evento{day.total === 1 ? "" : "s"}
                </p>
              </div>
            </header>

            <div className="space-y-3">
              {day.events.map((event) => (
                <article
                  key={event.eventId}
                  className="rounded-2xl border border-white/60 bg-white/90 p-4 text-sm text-slate-700 shadow-inner"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base font-semibold text-slate-800">
                        {event.summary?.trim() || "(Sin título)"}
                      </h4>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-secondary)]/80">
                        {formatEventTime(event)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">{event.calendarId}</span>
                      {event.eventType && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500">
                          {event.eventType}
                        </span>
                      )}
                    </div>
                  </header>

                  <dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    {[
                      { label: "Estado", value: event.status },
                      { label: "Transparencia", value: event.transparency },
                      { label: "Visibilidad", value: event.visibility },
                      { label: "Color", value: event.colorId },
                      { label: "Zona horaria", value: event.startTimeZone ?? event.endTimeZone },
                      { label: "Creado", value: event.eventCreatedAt ? dayjs(event.eventCreatedAt).format("DD MMM YYYY HH:mm") : null },
                      { label: "Actualizado", value: event.eventUpdatedAt ? dayjs(event.eventUpdatedAt).format("DD MMM YYYY HH:mm") : null },
                    ]
                      .filter((entry) => entry.value)
                      .map((entry) => (
                        <div key={entry.label} className="flex flex-col">
                          <dt className="font-semibold text-slate-600">{entry.label}</dt>
                          <dd className="text-slate-500">{entry.value}</dd>
                        </div>
                      ))}
                  </dl>

                  {event.location && (
                    <p className="mt-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">Ubicación:</span> {event.location}
                    </p>
                  )}

                  {event.hangoutLink && (
                    <p className="mt-2 text-xs">
                      <a
                        href={event.hangoutLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--brand-primary)] underline"
                      >
                        Enlace de videollamada
                      </a>
                    </p>
                  )}

                  {event.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>
                  )}

                  {event.rawEvent != null && (
                    <details className="mt-3 text-xs text-slate-500">
                      <summary className="cursor-pointer font-semibold text-[var(--brand-primary)]">Ver payload completo</summary>
                      <pre className="mt-2 max-h-64 overflow-x-auto rounded-lg bg-slate-900/90 p-3 text-[10px] text-white">
                        {JSON.stringify(event.rawEvent, null, 2)}
                      </pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </section>
  );
}

export default CalendarEventsPage;
