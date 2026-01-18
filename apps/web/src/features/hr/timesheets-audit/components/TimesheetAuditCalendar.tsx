/**
 * TimesheetAuditCalendar Component
 * Displays employee work schedules with overlap detection
 * Optimized for production with proper type safety and performance
 */

import type { CalendarApi } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEffect, useRef } from "react";

import { LOADING_SPINNER_MD } from "@/lib/styles";

import type { CalendarEventData, TimesheetEntryWithEmployee } from "../types";

import { calculateDurationHours, formatDuration, getOverlappingEmployeesForDate } from "../utils/overlapDetection";

import "./TimesheetAuditCalendar.css";

interface TimesheetAuditCalendarProps {
  entries: TimesheetEntryWithEmployee[];
  focusDate?: null | string;
  loading?: boolean;
  selectedEmployeeIds: number[];
  visibleDateRanges?: null | { end: string; start: string }[];
}

const SECONDS_IN_DAY = 24 * 60 * 60 - 1; // 23:59:59
const SLOT_BUFFER_SECONDS = 60 * 30;

function buildDateTime(date: string, time: null | string) {
  if (!time) return null;
  return `${date}T${time}`;
}

function clampSeconds(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(SECONDS_IN_DAY, Math.max(0, Math.floor(value)));
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
        duration_hours: duration,
        employee_name: entry.employee_name,
        employee_role: entry.employee_role,
        employeeId: entry.employee_id,
        end_time: entry.end_time,
        has_overlap: hasOverlap,
        id: `${entry.id}`,
        start_time: entry.start_time,
        work_date: entry.work_date,
      };
    });
}

