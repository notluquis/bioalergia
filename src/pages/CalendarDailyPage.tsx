import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";

import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type { CalendarEventDetail } from "../features/calendar/types";

dayjs.locale("es");

const numberFormatter = new Intl.NumberFormat("es-CL");
const NULL_EVENT_TYPE_VALUE = "__NULL__";

const formatEventTime = (event: CalendarEventDetail) => {
  if (event.startDateTime) {
    const start = dayjs(event.startDateTime);
    const end = event.endDateTime ? dayjs(event.endDateTime) : null;
    return end ? `${start.format("HH:mm")} – ${end.format("HH:mm")}` : start.format("HH:mm");
  }
  if (event.startDate) return "Todo el día";
  return "Sin horario";
};

function CalendarDailyPage() {
  const {
    filters,
    daily,
    loading,
    error,
    availableCalendars,
    availableEventTypes,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const totals = useMemo(() => ({
    days: daily?.totals.days ?? 0,
    events: daily?.totals.events ?? 0,
  }), [daily?.totals.days, daily?.totals.events]);

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

  const handleMaxDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(parsed)) {
      updateFilters("maxDays", 1);
      return;
    }
    const bounded = Math.min(Math.max(parsed, 1), 120);
    updateFilters("maxDays", bounded);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Detalle diario de eventos</h1>
        <p className="text-sm text-slate-600">
          Revisa el detalle de cada jornada con los eventos sincronizados. Los días aparecen colapsados para que puedas
          expandir solo los que te interesen.
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
        <div className="space-y-2 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Calendarios</span>
          <div className="muted-scrollbar max-h-36 space-y-2 overflow-y-auto rounded-xl border border-white/60 bg-white/70 p-3">
            {availableCalendars.length === 0 && <p className="text-[11px] text-slate-400">Sin datos disponibles</p>}
            {availableCalendars.map((entry) => (
              <label key={entry.calendarId} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filters.calendarIds.includes(entry.calendarId)}
                  onChange={() => toggleCalendar(entry.calendarId)}
                />
                <span>{`${entry.calendarId} · ${numberFormatter.format(entry.total)}`}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Tipos de evento</span>
          <div className="muted-scrollbar max-h-36 space-y-2 overflow-y-auto rounded-xl border border-white/60 bg-white/70 p-3">
            {availableEventTypes.length === 0 && <p className="text-[11px] text-slate-400">Sin datos disponibles</p>}
            {availableEventTypes.map((entry) => {
              const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
              const label = entry.eventType ?? "Sin tipo";
              return (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={filters.eventTypes.includes(value)}
                    onChange={() => toggleEventType(value)}
                  />
                  <span>{`${label} · ${numberFormatter.format(entry.total)}`}</span>
                </label>
              );
            })}
          </div>
        </div>
        <Input
          label="Buscar"
          placeholder="Título o descripción"
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
          <Button type="button" variant="secondary" onClick={resetFilters} disabled={loading}>
            Reestablecer
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días listados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.days)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos listados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.events)}
          </p>
        </div>
      </section>

      {loading && <p className="text-sm text-slate-500">Cargando eventos...</p>}
      {!loading && daily && daily.days.length === 0 && (
        <Alert variant="warning">No se encontraron eventos con los filtros seleccionados.</Alert>
      )}

      <div className="space-y-4">
        {daily?.days.map((day) => (
          <details
            key={day.date}
            className="rounded-2xl border border-white/60 bg-white/85 p-4 text-sm text-slate-700 shadow-sm"
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 font-semibold text-[var(--brand-primary)]">
              <span>{dayjs(day.date).format("dddd DD MMM YYYY")}</span>
              <span className="text-xs text-slate-500">
                {numberFormatter.format(day.total)} evento{day.total === 1 ? "" : "s"}
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              {day.events.map((event) => (
                <article
                  key={event.eventId}
                  className="rounded-2xl border border-white/50 bg-white/95 p-4 text-sm text-slate-700 shadow-inner"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-semibold text-slate-800">
                        {event.summary?.trim() || "(Sin título)"}
                      </h3>
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-secondary)]/70">
                        {formatEventTime(event)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                        {event.calendarId}
                      </span>
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
                      {
                        label: "Creado",
                        value: event.eventCreatedAt ? dayjs(event.eventCreatedAt).format("DD MMM YYYY HH:mm") : null,
                      },
                      {
                        label: "Actualizado",
                        value: event.eventUpdatedAt ? dayjs(event.eventUpdatedAt).format("DD MMM YYYY HH:mm") : null,
                      },
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
          </details>
        ))}
      </div>
    </section>
  );
}

export default CalendarDailyPage;
