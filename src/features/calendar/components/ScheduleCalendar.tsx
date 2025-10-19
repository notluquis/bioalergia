import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
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

function asFullCalendarEvents(source: CalendarEventDetail[]): CalendarEventInput[] {
  return source.map((event) => {
    const start = event.startDateTime ?? (event.startDate ? `${event.startDate}T00:00:00` : null);
    const end = event.endDateTime ?? (event.endDate ? `${event.endDate}T23:59:59` : null);
    const allDay = !event.startDateTime && !!event.startDate && !event.endDateTime;
    return {
      id: event.eventId,
      title: event.summary?.trim() || "(Sin título)",
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
      },
    };
  });
}

export function ScheduleCalendar({ events, loading = false }: ScheduleCalendarProps) {
  const calendarEvents = useMemo(() => asFullCalendarEvents(events), [events]);

  return (
    <div className="rounded-2xl border border-white/50 bg-white/90 p-4 shadow-sm">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        height="auto"
        events={calendarEvents}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
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
            <div className="flex flex-col gap-[2px] text-[11px] leading-tight">
              <span className="font-semibold text-slate-800">{arg.event.title}</span>
              {lines.map((line, index) => (
                <span key={index} className="text-slate-600">
                  {line}
                </span>
              ))}
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
      {loading && <p className="mt-2 text-xs text-slate-500">Actualizando eventos…</p>}
    </div>
  );
}

export default ScheduleCalendar;
