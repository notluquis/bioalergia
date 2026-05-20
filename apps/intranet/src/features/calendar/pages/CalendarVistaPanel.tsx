import { Button, Card, Skeleton } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, CalendarRange, Flame } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";

import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import type {
  CalendarDayEvents,
  CalendarEventDetail,
  CalendarSearchParams,
} from "@/features/calendar/types";

import "./CalendarVistaPanel.css";

// Lazy-load FullCalendar + its plugins so the chunk only enters the
// network when this tab is actually mounted (the parent already
// gates mount via `useLazyTabs`; this keeps the host bundle small
// even when the tab is the default landing key).
const CalendarGrid = lazy(async () => {
  const [{ default: FullCalendar }, { default: dayGridPlugin }, { default: timeGridPlugin }] =
    await Promise.all([
      import("@fullcalendar/react"),
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
    ]);

  return {
    default: function CalendarGridImpl({ events }: { events: FullCalendarEvent[] }) {
      return (
        <FullCalendar
          contentHeight="auto"
          dayMaxEvents={3}
          editable={false}
          eventDisplay="block"
          // FC default event color #3788d8 + white = 3.69 contrast (fails WCAG AA).
          // CSS-var override loses to FC's runtime-injected styles, so set the
          // color via these props — FC applies them inline and they win.
          eventBackgroundColor="var(--color-primary)"
          eventBorderColor="var(--color-primary)"
          events={events}
          eventTextColor="var(--color-primary-foreground)"
          eventTimeFormat={{
            hour: "2-digit",
            hour12: false,
            meridiem: false,
            minute: "2-digit",
          }}
          headerToolbar={{
            center: "title",
            left: "prev,next today",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="auto"
          initialView="timeGridWeek"
          locale="es"
          nowIndicator
          plugins={[dayGridPlugin, timeGridPlugin]}
          selectable={false}
          slotDuration="00:30:00"
          slotMaxTime="22:00:00"
          slotMinTime="07:00:00"
          // FC renders prev/next chevrons as <span role="img"> with no alt →
          // axe role-img-alt. They're decorative (the button carries the label),
          // so hide them from a11y once the toolbar mounts.
          viewDidMount={() => {
            for (const icon of document.querySelectorAll(".calendar-vista-wrapper .fc-icon")) {
              icon.setAttribute("aria-hidden", "true");
            }
          }}
        />
      );
    },
  };
});

interface FullCalendarEvent {
  allDay: boolean;
  classNames: string[];
  end?: string;
  id: string;
  start: string;
  title: string;
}

// Empty search object — the destination routes' `validateSearch`
// applies all defaults (from/to range, filters). Typed as
// `CalendarSearchParams` so the `<Link>` / `navigate({ search })`
// contract is satisfied without each field being enumerated here.
const emptyCalendarSearch: CalendarSearchParams = {} as CalendarSearchParams;

function toFullCalendarEvents(days: CalendarDayEvents[] | undefined): FullCalendarEvent[] {
  if (!days?.length) {
    return [];
  }
  const out: FullCalendarEvent[] = [];
  for (const day of days) {
    for (const event of day.events) {
      const start = pickStart(event);
      if (!start) {
        continue;
      }
      const end = event.endDateTime ?? null;
      out.push({
        allDay: !event.startDateTime,
        classNames: ["calendar-vista-event"],
        end: end ?? undefined,
        id: `${event.calendarId}:${event.eventId}`,
        start,
        title: event.summary ?? event.patientName ?? "Evento",
      });
    }
  }
  return out;
}

function pickStart(event: CalendarEventDetail): null | string {
  if (event.startDateTime) {
    return event.startDateTime;
  }
  if (event.startDate) {
    return event.startDate;
  }
  if (event.eventDateTime) {
    return event.eventDateTime;
  }
  if (event.eventDate) {
    return event.eventDate;
  }
  return null;
}

/**
 * `/calendar?tab=vista` panel — default tab.
 *
 * Renders a real FullCalendar timegrid (week default, with month +
 * day view switchers). Events come from the shared `useCalendarEvents`
 * hook, which pulls the daily payload through `calendarQueries.daily`
 * using the user's `calendarSyncStart` / `calendarSyncLookaheadDays`
 * settings as the default window (the `/calendar` route does not
 * supply `from/to` search params, so the defaults apply).
 *
 * The deeper clinical views (agenda / day / heatmap) remain available
 * as nav cards below the grid — they expose filter UX (per-calendar,
 * per-series, RUT search) that this lightweight surface intentionally
 * omits.
 */
export function CalendarVistaPanel() {
  const navigate = useNavigate();
  const { daily, loading, error } = useCalendarEvents();

  const fcEvents = useMemo(() => toFullCalendarEvents(daily?.days), [daily?.days]);

  return (
    <section className="space-y-4" data-testid="calendar-vista-panel">
      <div className="calendar-vista-wrapper" data-testid="calendar-vista-grid">
        {error ? (
          <Card variant="secondary">
            <Card.Content className="p-4 text-danger text-sm">
              No se pudieron cargar los eventos del calendario.
            </Card.Content>
          </Card>
        ) : null}
        {loading && !daily ? (
          <Skeleton aria-label="Cargando calendario" className="h-96 w-full rounded-xl" />
        ) : (
          <Suspense
            fallback={
              <Skeleton aria-label="Cargando calendario" className="h-96 w-full rounded-xl" />
            }
          >
            <CalendarGrid events={fcEvents} />
          </Suspense>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card variant="secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <CalendarRange aria-hidden="true" className="mt-0.5 text-primary" size={20} />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Agenda</p>
                <p className="text-default-400 text-xs">
                  Vista por rango de fechas con filtros por calendario y serie clínica.
                </p>
              </div>
            </div>
            <Button
              onPress={() => {
                void navigate({ to: "/clinical/agenda", search: emptyCalendarSearch });
              }}
              size="sm"
              variant="outline"
            >
              Abrir agenda
            </Button>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays aria-hidden="true" className="mt-0.5 text-primary" size={20} />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Día</p>
                <p className="text-default-400 text-xs">
                  Detalle hora a hora del día seleccionado.
                </p>
              </div>
            </div>
            <Button
              onPress={() => {
                void navigate({ to: "/clinical/day", search: emptyCalendarSearch });
              }}
              size="sm"
              variant="outline"
            >
              Abrir vista diaria
            </Button>
          </Card.Content>
        </Card>
        <Card variant="secondary">
          <Card.Content className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <Flame aria-hidden="true" className="mt-0.5 text-primary" size={20} />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Mapa de calor</p>
                <p className="text-default-400 text-xs">Densidad de citas semanales/mensuales.</p>
              </div>
            </div>
            <Button
              onPress={() => {
                void navigate({ to: "/clinical/heatmap", search: emptyCalendarSearch });
              }}
              size="sm"
              variant="outline"
            >
              Abrir mapa de calor
            </Button>
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
