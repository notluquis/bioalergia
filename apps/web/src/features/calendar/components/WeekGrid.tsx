import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useState } from "react";

import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CalendarEventDetail } from "../types";

dayjs.extend(isoWeek);

// Event with layout info for overlapping display
interface EventWithLayout extends CalendarEventDetail {
  column: number;
  totalColumns: number;
}

interface WeekGridProps {
  events: CalendarEventDetail[];
  loading?: boolean;
  onEventClick?: (event: CalendarEventDetail) => void;
  weekStart: string; // YYYY-MM-DD of Monday
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
    height: `${Math.min(100 - Math.max(0, top), Math.max(height, minHeight))}%`,
    top: `${Math.max(0, top)}%`,
  };
}

// Group events by day
function groupEventsByDay(events: CalendarEventDetail[], weekStart: dayjs.Dayjs) {
  const days: Record<string, CalendarEventDetail[]> = {};

  // Initialize 6 days (Mon-Sat)
  for (let i = 0; i < 6; i++) {
    const date = weekStart.add(i, "day").format("YYYY-MM-DD");
    days[date] = []; // eslint-disable-line security/detect-object-injection
  }

  for (const event of events) {
    const eventDate = event.startDateTime
      ? dayjs(event.startDateTime).format("YYYY-MM-DD")
      : event.startDate;

    // eslint-disable-next-line security/detect-object-injection -- eventDate is YYYY-MM-DD format, safe access
    if (eventDate && days[eventDate]) {
      days[eventDate].push(event); // eslint-disable-line security/detect-object-injection
    }
  }

  return days;
}

// Calculate layout for overlapping events
// Each cluster of overlapping events gets its own column count
// Non-overlapping events get full width (1 column)
const MAX_COLUMNS = 6;

