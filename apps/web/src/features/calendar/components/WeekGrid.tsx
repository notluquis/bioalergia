import "./WeekGrid.css";

import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useState } from "react";

import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CalendarEventDetail } from "../types";

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
  let endMinutes = end ? end.hour() * 60 + end.minute() : startMinutes + 30;

  // Handle events that cross midnight (end time is "earlier" than start time)
  // Treat them as ending at 24:00 for grid display purposes
  if (end && endMinutes <= startMinutes) {
    // End is on next day - cap at midnight (24:00 = 1440 minutes)
    endMinutes = 24 * 60;
  }

  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;
  const totalMinutes = gridEndMinutes - gridStartMinutes;

  const top = ((startMinutes - gridStartMinutes) / totalMinutes) * 100;
  const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

  // Ensure minimum height for visibility (at least 3%)
  const minHeight = 3;

  return {
    top: `${Math.max(0, top)}%`,
    height: `${Math.min(100 - Math.max(0, top), Math.max(height, minHeight))}%`,
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

// Event with layout info for overlapping display
interface EventWithLayout extends CalendarEventDetail {
  column: number;
  totalColumns: number;
}

// Calculate layout for overlapping events
// Each cluster of overlapping events gets its own column count
// Non-overlapping events get full width (1 column)
const MAX_COLUMNS = 6;

function calculateEventLayout(events: CalendarEventDetail[]): EventWithLayout[] {
  if (events.length === 0) return [];

  // Helper to get event times in ms
  const getStartMs = (event: CalendarEventDetail): number => {
    return dayjs(event.startDateTime).valueOf();
  };

  const getEndMs = (event: CalendarEventDetail): number => {
    if (event.endDateTime) {
      const end = dayjs(event.endDateTime);
      const start = dayjs(event.startDateTime);
      // Handle midnight crossing
      if (end.isBefore(start) || end.isSame(start)) {
        return start.add(1, "day").startOf("day").valueOf();
      }
      return end.valueOf();
    }
    return dayjs(event.startDateTime).valueOf() + 30 * 60 * 1000;
  };

  // Check if two events overlap
  const eventsOverlap = (a: CalendarEventDetail, b: CalendarEventDetail): boolean => {
    const startA = getStartMs(a);
    const endA = getEndMs(a);
    const startB = getStartMs(b);
    const endB = getEndMs(b);
    return startA < endB && endA > startB;
  };

  // Sort by start time, then by duration (longer first)
  const sorted = [...events].sort((a, b) => {
    const startDiff = getStartMs(a) - getStartMs(b);
    if (startDiff !== 0) return startDiff;
    return getEndMs(b) - getStartMs(b) - (getEndMs(a) - getStartMs(a));
  });

  // Group events into overlapping clusters
  const clusters: CalendarEventDetail[][] = [];

  for (const event of sorted) {
    // Find a cluster this event overlaps with
    let addedToCluster = false;

    for (const cluster of clusters) {
      // Check if event overlaps with ANY event in this cluster
      if (cluster.some((e) => eventsOverlap(e, event))) {
        cluster.push(event);
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      // Start a new cluster
      clusters.push([event]);
    }
  }

  // Process each cluster independently
  const result: EventWithLayout[] = [];

  for (const cluster of clusters) {
    // Sort cluster by start time
    cluster.sort((a, b) => getStartMs(a) - getStartMs(b));

    // Assign columns within this cluster
    const columns: number[] = []; // end times per column
    const clusterEvents: { event: CalendarEventDetail; column: number }[] = [];

    for (const event of cluster) {
      const start = getStartMs(event);
      const end = getEndMs(event);

      // Find first available column
      let columnIndex = columns.findIndex((colEnd) => start >= colEnd);

      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push(end);
      } else {
        columns[columnIndex] = end;
      }

      clusterEvents.push({ event, column: columnIndex });
    }

    // Total columns for THIS cluster (capped at MAX)
    const totalColumns = Math.min(columns.length, MAX_COLUMNS);

    // Add to result with cluster-specific column count
    for (const { event, column } of clusterEvents) {
      result.push({
        ...event,
        column: Math.min(column, MAX_COLUMNS - 1),
        totalColumns,
      });
    }
  }

  return result;
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
  const monday = (() => {
    const parsed = dayjs(weekStart);
    if (!parsed.isValid()) {
      // Fallback to current week's Monday
      return dayjs().isoWeekday(1);
    }
    // Get the Monday of the week containing this date
    return parsed.isoWeekday(1);
  })();

  // Calculate time bounds based based on events AND current time
  const { startHour, endHour } = (() => {
    // Filter events to only those in the displayed week (Mon-Sat)
    const weekEnd = monday.add(5, "day").endOf("day");

    // Check if we need to include current time (if today is in range)
    const now = dayjs();
    const isTodayInView = now.isAfter(monday.startOf("day")) && now.isBefore(weekEnd);

    const weekEvents = events.filter((event) => {
      if (!event.startDateTime) return false;
      const eventDate = dayjs(event.startDateTime);
      // Use isSameOrAfter for start of week to include events on Monday
      return eventDate.isSameOrAfter(monday.startOf("day")) && eventDate.isBefore(weekEnd);
    });

    // If no events in week, show reasonable default range
    if (weekEvents.length === 0) {
      if (isTodayInView) {
        // Show a window around current time if we have no events
        return {
          startHour: Math.max(0, now.hour() - 2),
          endHour: Math.min(24, now.hour() + 4),
        };
      }
      return { startHour: 9, endHour: 18 };
    }

    let min = 23;
    let max = 0;

    // Expand to show current time if today is in view
    if (isTodayInView) {
      min = Math.min(min, now.hour());
      max = Math.max(max, now.hour() + 1);
    }

    weekEvents.forEach((event) => {
      if (event.startDateTime) {
        const hour = dayjs(event.startDateTime).hour();
        min = Math.min(min, hour);
        // Also track start hour for max (event needs to be visible)
        max = Math.max(max, hour);
      }
      if (event.endDateTime) {
        const endTime = dayjs(event.endDateTime);
        const startTime = event.startDateTime ? dayjs(event.startDateTime) : null;

        // Check if event crosses midnight (end is on different day or is midnight)
        const crossesMidnight = startTime && endTime.isBefore(startTime);
        const isMidnight = endTime.hour() === 0 && endTime.minute() === 0;

        if (crossesMidnight || isMidnight) {
          // Event ends at or after midnight - show grid until 24:00
          max = 24;
        } else {
          // Normal case: round up to next hour if has minutes
          const hour = endTime.minute() > 0 ? endTime.hour() + 1 : endTime.hour();
          max = Math.max(max, Math.min(24, hour));
        }
      } else if (event.startDateTime) {
        // No end time, assume 1 hour duration
        const startHour = dayjs(event.startDateTime).hour();
        max = Math.max(max, Math.min(24, startHour + 1));
      }
    });

    // Add padding: 1 hour before first event, 1 hour after last event
    const paddedStart = Math.max(0, min - 1);
    const paddedEnd = Math.min(24, max + 1); // Allow extending to 24 (midnight)

    return { startHour: paddedStart, endHour: paddedEnd };
  })();

  const hours = generateHours(startHour, endHour);
  const eventsByDay = groupEventsByDay(events, monday);

  // Generate day headers
  const days = Array.from({ length: 6 }, (_, i) => {
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
              {calculateEventLayout(eventsByDay[day.key] || []).map((event) => {
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

                // Calculate width and left based on column layout
                const padding = 3; // pixels on each side
                const totalWidth = 100; // percentage
                const columnWidth = totalWidth / event.totalColumns;
                const leftPos = event.column * columnWidth;

                return (
                  <button
                    key={event.eventId}
                    className={cn("week-grid__event", getCategoryClass(event.category))}
                    style={{
                      top: position.top,
                      height: position.height,
                      width: `calc(${columnWidth}% - ${padding * 2}px)`,
                      left: `calc(${leftPos}% + ${padding}px)`,
                    }}
                    onClick={() => onEventClick?.(event)}
                    type="button"
                    title={tooltipLines.join("\n")}
                    data-mode={displayMode}
                  >
                    {displayMode === "minimal" ? (
                      // Minimal: time + title inline, very compact
                      <span className="week-grid__event-row">
                        <span className="week-grid__event-time">{timeStr}</span>
                        <span className="week-grid__event-title">{title}</span>
                      </span>
                    ) : displayMode === "compact" ? (
                      // Compact: time + title on one line
                      <span className="week-grid__event-row">
                        <span className="week-grid__event-time">{timeStr}</span>
                        <span className="week-grid__event-title">{title}</span>
                      </span>
                    ) : displayMode === "normal" ? (
                      // Normal: time + title inline
                      <span className="week-grid__event-row">
                        <span className="week-grid__event-time">{timeStr}</span>
                        <span className="week-grid__event-title">{title}</span>
                      </span>
                    ) : (
                      // Detailed: time + title inline, then amount below
                      <>
                        <span className="week-grid__event-row">
                          <span className="week-grid__event-time">{timeStr}</span>
                          <span className="week-grid__event-title">{title}</span>
                        </span>
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

// Current time indicator - Live Updating
function NowIndicator({ startHour, endHour }: { startHour: number; endHour: number }) {
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    // Initial update to sync
    setNow(dayjs());
    // Update every minute
    const timer = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = now.hour() * 60 + now.minute();
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;
  const totalMinutes = gridEndMinutes - gridStartMinutes;

  const position = ((currentMinutes - gridStartMinutes) / totalMinutes) * 100;

  if (position < 0 || position > 100) return null;

  return (
    <div
      className="week-grid__now-indicator"
      style={{ top: `${position}%` }}
      title={`Hora actual: ${now.format("HH:mm")}`}
    >
      <div className="week-grid__now-dot" />
      <div className="week-grid__now-line" />
    </div>
  );
}

export default WeekGrid;
