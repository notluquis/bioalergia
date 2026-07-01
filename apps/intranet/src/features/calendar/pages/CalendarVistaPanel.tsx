import type { DatesSetArg, EventClickArg, EventContentArg } from "@fullcalendar/core";
import { Card, Chip, ListBox, Modal, Select, Separator, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { fetchDoctoraliaCalendarMerged } from "@/features/doctoralia/api";
import { addDays } from "@/lib/dates";
import { numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CalendarFiltersPopover } from "../components/CalendarFiltersPopover";
import { DailyEventCard } from "../components/DailyEventCard";
import { useCalendarEvents } from "../hooks/use-calendar-events";
import type { CalendarDayEvents, CalendarEventDetail } from "../types";
import { mergedToCalendarEventDetails } from "../utils/doctoralia-merge";
import { type CalendarEventStateTone, getCalendarEventStates } from "../utils/event-state";

const routeApi = getRouteApi("/_authed/calendar/");

import "./CalendarVistaPanel.css";

type CalendarSource = "doctoralia" | "google";

interface FcEvent {
  allDay: boolean;
  classNames: string[];
  end?: string;
  extendedProps: { detail: CalendarEventDetail };
  id: string;
  start: string;
  title: string;
}

interface CalendarGridProps {
  events: FcEvent[];
  initialDate?: string;
  onDatesSet: (fromISO: string, toISO: string) => void;
  onEventClick: (detail: CalendarEventDetail) => void;
}

// Lazy-load FullCalendar + its plugins so the chunk only enters the network
// when this tab is actually mounted (the host gates mount via `useLazyTabs`).
const CalendarGrid = lazy(async () => {
  const [{ default: FullCalendar }, { default: dayGridPlugin }, { default: timeGridPlugin }] =
    await Promise.all([
      import("@fullcalendar/react"),
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
    ]);

  return {
    default: function CalendarGridImpl({
      events,
      initialDate,
      onDatesSet,
      onEventClick,
    }: CalendarGridProps) {
      return (
        <FullCalendar
          contentHeight="auto"
          datesSet={(arg: DatesSetArg) => {
            // arg.endStr is exclusive (next period's first day) → -1 day for an
            // inclusive `to`. Slice to YYYY-MM-DD (drops tz suffix).
            onDatesSet(arg.startStr.slice(0, 10), addDays(arg.endStr.slice(0, 10), -1));
          }}
          dayMaxEvents={3}
          editable={false}
          eventClick={(arg: EventClickArg) => {
            arg.jsEvent.preventDefault();
            onEventClick(arg.event.extendedProps.detail as CalendarEventDetail);
          }}
          eventContent={(arg: EventContentArg) => (
            <ClinicalEventChip
              detail={arg.event.extendedProps.detail as CalendarEventDetail}
              timeText={arg.timeText}
            />
          )}
          eventDisplay="block"
          // FC default blue event color + white text = 3.69 contrast (fails WCAG
          // AA). Deep brand blue (set via these props + CSS var) wins AA.
          eventBackgroundColor="var(--brand-blue-deep)"
          eventBorderColor="var(--brand-blue-deep)"
          events={events}
          eventTextColor="#ffffff"
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
          initialDate={initialDate}
          initialView="timeGridWeek"
          locale="es"
          nowIndicator
          plugins={[dayGridPlugin, timeGridPlugin]}
          selectable={false}
          slotDuration="00:30:00"
          slotMaxTime="22:00:00"
          slotMinTime="07:00:00"
          // FC renders prev/next chevrons as <span role="img"> with no alt → axe
          // role-img-alt. Decorative (the button carries the label) → hide once mounted.
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

const TONE_DOT: Record<CalendarEventStateTone, string> = {
  danger: "bg-danger-300",
  default: "bg-white/70",
  success: "bg-success-300",
  warning: "bg-warning-300",
};

function ClinicalEventChip({
  detail,
  timeText,
}: Readonly<{ detail: CalendarEventDetail; timeText: string }>) {
  const state = getCalendarEventStates(detail)[0];
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {state ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[state.tone])}
          title={state.label}
        />
      ) : null}
      {timeText ? (
        <span className="shrink-0 font-medium tabular-nums opacity-90">{timeText}</span>
      ) : null}
      <span className="truncate">{detail.summary ?? detail.patientName ?? "Evento"}</span>
    </div>
  );
}

function pickStart(event: CalendarEventDetail): null | string {
  return event.startDateTime ?? event.startDate ?? event.eventDateTime ?? event.eventDate ?? null;
}

function toFcEvents(events: CalendarEventDetail[]): FcEvent[] {
  const out: FcEvent[] = [];
  for (const event of events) {
    const start = pickStart(event);
    if (!start) {
      continue;
    }
    out.push({
      allDay: !event.startDateTime,
      classNames: ["calendar-vista-event"],
      end: event.endDateTime ?? undefined,
      extendedProps: { detail: event },
      id: `${event.calendarId}:${event.eventId}`,
      start,
      title: event.summary ?? event.patientName ?? "Evento",
    });
  }
  return out;
}

function flattenDays(days: CalendarDayEvents[] | undefined): CalendarEventDetail[] {
  return days?.flatMap((day) => day.events) ?? [];
}

function CalendarSourceSelector({
  onSourceChange,
  source,
}: Readonly<{ onSourceChange: (key: string) => void; source: CalendarSource }>) {
  return (
    <Select
      aria-label="Fuente del calendario"
      className="min-w-44"
      value={source}
      onChange={(key) => {
        if (key) {
          onSourceChange(String(key));
        }
      }}
    >
      <Select.Trigger className="h-9">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="google" textValue="Google Calendar">
            Google Calendar
          </ListBox.Item>
          <ListBox.Item id="doctoralia" textValue="Doctoralia">
            Doctoralia
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * `/calendar?tab=vista` — the unified agenda.
 *
 * One FullCalendar timegrid (week default, month + day switchers) rendering the
 * shared `useCalendarEvents` daily payload with a clinical event chip (decoded
 * attendance/status via `getCalendarEventStates`). Clicking an event opens the
 * full `DailyEventCard`. FullCalendar owns date navigation; `datesSet` pushes the
 * visible range to the URL so the shared hook refetches (single source of truth).
 *
 * Replaces both the old read-only vista panel AND the hand-rolled `WeekGrid`
 * agenda (`/clinical/agenda`).
 */
export function CalendarVistaPanel() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const source: CalendarSource = search.source ?? "google";
  const isGoogleSource = source === "google";

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null);

  const { appliedFilters, availableCategories, daily, defaults, error, loading, summary } =
    useCalendarEvents({ enabled: isGoogleSource });

  const { data: doctoraliaEvents = [], isLoading: doctoraliaLoading } = useQuery({
    enabled: !isGoogleSource && Boolean(search.from) && Boolean(search.to),
    queryFn: async () => {
      if (!search.from || !search.to) {
        return [];
      }
      const merged = await fetchDoctoraliaCalendarMerged({ from: search.from, to: search.to });
      return mergedToCalendarEventDetails(merged);
    },
    queryKey: ["doctoralia", "calendar", "merged", search.from, search.to],
  });

  const displayedEvents = isGoogleSource ? flattenDays(daily?.days) : doctoraliaEvents;
  const fcEvents = useMemo(() => toFcEvents(displayedEvents), [displayedEvents]);

  // Filter draft (Google only; applied on "Aplicar").
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const serializedApplied = JSON.stringify(appliedFilters);
  useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters((prev) =>
        JSON.stringify(prev) === serializedApplied ? prev : appliedFilters
      );
    }
  }, [appliedFilters, filtersOpen, serializedApplied]);

  const onDatesSet = useCallback(
    (fromISO: string, toISO: string) => {
      void navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          date: undefined,
          from: fromISO,
          to: toISO,
        }),
      });
    },
    [navigate]
  );

  const onSourceChange = useCallback(
    (nextKey: string) => {
      const next = nextKey as CalendarSource;
      void navigate({
        search: (prev) => ({
          ...prev,
          source: next === "google" ? undefined : next,
          ...(next === "google"
            ? {}
            : { calendarId: undefined, category: undefined, search: undefined }),
        }),
      });
    },
    [navigate]
  );

  const onApplyGoogleFilters = useCallback(() => {
    void navigate({
      search: (prev) => ({
        ...prev,
        calendarId: draftFilters.calendarIds?.length ? draftFilters.calendarIds : undefined,
        category: draftFilters.categories.length ? draftFilters.categories : undefined,
        search: draftFilters.search || undefined,
      }),
    });
    setFiltersOpen(false);
  }, [draftFilters, navigate]);

  const onResetGoogleFilters = useCallback(() => {
    setDraftFilters(defaults);
    void navigate({
      search: (prev) => ({
        ...prev,
        calendarId: undefined,
        category: undefined,
        search: undefined,
      }),
    });
  }, [defaults, navigate]);

  const calendarLoading = isGoogleSource ? loading : doctoraliaLoading;
  const totalEvents = isGoogleSource ? (summary?.totals.events ?? 0) : displayedEvents.length;
  const initialDate = search.from ?? search.date ?? undefined;

  return (
    <section className="space-y-4" data-testid="calendar-vista-panel">
      <header className="flex flex-wrap items-center gap-2">
        <CalendarSourceSelector onSourceChange={onSourceChange} source={source} />
        <Chip className="tabular-nums" color="default" size="sm" variant="soft">
          {numberFormatter.format(totalEvents)} eventos
        </Chip>
        {isGoogleSource ? (
          <>
            <Separator className="mx-1 h-5" orientation="vertical" />
            <CalendarFiltersPopover
              applyCount={totalEvents}
              availableCategories={availableCategories}
              className="shadow-lg"
              filters={draftFilters}
              isDirty={JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters)}
              isOpen={filtersOpen}
              layout="dropdown"
              loading={loading}
              onApply={onApplyGoogleFilters}
              onFilterChange={(key, value) =>
                setDraftFilters((prev) => ({ ...prev, [key]: value }))
              }
              onOpenChange={setFiltersOpen}
              onReset={onResetGoogleFilters}
              showSearch
            />
          </>
        ) : null}
      </header>

      <div className="calendar-vista-wrapper" data-testid="calendar-vista-grid">
        {error ? (
          <Card variant="secondary">
            <Card.Content className="p-4 text-danger text-sm">
              No se pudieron cargar los eventos del calendario.
            </Card.Content>
          </Card>
        ) : null}
        {calendarLoading && !displayedEvents.length ? (
          <Skeleton aria-label="Cargando calendario" className="h-96 w-full rounded-xl" />
        ) : (
          <Suspense
            fallback={
              <Skeleton aria-label="Cargando calendario" className="h-96 w-full rounded-xl" />
            }
          >
            <CalendarGrid
              events={fcEvents}
              initialDate={initialDate}
              onDatesSet={onDatesSet}
              onEventClick={setSelectedEvent}
            />
          </Suspense>
        )}
      </div>

      <Modal.Backdrop
        isOpen={selectedEvent != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
          }
        }}
        variant="blur"
      >
        <Modal.Container placement="center" scroll="inside" size="lg">
          <Modal.Dialog className="w-full max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Detalle de la cita</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="pb-4">
              {selectedEvent ? <DailyEventCard event={selectedEvent} /> : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}