export function WeekGrid({ events, loading, onEventClick, weekStart }: Readonly<WeekGridProps>) {
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
  // eslint-disable-next-line sonarjs/cognitive-complexity
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy time calculation
  const { endHour, startHour } = (() => {
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
          endHour: Math.min(24, now.hour() + 4),
          startHour: Math.max(0, now.hour() - 2),
        };
      }
      return { endHour: 18, startHour: 9 };
    }

    let min = 23;
    let max = 0;

    // Expand to show current time if today is in view
    if (isTodayInView) {
      min = Math.min(min, now.hour());
      max = Math.max(max, now.hour() + 1);
    }

    for (const event of weekEvents) {
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
    }

    // Add padding: 1 hour before first event, 1 hour after last event
    const paddedStart = Math.max(0, min - 1);
    const paddedEnd = Math.min(24, max + 1); // Allow extending to 24 (midnight)

    return { endHour: paddedEnd, startHour: paddedStart };
  })();

  const hours = generateHours(startHour, endHour);
  const eventsByDay = groupEventsByDay(events, monday);

  // Generate day headers
  const days = Array.from({ length: 6 }, (_, i) => {
    const date = monday.add(i, "day");
    return {
      dayName: date.format("ddd").toUpperCase(),
      dayNumber: date.format("D"),
      fullDayName: date.format("dddd"),
      isoDate: date.format("YYYY-MM-DD"),
      isToday: date.isSame(dayjs(), "day"),
      key: date.format("YYYY-MM-DD"),
    };
  });

  return (
    <div
      className={cn(
        "bg-content1 border-default-200 flex h-[min(100dvh-220px,800px)] flex-col overflow-hidden rounded-2xl border shadow-sm",
        loading && "pointer-events-none opacity-50 grayscale-[0.3]",
      )}
      role="none"
    >
      {/* Header row */}
      {/* biome-ignore lint/a11y/useSemanticElements: grid layout */}
      <div
        className="border-default-200 bg-content2/60 grid grid-cols-[52px_repeat(6,1fr)] border-b backdrop-blur-md"
        role="row"
        tabIndex={0}
      >
        <div className="border-default-200 border-r" />
        {days.map((day) => (
          // biome-ignore lint/a11y/useSemanticElements: grid layout
          <div
            aria-current={day.isToday ? "date" : undefined}
            className={cn(
              "border-default-200 flex flex-col items-center justify-center gap-1 border-r px-1 py-3 text-center last:border-r-0",
              day.isToday && "bg-primary/20 border-t-4 border-primary relative",
            )}
            key={day.key}
            role="columnheader"
            tabIndex={0}
          >
            <abbr
              className="text-foreground-400 text-[0.65rem] font-bold uppercase tracking-wider"
              title={day.fullDayName}
            >
              {day.dayName}
            </abbr>
            <time
              className={cn(
                "text-foreground text-2xl font-extrabold leading-none",
                day.isToday &&
                  "bg-primary text-primary-foreground grid size-10 place-items-center rounded-full text-xl font-black shadow-lg shadow-primary/40",
              )}
              dateTime={day.isoDate}
            >
              {day.dayNumber}
            </time>
          </div>
        ))}
      </div>

      {/* Time grid body */}
      <div className="grid min-h-100 grid-cols-[52px_repeat(6,1fr)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-default-200 hover:scrollbar-thumb-default-300">
        {/* Time axis */}
        <div className="border-default-200 bg-content2/40 border-r">
          {hours.map((hour) => (
            <div
              className="border-default-100 flex h-13 items-start justify-end border-b pr-2"
              key={hour}
            >
              <span className="text-foreground-500 -translate-y-1/2 text-[0.7rem] font-medium tabular-nums">
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => (
          <div
            className={cn(
              "border-default-100 relative min-h-full overflow-visible border-r last:border-r-0",
              day.isToday && "bg-primary/5",
            )}
            key={day.key}
          >
            {/* Hour grid lines */}
            {hours.map((hour) => (
              <div className="border-default-200/50 h-13 border-b" key={hour} />
            ))}

            {/* Events */}
            <div className="absolute inset-0 z-5 isolate overflow-visible px-0.5">
              {}
              {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy rendering */}
              {calculateEventLayout(eventsByDay[day.key] ?? []).map((event) => {
                const position = getEventPosition(event, startHour, endHour);
                if (!position) return null;

                // Calculate duration to determine display mode
                const start = event.startDateTime ? dayjs(event.startDateTime) : null;
                const end = event.endDateTime ? dayjs(event.endDateTime) : null;
                const durationMinutes = start && end ? end.diff(start, "minute") : 30;

                // Display mode based on duration (prioritize showing TITLE, time is secondary)
                type DisplayMode = "compact" | "detailed" | "minimal" | "normal";
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
                const amountStr =
                  event.amountExpected == null
                    ? ""
                    : currencyFormatter.format(event.amountExpected);
                const tooltipLines = [
                  event.summary ?? "(Sin título)",
                  `${timeStr} - ${endTimeStr}`,
                  amountStr,
                ].filter(Boolean);

                // Title - prioritize this over time for readability
                const title = event.summary?.trim() ?? "(Sin título)";

                // Calculate width and left based on column layout
                const padding = 3; // pixels on each side
                const totalWidth = 100; // percentage
                const columnWidth = totalWidth / event.totalColumns;
                const leftPos = event.column * columnWidth;

                return (
                  <button
                    className={cn(
                      "absolute z-1 flex min-h-5 flex-col justify-start gap-px overflow-hidden wrap-break-word rounded-md border-l-[3px] px-1.5 py-1 text-start shadow-sm transition-transform hover:z-100 hover:-translate-y-px hover:scale-[1.02] hover:overflow-visible hover:py-1.5 hover:shadow-lg",
                      getCategoryClass(event.category),
                      // Display modes
                      displayMode === "minimal" &&
                        "items-center justify-center px-[0.3rem] py-[0.1rem]",
                      displayMode === "compact" && "px-[0.35rem] py-[0.15rem]",
                      displayMode === "normal" && "px-[0.4rem] py-[0.2rem]",
                      displayMode === "detailed" && "px-[0.45rem] py-1",
                    )}
                    key={event.eventId}
                    onClick={() => onEventClick?.(event)}
                    style={{
                      height: position.height,
                      left: `calc(${leftPos}% + ${padding}px)`,
                      top: position.top,
                      width: `calc(${columnWidth}% - ${padding * 2}px)`,
                    }}
                    title={tooltipLines.join("\n")}
                    type="button"
                  >
                    {(() => {
                      switch (displayMode) {
                        case "compact":
                        case "minimal":
                        case "normal": {
                          return (
                            <span className="flex min-w-0 items-center gap-[0.3rem] overflow-hidden">
                              <span
                                className={cn(
                                  "shrink-0 font-bold tabular-nums opacity-75",
                                  displayMode === "minimal" && "hidden",
                                  displayMode === "compact" && "text-[0.55rem]",
                                  displayMode === "normal" && "text-[0.6rem]",
                                )}
                              >
                                {timeStr}
                              </span>
                              <span
                                className={cn(
                                  "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight",
                                  displayMode === "minimal" &&
                                    "line-clamp-1 whitespace-nowrap text-[0.55rem]",
                                  displayMode === "compact" && "text-[0.55rem]",
                                  displayMode === "normal" && "line-clamp-2 text-[0.6rem]",
                                )}
                              >
                                {title}
                              </span>
                            </span>
                          );
                        }
                        default: {
                          return (
                            <>
                              <span className="flex min-w-0 items-center gap-[0.3rem] overflow-hidden">
                                <span className="shrink-0 text-[0.65rem] font-bold tabular-nums opacity-75">
                                  {timeStr}
                                </span>
                                <span className="line-clamp-2 text-[0.65rem] font-semibold leading-tight">
                                  {title}
                                </span>
                              </span>
                              {event.amountExpected != null && (
                                <span className="text-success-600 mt-auto overflow-hidden text-ellipsis whitespace-nowrap text-[0.6rem] font-bold">
                                  {currencyFormatter.format(event.amountExpected)}
                                </span>
                              )}
                            </>
                          );
                        }
                      }
                    })()}
                  </button>
                );
              })}
            </div>

            {/* Now indicator */}
            {day.isToday && <NowIndicator endHour={endHour} startHour={startHour} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy layout logic
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
  const sorted = [...events].toSorted((a, b) => {
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
    const clusterEvents: { column: number; event: CalendarEventDetail }[] = [];

    for (const event of cluster) {
      const start = getStartMs(event);
      const end = getEndMs(event);

      // Find first available column
      let columnIndex = columns.findIndex((colEnd) => start >= colEnd);

      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push(end);
      } else {
        columns[columnIndex] = end; // eslint-disable-line security/detect-object-injection
      }

      clusterEvents.push({ column: columnIndex, event });
    }

    // Total columns for THIS cluster (capped at MAX)
    const totalColumns = Math.min(columns.length, MAX_COLUMNS);

    // Add to result with cluster-specific column count
    for (const { column, event } of clusterEvents) {
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
function getCategoryClass(category: null | string | undefined): string {
  const baseClasses = "border-l-3";
  if (!category) return cn(baseClasses, "bg-content2 border-divider text-foreground");

  const cat = category.toLowerCase();

  if (cat.includes("subcutáneo") || cat.includes("subcutaneo")) {
    return cn(
      baseClasses,
      "bg-sky-100 text-sky-900 border-sky-500 dark:bg-sky-900/30 dark:text-sky-100",
    );
  }

  if (cat.includes("test") || cat.includes("examen") || cat.includes("exámenes")) {
    return cn(
      baseClasses,
      "bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-100",
    );
  }

  if (cat.includes("inyección") || cat.includes("inyeccion")) {
    return cn(
      baseClasses,
      "bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-900/30 dark:text-amber-100",
    );
  }

  if (cat.includes("mantención") || cat.includes("mantencion")) {
    return cn(
      baseClasses,
      "bg-sky-100 text-sky-900 border-sky-500 dark:bg-sky-900/30 dark:text-sky-100",
    );
  }

  return cn(baseClasses, "bg-content2 border-divider text-foreground");
}

// Current time indicator - Live Updating
function NowIndicator({ endHour, startHour }: Readonly<{ endHour: number; startHour: number }>) {
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    // Initial update to sync
    setNow(dayjs());
    // Update every minute
    const timer = setInterval(() => {
      setNow(dayjs());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const currentMinutes = now.hour() * 60 + now.minute();
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = (endHour + 1) * 60;
  const totalMinutes = gridEndMinutes - gridStartMinutes;

  const position = ((currentMinutes - gridStartMinutes) / totalMinutes) * 100;

  if (position < 0 || position > 100) return null;

  return (
    <div
      className="absolute inset-x-0 z-20 flex items-center pointer-events-none"
      style={{ top: `${position}%` }}
      title={`Hora actual: ${now.format("HH:mm")}`}
    >
      <div className="bg-danger shadow-danger/50 -ml-1.25 size-2.5 animate-pulse rounded-full shadow-[0_0_8px]" />
      <div className="bg-danger h-0.5 flex-1" />
    </div>
  );
}

export default WeekGrid;
