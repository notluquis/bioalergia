import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { ChevronDown } from "lucide-react";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
import { cn } from "@/lib/utils";
import { today } from "@/lib/dates";
import { MultiSelectFilter, type MultiSelectOption } from "@/features/calendar/components/MultiSelectFilter";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarEventDetail, CalendarDayEvents } from "@/features/calendar/types";
import { numberFormatter, currencyFormatter } from "@/lib/format";
import { PAGE_CONTAINER, TITLE_LG, SPACE_Y_TIGHT } from "@/lib/styles";

dayjs.locale("es");
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

const formatEventTime = (event: CalendarEventDetail) => {
  if (event.startDateTime) {
    const start = dayjs(event.startDateTime);
    const end = event.endDateTime ? dayjs(event.endDateTime) : null;
    return end ? `${start.format("HH:mm")} – ${end.format("HH:mm")}` : start.format("HH:mm");
  }
  if (event.startDate) return "Todo el día";
  return "Sin horario";
};

interface DaySectionProps {
  entry: CalendarDayEvents;
  defaultOpen?: boolean;
}

function DaySection({ entry, defaultOpen = false }: DaySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-base-300 bg-base-100 text-base-content rounded-2xl border text-sm shadow-sm transition-all hover:shadow-md">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="focus:ring-primary/20 flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-left font-semibold outline-none focus:ring-2 focus:ring-inset"
      >
        <span className="text-primary flex items-center gap-2">
          <ChevronDown
            className={cn("h-5 w-5 transition-transform duration-300", isOpen ? "rotate-180" : "rotate-0")}
          />
          {dayjs(entry.date).format("dddd DD MMM YYYY")}
        </span>
        <span className="text-base-content/60 flex flex-wrap items-center gap-2 text-xs">
          <span>
            {numberFormatter.format(entry.total)} evento{entry.total === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline">·</span>
          <span>Esperado {currencyFormatter.format(entry.amountExpected ?? 0)}</span>
          <span className="hidden sm:inline">·</span>
          <span>Pagado {currencyFormatter.format(entry.amountPaid ?? 0)}</span>
        </span>
      </button>

      <SmoothCollapse isOpen={isOpen}>
        <div className="space-y-3 px-4 pb-4">
          <div className="bg-base-200 h-px w-full" />
          {entry.events.map((event) => {
            const isSubcutaneous = event.category === "Tratamiento subcutáneo";
            const detailEntries = [
              { label: "Estado", value: event.status },
              { label: "Transparencia", value: event.transparency },
              { label: "Visibilidad", value: event.visibility },
              { label: "Color", value: event.colorId },
              { label: "Zona horaria", value: event.startTimeZone ?? event.endTimeZone },
              {
                label: "Monto esperado",
                value: event.amountExpected != null ? currencyFormatter.format(event.amountExpected) : null,
              },
              {
                label: "Monto pagado",
                value: event.amountPaid != null ? currencyFormatter.format(event.amountPaid) : null,
              },
              {
                label: "Asistencia",
                value: event.attended == null ? null : event.attended ? "Asistió" : "No asistió",
              },
            ];

            if (isSubcutaneous && event.dosage) {
              detailEntries.push({ label: "Dosis", value: event.dosage });
            }

            detailEntries.push(
              {
                label: "Creado",
                value: event.eventCreatedAt ? dayjs(event.eventCreatedAt).format("DD MMM YYYY HH:mm") : null,
              },
              {
                label: "Actualizado",
                value: event.eventUpdatedAt ? dayjs(event.eventUpdatedAt).format("DD MMM YYYY HH:mm") : null,
              }
            );

            return (
              <article
                key={event.eventId}
                className="border-base-300 bg-base-100 text-base-content hover:bg-base-200/30 rounded-lg border p-3 text-sm transition-colors"
              >
                {/* Header: Title + Time + Tags */}
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <h3 className="text-base-content truncate font-semibold">
                      {event.summary?.trim() || "(Sin título)"}
                    </h3>
                    <span className="text-secondary/80 text-xs font-medium whitespace-nowrap">
                      {formatEventTime(event)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    {event.category && (
                      <span className="bg-secondary/15 text-secondary rounded-full px-2 py-0.5 font-medium">
                        {event.category}
                      </span>
                    )}
                    {isSubcutaneous && event.treatmentStage && (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                        {event.treatmentStage}
                      </span>
                    )}
                    {isSubcutaneous && event.dosage && (
                      <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 font-medium">
                        {event.dosage}
                      </span>
                    )}
                  </div>
                </header>

                {/* Compact details row */}
                <div className="text-base-content/60 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {event.amountExpected != null && (
                    <span>
                      <span className="text-base-content font-medium">Esperado:</span>{" "}
                      {currencyFormatter.format(event.amountExpected)}
                    </span>
                  )}
                  {event.amountPaid != null && (
                    <span>
                      <span className="text-base-content font-medium">Pagado:</span>{" "}
                      {currencyFormatter.format(event.amountPaid)}
                    </span>
                  )}
                  {event.attended != null && (
                    <span className={event.attended ? "text-success" : "text-error"}>
                      {event.attended ? "✓ Asistió" : "✗ No asistió"}
                    </span>
                  )}
                  {event.status && event.status !== "confirmed" && <span className="text-warning">{event.status}</span>}
                </div>

                {/* Description (collapsed for long text) */}
                {event.description && (
                  <details className="mt-2 text-xs">
                    <summary className="text-primary cursor-pointer font-medium">Ver descripción</summary>
                    <p className="text-base-content/80 mt-1 text-xs whitespace-pre-wrap">{event.description}</p>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      </SmoothCollapse>
    </div>
  );
}

function CalendarDailyPage() {
  const {
    filters,
    daily,
    loading,
    error,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const totals = useMemo(
    () => ({
      days: daily?.totals.days ?? 0,
      events: daily?.totals.events ?? 0,
      amountExpected: daily?.totals.amountExpected ?? 0,
      amountPaid: daily?.totals.amountPaid ?? 0,
    }),
    [daily?.totals.amountExpected, daily?.totals.amountPaid, daily?.totals.days, daily?.totals.events]
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

  const handleMaxDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(parsed)) {
      updateFilters("maxDays", 1);
      return;
    }
    const bounded = Math.min(Math.max(parsed, 1), 365);
    updateFilters("maxDays", bounded);
  };

  const todayKey = today();
  const tomorrowKey = dayjs().add(1, "day").format("YYYY-MM-DD");

  const todayEntry = daily?.days.find((day) => day.date === todayKey) ?? null;
  const tomorrowEntry = daily?.days.find((day) => day.date === tomorrowKey) ?? null;

  const usedDates = new Set<string>();
  if (todayEntry) usedDates.add(todayEntry.date);
  if (tomorrowEntry) usedDates.add(tomorrowEntry.date);

  const pastDays = (daily?.days ?? [])
    .filter((day) => !usedDates.has(day.date) && dayjs(day.date).isBefore(dayjs(todayKey)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const futureBeyond = (daily?.days ?? [])
    .filter((day) => !usedDates.has(day.date) && dayjs(day.date).isAfter(dayjs(tomorrowKey)))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <section className={PAGE_CONTAINER}>
      <header className={SPACE_Y_TIGHT}>
        <h1 className={TITLE_LG}>Detalle diario</h1>
        <p className="text-base-content/70 text-sm">Revisa el detalle de cada jornada con los eventos sincronizados.</p>
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
          enterKeyHint="search"
        />
        <Input
          label="Días a listar"
          type="number"
          min={1}
          max={120}
          value={filters.maxDays}
          onChange={handleMaxDaysChange}
          inputMode="numeric"
        />
        <div className="flex items-end gap-2 md:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Actualizando..." : "Aplicar filtros"}
          </Button>
          <Button type="button" variant="secondary" onClick={resetFilters} disabled={loading}>
            Restablecer
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {(totals.events > 0 || totals.days > 0) && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm transition-transform hover:scale-[1.01]">
            <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Días listados</p>
            <p className="text-primary mt-2 text-2xl font-semibold">{numberFormatter.format(totals.days)}</p>
          </div>
          <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm transition-transform hover:scale-[1.01]">
            <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Eventos listados</p>
            <p className="text-primary mt-2 text-2xl font-semibold">{numberFormatter.format(totals.events)}</p>
          </div>
          <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm transition-transform hover:scale-[1.01]">
            <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Monto esperado</p>
            <p className="text-primary mt-2 text-2xl font-semibold">
              {currencyFormatter.format(totals.amountExpected)}
            </p>
          </div>
          <div className="border-base-300 bg-base-100 rounded-2xl border p-4 text-sm shadow-sm transition-transform hover:scale-[1.01]">
            <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Monto pagado</p>
            <p className="text-primary mt-2 text-2xl font-semibold">{currencyFormatter.format(totals.amountPaid)}</p>
          </div>
        </section>
      )}

      {loading && <CalendarSkeleton days={3} />}
      {!loading && daily && daily.days.length === 0 && (
        <Alert variant="warning">No se encontraron eventos con los filtros seleccionados.</Alert>
      )}

      {!loading && (
        <div className="space-y-6">
          {todayEntry && (
            <section className="space-y-2">
              <h2 className="text-base-content/80 pl-2 text-sm font-semibold tracking-wide uppercase">Hoy</h2>
              <DaySection entry={todayEntry} defaultOpen={true} />
            </section>
          )}

          {tomorrowEntry && (
            <section className="space-y-2">
              <h2 className="text-base-content/80 pl-2 text-sm font-semibold tracking-wide uppercase">Mañana</h2>
              <DaySection entry={tomorrowEntry} />
            </section>
          )}

          {futureBeyond.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base-content/80 pl-2 text-sm font-semibold tracking-wide uppercase">Próximos días</h2>
              <div className="space-y-3">
                {futureBeyond.map((entry) => (
                  <DaySection key={entry.date} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {pastDays.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base-content/80 pl-2 text-sm font-semibold tracking-wide uppercase">
                Días anteriores
              </h2>
              <div className="space-y-3">
                {pastDays.map((entry) => (
                  <DaySection key={entry.date} entry={entry} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

export default CalendarDailyPage;
