import { useMemo } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import type { CalendarEventDetail } from "../types";
import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import "./WeekGrid.css";

dayjs.extend(isoWeek);

interface WeekGridProps {
  events: CalendarEventDetail[];
  weekStart: string; // YYYY-MM-DD of Monday
  loading?: boolean;
  onEventClick?: (event: CalendarEventDetail) => void;
}

// Generate hours from startHour to endHour
function generateHours(startHour: number, endHour: number): number[] {
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }
  return hours;
}

// Get position and height for an event based on time
function getEventPosition(event: CalendarEventDetail, startHour: number, endHour: number) {
  const start = event.startDateTime ? dayjs(event.startDateTime) : null;
  const end = event.endDateTime ? dayjs(event.endDateTime) : null;

  if (!start) return null;

  const startMinutes = start.hour() * 60 + start.minute();
  const endMinutes = end ? end.hour() * 60 + end.minute() : startMinutes + 30;

  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;
  const totalMinutes = gridEndMinutes - gridStartMinutes;

  const top = ((startMinutes - gridStartMinutes) / totalMinutes) * 100;
  const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

  return {
    top: `${Math.max(0, top)}%`,
    height: `${Math.min(100 - top, Math.max(height, 2))}%`,
  };
}

// Group events by day
function groupEventsByDay(events: CalendarEventDetail[], weekStart: dayjs.Dayjs) {
  const days: Record<string, CalendarEventDetail[]> = {};

  // Initialize 6 days (Mon-Sat)
  for (let i = 0; i < 6; i++) {
    const date = weekStart.add(i, "day").format("YYYY-MM-DD");
    days[date] = [];
  }

  events.forEach((event) => {
    const eventDate = event.startDateTime ? dayjs(event.startDateTime).format("YYYY-MM-DD") : event.startDate;

    if (eventDate && days[eventDate]) {
      days[eventDate].push(event);
    }
  });

  return days;
}

// Get category color class
function getCategoryClass(category: string | null | undefined): string {
  if (!category) return "event--default";
  const cat = category.toLowerCase();
  if (cat.includes("subcutáneo") || cat.includes("subcutaneo")) return "event--subcutaneous";
  if (cat.includes("test") || cat.includes("examen") || cat.includes("exámenes")) return "event--test";
  if (cat.includes("inyección") || cat.includes("inyeccion")) return "event--injection";
  if (cat.includes("mantención") || cat.includes("mantencion")) return "event--subcutaneous";
  return "event--default";
}

