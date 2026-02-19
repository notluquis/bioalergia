/**
 * TimesheetAuditCalendar Component
 * Displays employee work schedules with overlap detection
 * Optimized for production with proper type safety and performance
 */

import type { CalendarApi, EventContentArg } from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Skeleton, Tooltip } from "@heroui/react";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";

import type { CalendarEventData, TimesheetEntryWithEmployee } from "../types";

const TIME_HH_MM_REGEX = /^\d{2}:\d{2}$/;
const TIME_HH_MM_SS_REGEX = /^\d{2}:\d{2}:\d{2}$/;

import {
  calculateDurationHours,
  formatDuration,
  getOverlappingEmployeesForDate,
} from "../utils/overlap-detection";

import "./TimesheetAuditCalendar.css";

interface TimesheetAuditCalendarProps {
  entries: TimesheetEntryWithEmployee[];
  focusDate?: null | Date;
  loading?: boolean;
  selectedEmployeeIds: number[];
  visibleDateRanges?: null | { end: Date; start: Date }[];
}

const SECONDS_IN_DAY = 24 * 60 * 60 - 1; // 23:59:59
const SLOT_BUFFER_SECONDS = 60 * 30;

function buildDateTime(date: string, time: null | string) {
  if (!time) {
    return null;
  }
  return `${date}T${time}`;
}

function clampSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(SECONDS_IN_DAY, Math.max(0, Math.floor(value)));
}

/**
 * Convert timesheet entries to FullCalendar events
 */
function convertToCalendarEvents(
  entries: TimesheetEntryWithEmployee[],
  overlappingEmployeesByDate: Map<string, Set<number>>,
): CalendarEventData[] {
  return entries
    .filter((entry) => entry.start_time && entry.end_time)
    .map((entry) => {
      const duration = calculateDurationHours(entry.start_time, entry.end_time);
      const dateKey = entry.work_date;
      const overlappingOnDate = overlappingEmployeesByDate.get(dateKey) || new Set();
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
  if (!time) {
    return null;
  }
  const trimmed = time.trim();
  if (!trimmed) {
    return null;
  }
  if (TIME_HH_MM_REGEX.test(trimmed)) {
    return `${trimmed}:00`;
  }
  if (TIME_HH_MM_SS_REGEX.test(trimmed)) {
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
        backgroundColor: event.has_overlap ? "var(--color-danger)" : "var(--color-success)",
        borderColor: event.has_overlap ? "var(--color-danger)" : "var(--color-success)",
        classNames: ["timesheet-audit-event", event.has_overlap ? "has-overlap" : ""].filter(
          Boolean,
        ),
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

const buildTooltipContent = (props: {
  duration_hours: number;
  employee_name: string;
  employee_role: null | string;
  has_overlap: boolean;
}) => {
  const roleLabel = props.employee_role ? ` · ${props.employee_role}` : "";
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">
        {props.employee_name}
        {roleLabel}
      </p>
      <p className="text-default-600">Duración: {formatDuration(props.duration_hours)}</p>
      {props.has_overlap && <p className="text-danger">⚠️ Solapamiento detectado</p>}
    </div>
  );
};
export function TimesheetAuditCalendar({
  entries,
  focusDate,
  loading = false,
  visibleDateRanges,
}: TimesheetAuditCalendarProps) {
  const calendarApiRef = useRef<CalendarApi | null>(null);
  const [tooltipTrigger, setTooltipTrigger] = useState<"focus" | "hover">("hover");

  // Navigate to focus date when it changes
  useEffect(() => {
    if (!focusDate) {
      return;
    }
    calendarApiRef.current?.gotoDate(focusDate);
  }, [focusDate]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setTooltipTrigger(canHover ? "hover" : "focus");
  }, []);

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
      visibleDateRanges.some((range) => {
        const startKey = dayjs(range.start).format("YYYY-MM-DD");
        const endKey = dayjs(range.end).format("YYYY-MM-DD");
        return entry.work_date >= startKey && entry.work_date <= endKey;
      }),
    );
  })();

  // Memoize overlap detection to avoid recalculation
  const overlappingEmployeesByDate = (() => {
    const map = new Map<string, Set<number>>();
    const dates = new Set(rangeFilteredEntries.map((e) => e.work_date));

    for (const dateKey of dates) {
      const overlapping = getOverlappingEmployeesForDate(rangeFilteredEntries, dateKey);
      map.set(dateKey, new Set(overlapping));
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
        minSeconds = Math.min(
          minSeconds,
          timeStringToSeconds(normalizedStart) - SLOT_BUFFER_SECONDS,
        );
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
    <div className="w-full overflow-hidden rounded-xl border border-default-100 bg-default-50/30 p-4 sm:p-6">
      <div className="timesheet-audit-calendar-wrapper">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
            <div className="w-full max-w-lg space-y-3 rounded-xl bg-background p-4 shadow-sm">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        )}
        <FullCalendar
          contentHeight="auto"
          dayMaxEvents={false}
          editable={false}
          eventContent={(info: EventContentArg) => {
            const props = info.event.extendedProps as {
              duration_hours: number;
              employee_name: string;
              employee_role: null | string;
              has_overlap: boolean;
            };
            return (
              <Tooltip delay={0} trigger={tooltipTrigger}>
                <Tooltip.Trigger>
                  <div className="timesheet-audit-event-inner">
                    {info.timeText && (
                      <span className="timesheet-audit-event-time">{info.timeText}</span>
                    )}
                    <span className="timesheet-audit-event-title">{info.event.title}</span>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Content placement="top" showArrow>
                  {buildTooltipContent(props)}
                </Tooltip.Content>
              </Tooltip>
            );
          }}
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
      <div className="mt-6 grid grid-cols-1 gap-3 text-default-600 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-success" />
          <span>Sin solapamiento</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-danger" />
          <span>Con solapamiento detectado</span>
        </div>
      </div>
    </div>
  );
}
