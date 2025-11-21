import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayjs from "dayjs";

import type { CalendarEventDetail } from "../types";

import "./ScheduleCalendar.css";

export type ScheduleCalendarProps = {
  events: CalendarEventDetail[];
  loading?: boolean;
};

type CalendarEventInput = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  extendedProps: {
    calendarId: string;
    category: string | null | undefined;
    amountExpected: number | null | undefined;
    amountPaid: number | null | undefined;
    treatmentStage: string | null | undefined;
    dosage: string | null | undefined;
    fullTitle: string;
  };
};

type EventContentArg = {
  event: {
    title: string;
    extendedProps: CalendarEventInput["extendedProps"];
  };
};

type EventDidMountArg = {
  event: {
    extendedProps: CalendarEventInput["extendedProps"];
  };
  el: HTMLElement;
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});
const TITLE_MAX_LENGTH = 42;
const MAX_DETAIL_LINES = 2;
const MINUTES_BUFFER = 30;
const SECONDS_IN_DAY = 24 * 60 * 60 - 1; // 23:59:59

function formatTitle(value: string | null | undefined) {
  if (!value) return "(Sin título)";
  const trimmed = value.trim();
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

function clampSeconds(value: number) {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(SECONDS_IN_DAY, Math.max(0, Math.floor(value)));
  return clamped;
}

function secondsToTime(value: number) {
  const clamped = clampSeconds(value);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function asFullCalendarEvents(source: CalendarEventDetail[]): CalendarEventInput[] {
  return source.map((event) => {
    const start = event.startDateTime ?? (event.startDate ? `${event.startDate}T00:00:00` : null);
    const end = event.endDateTime ?? (event.endDate ? `${event.endDate}T23:59:59` : null);
    const allDay = !event.startDateTime && !!event.startDate && !event.endDateTime;
    return {
      id: event.eventId,
      title: formatTitle(event.summary),
      start: start ?? dayjs().toISOString(),
      end: end ?? undefined,
      allDay,
      extendedProps: {
        calendarId: event.calendarId,
        category: event.category,
        amountExpected: event.amountExpected,
        amountPaid: event.amountPaid,
        treatmentStage: event.treatmentStage,
        dosage: event.dosage,
        fullTitle: event.summary?.trim() || "(Sin título)",
      },
    };
  });
}

export function ScheduleCalendar({ events, loading = false }: ScheduleCalendarProps) {
  const calendarEvents = useMemo(() => asFullCalendarEvents(events), [events]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventInput | null>(null);

  const timeBounds = useMemo(() => {
    if (!events.length) {
      return {
        slotMinTime: "06:00:00",
        slotMaxTime: "20:00:00",
      };
    }

    let minStart: dayjs.Dayjs | null = null;
    let maxEnd: dayjs.Dayjs | null = null;

    for (const event of events) {
      const start = event.startDateTime || (event.startDate ? `${event.startDate}T00:00:00` : null);
      const end = event.endDateTime || (event.endDate ? `${event.endDate}T23:59:59` : null);

      const startDate = start ? dayjs(start) : null;
      const endDate = end ? dayjs(end) : null;

      if (startDate) {
        minStart = !minStart || startDate.isBefore(minStart) ? startDate : minStart;
      }
      if (endDate) {
        maxEnd = !maxEnd || endDate.isAfter(maxEnd) ? endDate : maxEnd;
      }
    }

    const startCandidate = minStart ? minStart.subtract(MINUTES_BUFFER, "minute") : null;
    const endCandidate = maxEnd ? maxEnd.add(MINUTES_BUFFER, "minute") : null;

    let minSeconds = startCandidate ? startCandidate.hour() * 3600 + startCandidate.minute() * 60 : 6 * 3600;
    let maxSeconds = endCandidate ? endCandidate.hour() * 3600 + endCandidate.minute() * 60 : 20 * 3600;

    minSeconds = clampSeconds(minSeconds);
    maxSeconds = clampSeconds(maxSeconds);

    // ensure we leave breathing room even for very tight schedules
    const minimumWindow = minSeconds + 60 * MINUTES_BUFFER;
    if (maxSeconds < minimumWindow) {
      maxSeconds = Math.min(SECONDS_IN_DAY, minimumWindow);
    }

    const slotMinTime = secondsToTime(minSeconds);
    const slotMaxTime = secondsToTime(maxSeconds);

    return { slotMinTime, slotMaxTime };
  }, [events]);

  return (
    <div className="schedule-calendar rounded-2xl border border-base-300 bg-base-200/80 p-4 shadow-md">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={esLocale}
        locales={[esLocale]}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        height="auto"
        dayMaxEventRows={4}
        dayMaxEvents
        moreLinkClick="popover"
        events={calendarEvents}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotMinTime={timeBounds.slotMinTime}
        slotMaxTime={timeBounds.slotMaxTime}
        hiddenDays={[0]}
        eventClassNames={(arg: { event: { extendedProps?: CalendarEventInput["extendedProps"] } }) => {
          const category = arg.event.extendedProps?.category;
          if (category === "Tratamiento subcutáneo") return ["calendar-event--subcutaneous"];
          if (category === "Test y exámenes") return ["calendar-event--test"];
          return ["calendar-event--default"];
        }}
        eventContent={(arg: EventContentArg) => {
          const props = arg.event.extendedProps;
          const lines: string[] = [];
          if (props.amountExpected != null) {
            lines.push(`Esperado ${currencyFormatter.format(props.amountExpected)}`);
          }
          if (props.amountPaid != null) {
            lines.push(`Pagado ${currencyFormatter.format(props.amountPaid)}`);
          }
          if (props.dosage && props.category === "Tratamiento subcutáneo") {
            lines.push(`Dosis ${props.dosage}`);
          }
          return (
            <div className="flex flex-col gap-0.5 text-xs leading-tight">
              <span className="font-semibold text-base-content">{formatTitle(arg.event.title)}</span>
              {lines.slice(0, MAX_DETAIL_LINES).map((line, index) => (
                <span key={index} className="text-base-content">
                  {line}
                </span>
              ))}
              {lines.length > MAX_DETAIL_LINES ? <span className="text-xs text-base-content/50">…</span> : null}
            </div>
          );
        }}
        eventDidMount={(info: EventDidMountArg) => {
          const props = info.event.extendedProps;
          const details: string[] = [`Calendario: ${props.calendarId}`];
          if (props.category) details.push(`Categoría: ${props.category}`);
          if (props.amountExpected != null) details.push(`Esperado: ${currencyFormatter.format(props.amountExpected)}`);
          if (props.amountPaid != null) details.push(`Pagado: ${currencyFormatter.format(props.amountPaid)}`);
          if (props.treatmentStage) details.push(`Etapa: ${props.treatmentStage}`);
          if (props.dosage) details.push(`Dosis: ${props.dosage}`);
          info.el.setAttribute("title", details.join("\n"));
        }}
        eventClick={(info: EventClickArg) => {
          info.jsEvent.preventDefault();
          const props = info.event.extendedProps as CalendarEventInput["extendedProps"];
          setSelectedEvent({
            id: info.event.id,
            title: info.event.title,
            start: info.event.startStr,
            end: info.event.endStr ?? undefined,
            allDay: info.event.allDay,
            extendedProps: props,
          });
        }}
        nowIndicator
        editable={false}
        selectable={false}
        eventsSet={() => {
          /* noop */
        }}
        progressiveEventRendering
        slotEventOverlap
        lazyFetching
        loading={(isLoading: boolean) => {
          if (isLoading) {
            document.body.classList.add("calendar-loading");
          } else {
            document.body.classList.remove("calendar-loading");
          }
        }}
      />
      {loading && <p className="mt-2 text-xs text-base-content/60">Actualizando eventos…</p>}
      {selectedEvent && (
        <div className="mt-4 rounded-xl border border-base-300 bg-base-100/70 p-4 shadow-sm text-sm text-base-content">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-base-content/60">Evento seleccionado</p>
              <p className="text-lg font-semibold text-base-content">{selectedEvent.extendedProps.fullTitle}</p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setSelectedEvent(null)}
            >
              Cerrar
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-base-content/60">Inicio</dt>
              <dd className="font-medium">
                {selectedEvent.start ? dayjs(selectedEvent.start).format("DD MMM YYYY HH:mm") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Fin</dt>
              <dd className="font-medium">
                {selectedEvent.end ? dayjs(selectedEvent.end).format("DD MMM YYYY HH:mm") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Calendario</dt>
              <dd className="font-medium">{selectedEvent.extendedProps.calendarId}</dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Categoría</dt>
              <dd className="font-medium">{selectedEvent.extendedProps.category ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Monto esperado</dt>
              <dd className="font-medium">
                {selectedEvent.extendedProps.amountExpected != null
                  ? currencyFormatter.format(selectedEvent.extendedProps.amountExpected)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Monto pagado</dt>
              <dd className="font-medium">
                {selectedEvent.extendedProps.amountPaid != null
                  ? currencyFormatter.format(selectedEvent.extendedProps.amountPaid)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Etapa</dt>
              <dd className="font-medium">{selectedEvent.extendedProps.treatmentStage ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-base-content/60">Dosis</dt>
              <dd className="font-medium">{selectedEvent.extendedProps.dosage ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

export default ScheduleCalendar;
