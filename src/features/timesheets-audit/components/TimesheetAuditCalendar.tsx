/**
 * TimesheetAuditCalendar Component
 * Displays employee work schedules with overlap detection
 * Optimized for production with proper type safety and performance
 */

import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import type { CalendarApi } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

import type { TimesheetEntryWithEmployee, CalendarEventData } from "../types";
import { calculateDurationHours, formatDuration, getOverlappingEmployeesForDate } from "../utils/overlapDetection";

import "./TimesheetAuditCalendar.css";

interface TimesheetAuditCalendarProps {
  entries: TimesheetEntryWithEmployee[];
  loading?: boolean;
  selectedEmployeeIds: number[];
  focusDate?: string | null;
  visibleDateRanges?: Array<{ start: string; end: string }> | null;
}

function normalizeTimeComponent(time: string | null | undefined) {
  if (!time) return null;
  const trimmed = time.trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // fallback: attempt to slice first 8 chars (HH:mm:ss)
  return trimmed.slice(0, 8);
}

function buildDateTime(date: string, time: string | null) {
  if (!time) return null;
  return `${date}T${time}`;
}

/**
 * Convert timesheet entries to FullCalendar events
 */
function convertToCalendarEvents(
  entries: TimesheetEntryWithEmployee[],
  overlappingEmployeesByDate: Map<string, Set<number>>
): CalendarEventData[] {
  return entries
    .filter((entry) => entry.start_time && entry.end_time)
    .map((entry) => {
      const duration = calculateDurationHours(entry.start_time, entry.end_time);
      const overlappingOnDate = overlappingEmployeesByDate.get(entry.work_date) || new Set();
      const hasOverlap = overlappingOnDate.has(entry.employee_id);

      return {
        id: `${entry.id}`,
        employeeId: entry.employee_id,
        employee_name: entry.employee_name,
        employee_role: entry.employee_role,
        work_date: entry.work_date,
        start_time: entry.start_time,
        end_time: entry.end_time,
        duration_hours: duration,
        has_overlap: hasOverlap,
      };
    });
}

/**
 * Convert to FullCalendar event format
 */