export function WeekGrid({ events, weekStart, loading, onEventClick }: WeekGridProps) {
  // Parse weekStart and get Monday of that week using ISO week (Monday = 1)
  const monday = useMemo(() => {
    const parsed = dayjs(weekStart);
    if (!parsed.isValid()) {
      // Fallback to current week's Monday
      return dayjs().isoWeekday(1);
    }
    // Get the Monday of the week containing this date
    return parsed.isoWeekday(1);
  }, [weekStart]);

  // Calculate time bounds based ONLY on events in this week
  const { startHour, endHour } = useMemo(() => {
    // Filter events to only those in the displayed week
    const weekEnd = monday.add(5, "day").endOf("day");
    const weekEvents = events.filter((event) => {
      if (!event.startDateTime) return false;
      const eventDate = dayjs(event.startDateTime);
      return eventDate.isAfter(monday.startOf("day")) && eventDate.isBefore(weekEnd);
    });

    // If no events in week, show reasonable default range
    if (weekEvents.length === 0) {
      return { startHour: 9, endHour: 18 };
    }

    let min = 23;
    let max = 0;

    weekEvents.forEach((event) => {
      if (event.startDateTime) {
        const hour = dayjs(event.startDateTime).hour();
        min = Math.min(min, hour);
      }
      if (event.endDateTime) {
        const endTime = dayjs(event.endDateTime);
        // If event ends exactly on the hour, use that hour; otherwise, use next hour
        const hour = endTime.minute() > 0 ? endTime.hour() + 1 : endTime.hour();
        max = Math.max(max, hour);
      } else if (event.startDateTime) {
        // No end time, assume 1 hour duration
        max = Math.max(max, dayjs(event.startDateTime).hour() + 1);
      }
    });

    // Add padding: 1 hour before first event, show until last event ends
    const paddedStart = Math.max(0, min - 1);
    const paddedEnd = Math.min(23, max);

    return { startHour: paddedStart, endHour: paddedEnd };
  }, [events, monday]);

  const hours = useMemo(() => generateHours(startHour, endHour), [startHour, endHour]);
  const eventsByDay = useMemo(() => groupEventsByDay(events, monday), [events, monday]);

  // Generate day headers
  const days = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = monday.add(i, "day");
      return {
        key: date.format("YYYY-MM-DD"),
        isoDate: date.format("YYYY-MM-DD"),
        dayName: date.format("ddd").toUpperCase(),
        fullDayName: date.format("dddd"),
        dayNumber: date.format("D"),
        isToday: date.isSame(dayjs(), "day"),
      };
    });
  }, [monday]);

  return (
    <div className={cn("week-grid", loading && "week-grid--loading")} role="grid" aria-label="Calendario semanal">
      {/* Header row */}
      <div className="week-grid__header" role="row">
        <div className="week-grid__time-header" role="columnheader" aria-label="Hora" />
        {days.map((day) => (
          <div
            key={day.key}
            className={cn("week-grid__day-header", day.isToday && "week-grid__day-header--today")}
            role="columnheader"
            aria-current={day.isToday ? "date" : undefined}
          >
            <abbr className="week-grid__day-name" title={day.fullDayName}>
              {day.dayName}
            </abbr>
            <time className="week-grid__day-number" dateTime={day.isoDate}>
              {day.dayNumber}
            </time>
          </div>
        ))}
      </div>

      {/* Time grid body */}
      <div className="week-grid__body">
        {/* Time axis */}
        <div className="week-grid__time-axis">
          {hours.map((hour) => (
            <div key={hour} className="week-grid__time-slot">
              <span className="week-grid__time-label">{String(hour).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => (
          <div key={day.key} className={cn("week-grid__day-column", day.isToday && "week-grid__day-column--today")}>
            {/* Hour grid lines */}
            {hours.map((hour) => (
              <div key={hour} className="week-grid__hour-cell" />
            ))}

            {/* Events */}
            <div className="week-grid__events">
              {eventsByDay[day.key]?.map((event) => {
                const position = getEventPosition(event, startHour, endHour);
                if (!position) return null;

                // Calculate duration to determine display mode
                const start = event.startDateTime ? dayjs(event.startDateTime) : null;
                const end = event.endDateTime ? dayjs(event.endDateTime) : null;
                const durationMinutes = start && end ? end.diff(start, "minute") : 30;

                // Display mode based on duration (prioritize showing TITLE, time is secondary)
                // Minimal: just title (time shown via position/tooltip)
                // Compact: time + title on one line
                // Normal: time + title (multi-line)
                // Detailed: time + title + amount
                type DisplayMode = "minimal" | "compact" | "normal" | "detailed";
                let displayMode: DisplayMode;
                if (durationMinutes < 20) {
                  displayMode = "minimal";
                } else if (durationMinutes < 45) {
                  displayMode = "compact";
                } else if (durationMinutes < 90) {
                  displayMode = "normal";
                } else {
                  displayMode = "detailed";
                }

                // Build tooltip text (always complete info)
                const timeStr = start ? start.format("HH:mm") : "";
                const endTimeStr = end ? end.format("HH:mm") : "";
                const amountStr = event.amountExpected != null ? currencyFormatter.format(event.amountExpected) : "";
                const tooltipLines = [event.summary || "(Sin título)", `${timeStr} - ${endTimeStr}`, amountStr].filter(
                  Boolean
                );

                // Title - prioritize this over time for readability
                const title = event.summary?.trim() || "(Sin título)";

                return (
                  <button
                    key={event.eventId}
                    className={cn("week-grid__event", getCategoryClass(event.category))}
                    style={{ top: position.top, height: position.height }}
                    onClick={() => onEventClick?.(event)}
                    type="button"
                    title={tooltipLines.join("\n")}
                    data-mode={displayMode}
                  >
                    {displayMode === "minimal" ? (
                      // Minimal: just title, very compact
                      <span className="week-grid__event-title">{title}</span>
                    ) : displayMode === "compact" ? (
                      // Compact: time + title on one line
                      <span className="week-grid__event-row">
                        <span className="week-grid__event-time">{timeStr}</span>
                        <span className="week-grid__event-title">{title}</span>
                      </span>
                    ) : displayMode === "normal" ? (
                      // Normal: time + title (stacked)
                      <>
                        <span className="week-grid__event-time">{timeStr}</span>
                        <span className="week-grid__event-title">{title}</span>
                      </>
                    ) : (
                      // Detailed: time + title + amount
                      <>
                        <span className="week-grid__event-time">{timeStr}</span>
                        <span className="week-grid__event-title">{title}</span>
                        {event.amountExpected != null && (
                          <span className="week-grid__event-amount">
                            {currencyFormatter.format(event.amountExpected)}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Now indicator */}
            {day.isToday && <NowIndicator startHour={startHour} endHour={endHour} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Current time indicator
function NowIndicator({ startHour, endHour }: { startHour: number; endHour: number }) {
  const now = dayjs();
  const currentMinutes = now.hour() * 60 + now.minute();
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;
  const totalMinutes = gridEndMinutes - gridStartMinutes;

  const position = ((currentMinutes - gridStartMinutes) / totalMinutes) * 100;

  if (position < 0 || position > 100) return null;

  return (
    <div className="week-grid__now-indicator" style={{ top: `${position}%` }}>
      <div className="week-grid__now-dot" />
      <div className="week-grid__now-line" />
    </div>
  );
}

export default WeekGrid;
