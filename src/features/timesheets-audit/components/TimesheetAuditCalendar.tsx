/**
 * TimesheetAuditCalendar Component
 * Displays employee work schedules with overlap detection
 * Optimized for production with proper type safety and performance
 */

import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

import type { TimesheetEntryWithEmployee, CalendarEventData } from "../types";
import { calculateDurationHours, formatDuration, getOverlappingEmployeesForDate } from "../utils/overlapDetection";

import "./TimesheetAuditCalendar.css";

interface TimesheetAuditCalendarProps {
  entries: TimesheetEntryWithEmployee[];
  loading?: boolean;
  selectedEmployeeIds: number[];
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
  };
  backgroundColor?: string;
  borderColor?: string;
}> {
  return calendarEvents.map((event) => {
    const dateTime = `${event.work_date}T${event.start_time}:00`;
    const endDateTime = `${event.work_date}T${event.end_time}:00`;

    return {
      id: event.id,
      title: event.employee_name,
      start: dateTime,
      end: endDateTime,
      allDay: false,
      extendedProps: {
        employee_name: event.employee_name,
        duration_hours: event.duration_hours,
        has_overlap: event.has_overlap,
      },
      backgroundColor: event.has_overlap ? "#f87272" : "#0ea5a4",
      borderColor: event.has_overlap ? "#fb7185" : "#06b6d4",
    };
  });
}

export default function TimesheetAuditCalendar({ entries, loading = false }: TimesheetAuditCalendarProps) {
  // Memoize overlap detection to avoid recalculation
  const overlappingEmployeesByDate = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const dates = new Set(entries.map((e) => e.work_date));

    for (const date of dates) {
      const overlapping = getOverlappingEmployeesForDate(entries, date);
      map.set(date, new Set(overlapping));
    }

    return map;
  }, [entries]);

  // Convert entries to calendar format
  const calendarEvents = useMemo(() => {
    return convertToCalendarEvents(entries, overlappingEmployeesByDate);
  }, [entries, overlappingEmployeesByDate]);

  // Convert to FullCalendar format
  const fullCalendarEvents = useMemo(() => {
    return toFullCalendarEvents(calendarEvents);
  }, [calendarEvents]);

  // Calculate time bounds based on entries
  const timeBounds = useMemo(() => {
    if (!entries.length) {
      return {
        slotMinTime: "06:00:00",
        slotMaxTime: "20:00:00",
      };
    }

    let minTime = "23:59:00";
    let maxTime = "00:00:00";

    for (const entry of entries) {
      if (entry.start_time < minTime) minTime = entry.start_time;
      if (entry.end_time > maxTime) maxTime = entry.end_time;
    }

    // Expand bounds by 1 hour for readability
    const minHour = Math.max(0, Number(minTime.split(":")[0]) - 1);
    const maxHour = Math.min(23, Number(maxTime.split(":")[0]) + 1);

    return {
      slotMinTime: `${String(minHour).padStart(2, "0")}:00:00`,
      slotMaxTime: `${String(maxHour + 1).padStart(2, "0")}:00:00`,
    };
  }, [entries]);

  const handleEventDidMount = (info: {
    event: {
      extendedProps: {
        employee_name: string;
        duration_hours: number;
        has_overlap: boolean;
      };
    };
    el: HTMLElement;
  }) => {
    const props = info.event.extendedProps;
    const tooltipText = `${props.employee_name} · ${formatDuration(props.duration_hours)}${props.has_overlap ? " · ⚠️ Solapamiento" : ""}`;
    info.el.setAttribute("title", tooltipText);
    info.el.classList.add("timesheet-audit-event");
  };

  return (
    <div className="w-full rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm overflow-hidden">
      <div className="timesheet-audit-calendar-wrapper">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-100/80 z-50">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        )}
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="timeGridWeek"
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