function toFullCalendarEvents(calendarEvents: CalendarEventData[]): Array<{
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  extendedProps: {
    employee_name: string;
    duration_hours: number;
    has_overlap: boolean;
    employee_role: string | null;
  };
  backgroundColor?: string;
  borderColor?: string;
  classNames: string[];
}> {
  return calendarEvents
    .map((event) => {
      const normalizedStart = normalizeTimeComponent(event.start_time);
      const normalizedEnd = normalizeTimeComponent(event.end_time);
      const startIso = normalizedStart ? buildDateTime(event.work_date, normalizedStart) : null;
      const endIso = normalizedEnd ? buildDateTime(event.work_date, normalizedEnd) : null;
      if (!startIso || !endIso) {
        return null;
      }

      return {
        id: event.id,
        title: event.employee_name,
        start: startIso,
        end: endIso,
        allDay: false,
        extendedProps: {
          employee_name: event.employee_name,
          duration_hours: event.duration_hours,
          has_overlap: event.has_overlap,
          employee_role: event.employee_role,
        },
        backgroundColor: event.has_overlap ? "var(--color-error)" : "var(--color-accent)",
        borderColor: event.has_overlap ? "var(--color-error)" : "var(--color-accent)",
        classNames: ["timesheet-audit-event", event.has_overlap ? "has-overlap" : ""].filter(Boolean),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);
}

export default function TimesheetAuditCalendar({
  entries,
  loading = false,
  focusDate,
  visibleDateRanges,
}: TimesheetAuditCalendarProps) {
  const calendarApiRef = useRef<CalendarApi | null>(null);

  useEffect(() => {
    if (!focusDate) return;
    calendarApiRef.current?.gotoDate(focusDate);
  }, [focusDate]);

  const rangeFilteredEntries = useMemo(() => {
    if (!visibleDateRanges || visibleDateRanges.length === 0) {
      return entries;
    }
    return entries.filter((entry) =>
      visibleDateRanges.some((range) => entry.work_date >= range.start && entry.work_date <= range.end)
    );
  }, [entries, visibleDateRanges]);

  // Memoize overlap detection to avoid recalculation
  const overlappingEmployeesByDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const dates = new Set(rangeFilteredEntries.map((e) => e.work_date));

    for (const date of dates) {
      const overlapping = getOverlappingEmployeesForDate(rangeFilteredEntries, date);
      map.set(date, new Set(overlapping));
    }

    return map;
  }, [rangeFilteredEntries]);

  // Convert entries to calendar format
  const calendarEvents = useMemo(() => {
    return convertToCalendarEvents(rangeFilteredEntries, overlappingEmployeesByDate);
  }, [rangeFilteredEntries, overlappingEmployeesByDate]);

  // Convert to FullCalendar format
  const fullCalendarEvents = useMemo(() => {
    return toFullCalendarEvents(calendarEvents);
  }, [calendarEvents]);

  // Calculate time bounds based on entries
  const timeBounds = useMemo(() => {
    if (!rangeFilteredEntries.length) {
      return {
        slotMinTime: "06:00:00",
        slotMaxTime: "20:00:00",
      };
    }

    let minTime = "23:59:00";
    let maxTime = "00:00:00";

    for (const entry of rangeFilteredEntries) {
      const normalizedStart = normalizeTimeComponent(entry.start_time);
      const normalizedEnd = normalizeTimeComponent(entry.end_time);
      if (normalizedStart && normalizedStart < minTime) minTime = normalizedStart;
      if (normalizedEnd && normalizedEnd > maxTime) maxTime = normalizedEnd;
    }

    // Expand bounds by 1 hour for readability
    const minHour = Math.max(0, Number(minTime.split(":")[0]) - 1);
    const maxHour = Math.min(23, Number(maxTime.split(":")[0]) + 1);

    return {
      slotMinTime: `${String(minHour).padStart(2, "0")}:00:00`,
      slotMaxTime: `${String(maxHour + 1).padStart(2, "0")}:00:00`,
    };
  }, [rangeFilteredEntries]);

  const handleEventDidMount = (info: {
    event: {
      extendedProps: {
        employee_name: string;
        duration_hours: number;
        has_overlap: boolean;
        employee_role: string | null;
      };
    };
    el: HTMLElement;
  }) => {
    const props = info.event.extendedProps;
    const roleLabel = props.employee_role ? ` · ${props.employee_role}` : "";
    const tooltipText = `${props.employee_name}${roleLabel} · ${formatDuration(props.duration_hours)}${
      props.has_overlap ? " · ⚠️ Solapamiento" : ""
    }`;
    info.el.setAttribute("title", tooltipText);
    if (props.has_overlap) {
      info.el.classList.add("has-overlap");
    }
  };

  return (
    <div className="surface-recessed w-full overflow-hidden p-6">
      <div className="timesheet-audit-calendar-wrapper">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-100/80 z-50">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        )}
        <FullCalendar
          ref={(instance: unknown) => {
            if (instance && typeof (instance as { getApi?: unknown }).getApi === "function") {
              calendarApiRef.current = (instance as { getApi: () => CalendarApi }).getApi();
            } else {
              calendarApiRef.current = null;
            }
          }}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="timeGridWeek"
          initialDate={focusDate ?? undefined}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="auto"
          contentHeight="auto"
          events={fullCalendarEvents}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: false,
            hour12: false,
          }}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: false,
            hour12: false,
          }}
          slotMinTime={timeBounds.slotMinTime}
          slotMaxTime={timeBounds.slotMaxTime}
          hiddenDays={[0]}
          slotDuration="00:30:00"
          slotLabelInterval="00:30:00"
          eventDidMount={handleEventDidMount}
          nowIndicator
          editable={false}
          selectable={false}
          dayMaxEvents={false}
          eventDisplay="block"
          locale="es"
        />
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-col gap-3 text-sm text-base-content/70">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-accent"></div>
          <span>Sin solapamiento</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-error"></div>
          <span>Con solapamiento detectado</span>
        </div>
      </div>
    </div>
  );
}