function normalizeTimeComponent(time: null | string | undefined) {
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

function secondsToTime(value: number) {
  const clamped = clampSeconds(value);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timeStringToSeconds(value: string) {
  const [hoursRaw = "0", minutesRaw = "0", secondsRaw = "0"] = value.split(":");
  const hours = Number.parseInt(hoursRaw, 10) || 0;
  const minutes = Number.parseInt(minutesRaw, 10) || 0;
  const seconds = Number.parseInt(secondsRaw, 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert to FullCalendar event format
 */
function toFullCalendarEvents(calendarEvents: CalendarEventData[]): {
  allDay: boolean;
  backgroundColor?: string;
  borderColor?: string;
  classNames: string[];
  end: string;
  extendedProps: {
    duration_hours: number;
    employee_name: string;
    employee_role: null | string;
    has_overlap: boolean;
  };
  id: string;
  start: string;
  title: string;
}[] {
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
        allDay: false,
        backgroundColor: event.has_overlap ? "var(--color-error)" : "var(--color-accent)",
        borderColor: event.has_overlap ? "var(--color-error)" : "var(--color-accent)",
        classNames: ["timesheet-audit-event", event.has_overlap ? "has-overlap" : ""].filter(Boolean),
        end: endIso,
        extendedProps: {
          duration_hours: event.duration_hours,
          employee_name: event.employee_name,
          employee_role: event.employee_role,
          has_overlap: event.has_overlap,
        },
        id: event.id,
        start: startIso,
        title: event.employee_name,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);
}

const handleEventDidMount = (info: {
  el: HTMLElement;
  event: {
    extendedProps: {
      duration_hours: number;
      employee_name: string;
      employee_role: null | string;
      has_overlap: boolean;
    };
  };
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

export default function TimesheetAuditCalendar({
  entries,
  focusDate,
  loading = false,
  visibleDateRanges,
}: TimesheetAuditCalendarProps) {
  const calendarApiRef = useRef<CalendarApi | null>(null);

  // Navigate to focus date when it changes
  useEffect(() => {
    if (!focusDate) return;
    calendarApiRef.current?.gotoDate(focusDate);
  }, [focusDate]);

  // Cleanup: destroy calendar API on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (calendarApiRef.current) {
        calendarApiRef.current = null;
      }
    };
  }, []);

  const rangeFilteredEntries = (() => {
    if (!visibleDateRanges || visibleDateRanges.length === 0) {
      return entries;
    }
    return entries.filter((entry) =>
      visibleDateRanges.some((range) => entry.work_date >= range.start && entry.work_date <= range.end)
    );
  })();

  // Memoize overlap detection to avoid recalculation
  const overlappingEmployeesByDate = (() => {
    const map = new Map<string, Set<number>>();
    const dates = new Set(rangeFilteredEntries.map((e) => e.work_date));

    for (const date of dates) {
      const overlapping = getOverlappingEmployeesForDate(rangeFilteredEntries, date);
      map.set(date, new Set(overlapping));
    }

    return map;
  })();

  // Convert entries to calendar format
  const calendarEvents = convertToCalendarEvents(rangeFilteredEntries, overlappingEmployeesByDate);

  // Convert to FullCalendar format
  const fullCalendarEvents = toFullCalendarEvents(calendarEvents);

  // Calculate time bounds based on entries
  const timeBounds = (() => {
    if (rangeFilteredEntries.length === 0) {
      return {
        slotMaxTime: "20:00:00",
        slotMinTime: "06:00:00",
      };
    }

    let minSeconds = 23 * 3600 + 59 * 60; // 23:59:00
    let maxSeconds = 0;

    for (const entry of rangeFilteredEntries) {
      const normalizedStart = normalizeTimeComponent(entry.start_time);
      const normalizedEnd = normalizeTimeComponent(entry.end_time);
      if (normalizedStart) {
        minSeconds = Math.min(minSeconds, timeStringToSeconds(normalizedStart) - SLOT_BUFFER_SECONDS);
      }
      if (normalizedEnd) {
        maxSeconds = Math.max(maxSeconds, timeStringToSeconds(normalizedEnd) + SLOT_BUFFER_SECONDS);
      }
    }

    minSeconds = clampSeconds(minSeconds);
    maxSeconds = clampSeconds(maxSeconds);

    const minReadableWindow = minSeconds + SLOT_BUFFER_SECONDS;
    if (maxSeconds < minReadableWindow) {
      maxSeconds = Math.min(SECONDS_IN_DAY, minReadableWindow);
    }

    return {
      slotMaxTime: secondsToTime(maxSeconds),
      slotMinTime: secondsToTime(minSeconds),
    };
  })();

  return (
    <div className="bg-base-200/30 border-base-200 w-full overflow-hidden rounded-xl border p-6">
      <div className="timesheet-audit-calendar-wrapper">
        {loading && (
          <div className="bg-base-100/80 absolute inset-0 z-50 flex items-center justify-center">
            <span className={LOADING_SPINNER_MD}></span>
          </div>
        )}
        <FullCalendar
          contentHeight="auto"
          dayMaxEvents={false}
          editable={false}
          eventDidMount={handleEventDidMount}
          eventDisplay="block"
          events={fullCalendarEvents}
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
          hiddenDays={[0]}
          initialDate={focusDate ?? undefined}
          initialView="timeGridWeek"
          locale={esLocale}
          locales={[esLocale]}
          nowIndicator
          plugins={[dayGridPlugin, timeGridPlugin]}
          ref={(instance: unknown) => {
            calendarApiRef.current =
              instance && typeof (instance as { getApi?: unknown }).getApi === "function"
                ? (instance as { getApi: () => CalendarApi }).getApi()
                : null;
          }}
          selectable={false}
          slotDuration="00:30:00"
          slotLabelFormat={{
            hour: "2-digit",
            hour12: false,
            meridiem: false,
            minute: "2-digit",
          }}
          slotLabelInterval="00:30:00"
          slotMaxTime={timeBounds.slotMaxTime}
          slotMinTime={timeBounds.slotMinTime}
        />
      </div>

      {/* Legend */}
      <div className="text-base-content/70 mt-6 flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="bg-accent h-4 w-4 rounded"></div>
          <span>Sin solapamiento</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-error h-4 w-4 rounded"></div>
          <span>Con solapamiento detectado</span>
        </div>
      </div>
    </div>
  );
}
