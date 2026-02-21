import { Tooltip } from "@heroui/react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CalendarEventDetail } from "../types";

dayjs.extend(isoWeek);

// TODO(calendar): normalize all calendar times to America/Santiago using @internationalized/date

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

interface DayInfo {
  dayName: string;
  dayNumber: string;
  fullDayName: string;
  isoDate: string;
  isToday: boolean;
  key: string;
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

  if (!start) {
    return null;
  }

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
      : event.startDate
        ? dayjs(event.startDate).format("YYYY-MM-DD")
        : null;

    // eslint-disable-next-line security/detect-object-injection -- eventDate is YYYY-MM-DD format, safe access
    if (eventDate && days[eventDate]) {
      days[eventDate].push(event); // eslint-disable-line security/detect-object-injection
    }
  }

  return days;
}

function resolveWeekMonday(weekStart: string) {
  const parsed = dayjs(weekStart);
  if (!parsed.isValid()) {
    return dayjs().isoWeekday(1);
  }
  return parsed.isoWeekday(1);
}

function isTodayInVisibleWeek(monday: dayjs.Dayjs, weekEnd: dayjs.Dayjs) {
  const now = dayjs();
  return now.isAfter(monday.startOf("day")) && now.isBefore(weekEnd);
}

function getWeekEventsInRange(
  events: CalendarEventDetail[],
  monday: dayjs.Dayjs,
  weekEnd: dayjs.Dayjs,
) {
  return events.filter((event) => {
    if (!event.startDateTime) {
      return false;
    }
    const eventDate = dayjs(event.startDateTime);
    return eventDate.isSameOrAfter(monday.startOf("day")) && eventDate.isBefore(weekEnd);
  });
}

function computeEventMaxHour(event: CalendarEventDetail) {
  if (event.endDateTime) {
    const endTime = dayjs(event.endDateTime);
    const startTime = event.startDateTime ? dayjs(event.startDateTime) : null;
    const crossesMidnight = startTime && endTime.isBefore(startTime);
    const isMidnight = endTime.hour() === 0 && endTime.minute() === 0;

    if (crossesMidnight || isMidnight) {
      return 24;
    }
    const roundedEndHour = endTime.minute() > 0 ? endTime.hour() + 1 : endTime.hour();
    return Math.min(24, roundedEndHour);
  }

  if (event.startDateTime) {
    return Math.min(24, dayjs(event.startDateTime).hour() + 1);
  }

  return 0;
}

function computeGridHourBounds(events: CalendarEventDetail[], monday: dayjs.Dayjs) {
  const businessStart = 9;
  const businessEnd = 20;
  const weekEnd = monday.add(5, "day").endOf("day");
  const now = dayjs();
  const isNowWithinBusiness = now.hour() >= businessStart && now.hour() <= businessEnd;
  const includeCurrentTime = isTodayInVisibleWeek(monday, weekEnd) && isNowWithinBusiness;
  const weekEvents = getWeekEventsInRange(events, monday, weekEnd);

  if (weekEvents.length === 0) {
    return { endHour: businessEnd, startHour: businessStart };
  }

  let min = includeCurrentTime ? now.hour() : 23;
  let max = includeCurrentTime ? now.hour() + 1 : 0;

  for (const event of weekEvents) {
    if (event.startDateTime) {
      min = Math.min(min, dayjs(event.startDateTime).hour());
    }
    max = Math.max(max, computeEventMaxHour(event));
  }

  const paddedStart = Math.max(0, min - 1);
  const paddedEnd = Math.min(24, max + 1);
  return {
    endHour: Math.max(paddedEnd, businessEnd),
    startHour: Math.min(paddedStart, businessStart),
  };
}

// Calculate layout for overlapping events
// Each cluster of overlapping events gets its own column count
// Non-overlapping events get full width (1 column)
const MAX_COLUMNS = 6;

export function WeekGrid({ events, loading, onEventClick, weekStart }: Readonly<WeekGridProps>) {
  const [tooltipTrigger, setTooltipTrigger] = useState<"hover" | "focus">("hover");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setTooltipTrigger(canHover ? "hover" : "focus");
  }, []);

  const monday = resolveWeekMonday(weekStart);
  const { endHour, startHour } = computeGridHourBounds(events, monday);

  const hours = generateHours(startHour, endHour);
  const eventsByDay = groupEventsByDay(events, monday);
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
        "flex h-[min(100svh-220px,800px)] min-h-130 flex-col overflow-hidden rounded-2xl border border-default-200 bg-content1 shadow-sm",
        loading && "pointer-events-none opacity-50 grayscale-[0.3]",
      )}
      role="none"
    >
      <div className="muted-scrollbar flex-1 touch-auto overflow-auto overscroll-contain">
        <div className="min-w-270">
          <WeekGridHeader days={days} />

          <div className="grid min-h-100 grid-cols-[52px_repeat(6,1fr)]">
            <TimeAxis hours={hours} />

            {days.map((day) => (
              <DayColumn
                day={day}
                endHour={endHour}
                events={eventsByDay[day.key] ?? []}
                hours={hours}
                key={day.key}
                onEventClick={onEventClick}
                startHour={startHour}
                tooltipTrigger={tooltipTrigger}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function WeekGridHeader({ days }: { days: DayInfo[] }) {
  return (
    <div className="sticky top-0 z-15 grid grid-cols-[52px_repeat(6,1fr)] border-default-200 border-b bg-content2/60 backdrop-blur-md">
      <div className="border-default-200 border-r" />
      {days.map((day) => (
        <div
          aria-current={day.isToday ? "date" : undefined}
          className={cn(
            "flex flex-col items-center justify-center gap-1 border-default-200 border-r px-1 py-3 text-center last:border-r-0 sm:py-4",
            day.isToday && "relative border-primary border-t-4 bg-primary/20",
          )}
          key={day.key}
        >
          <abbr
            className="font-bold text-[0.65rem] text-foreground-400 uppercase tracking-wider"
            title={day.fullDayName}
          >
            {day.dayName}
          </abbr>
          <time
            className={cn(
              "font-extrabold text-foreground text-xl leading-none sm:text-2xl",
              day.isToday &&
                "grid size-10 place-items-center rounded-full bg-primary font-black text-primary-foreground text-xl shadow-lg shadow-primary/40",
            )}
            dateTime={day.isoDate}
          >
            {day.dayNumber}
          </time>
        </div>
      ))}
    </div>
  );
}

function TimeAxis({ hours }: { hours: number[] }) {
  return (
    <div className="border-default-200 border-r bg-content2/40">
      {hours.map((hour) => (
        <div
          className="flex h-13 items-start justify-end border-default-100 border-b pr-2"
          key={hour}
        >
          <span className="-translate-y-1/2 font-medium text-[0.7rem] text-foreground-500 tabular-nums">
            {String(hour).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </div>
  );
}

interface DayColumnProps {
  day: DayInfo;
  endHour: number;
  events: CalendarEventDetail[];
  hours: number[];
  onEventClick?: (event: CalendarEventDetail) => void;
  startHour: number;
  tooltipTrigger: "hover" | "focus";
}

function DayColumn({
  day,
  endHour,
  events,
  hours,
  onEventClick,
  startHour,
  tooltipTrigger,
}: DayColumnProps) {
  return (
    <div
      className={cn(
        "relative min-h-full overflow-hidden border-default-100 border-r last:border-r-0",
        day.isToday && "bg-primary/5",
      )}
    >
      {/* Hour grid lines */}
      {hours.map((hour) => (
        <div className="h-13 border-default-200/50 border-b" key={hour} />
      ))}

      {/* Events */}
      <div className="absolute inset-0 isolate z-5 overflow-visible px-0.5">
        {calculateEventLayout(events).map((event) => (
          <EventItem
            endHour={endHour}
            event={event}
            key={event.eventId}
            onEventClick={onEventClick}
            startHour={startHour}
            tooltipTrigger={tooltipTrigger}
          />
        ))}
      </div>

      {/* Now indicator */}
      {day.isToday && <NowIndicator endHour={endHour} startHour={startHour} />}
    </div>
  );
}

interface EventItemProps {
  endHour: number;
  event: EventWithLayout;
  onEventClick?: (event: CalendarEventDetail) => void;
  startHour: number;
  tooltipTrigger: "hover" | "focus";
}

type DisplayMode = "compact" | "detailed" | "minimal" | "normal";

function getDisplayMode(durationMinutes: number): DisplayMode {
  if (durationMinutes < 20) {
    return "minimal";
  }
  if (durationMinutes < 45) {
    return "compact";
  }
  if (durationMinutes < 90) {
    return "normal";
  }
  return "detailed";
}

function getEventDisplayTimes(event: CalendarEventDetail) {
  const start = event.startDateTime ? dayjs(event.startDateTime) : null;
  const end = event.endDateTime ? dayjs(event.endDateTime) : null;
  const durationMinutes = start && end ? end.diff(start, "minute") : 30;

  return {
    durationMinutes,
    end,
    endTimeStr: end ? end.format("HH:mm") : "",
    start,
    timeStr: start ? start.format("HH:mm") : "",
  };
}

function getEventButtonClasses(displayMode: DisplayMode, category: string | null) {
  return cn(
    "absolute z-1 flex min-h-5 flex-col justify-start gap-px overflow-hidden text-wrap rounded-md border-l-[3px] px-1.5 py-1 text-start shadow-sm transition-shadow hover:z-10 hover:shadow-md",
    getCategoryClass(category),
    displayMode === "minimal" && "items-center justify-center px-[0.3rem] py-[0.1rem]",
    displayMode === "compact" && "px-[0.35rem] py-[0.15rem]",
    displayMode === "normal" && "px-[0.4rem] py-[0.2rem]",
    displayMode === "detailed" && "px-[0.45rem] py-1",
  );
}

function buildEventTooltipContent({
  amountStr,
  controlFlag,
  endTimeStr,
  timeStr,
  title,
}: {
  amountStr: string;
  controlFlag: boolean;
  endTimeStr: string;
  timeStr: string;
  title: string;
}) {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-default-600">
        {timeStr} - {endTimeStr}
      </p>
      {amountStr && <p className="text-default-600">{amountStr}</p>}
      {controlFlag && <p className="text-default-600">Control</p>}
    </div>
  );
}

function EventButtonContent({
  amountExpected,
  controlFlag,
  displayMode,
  timeStr,
  title,
}: {
  amountExpected: number | null | undefined;
  controlFlag: boolean;
  displayMode: DisplayMode;
  timeStr: string;
  title: string;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-[0.3rem] overflow-hidden">
        <span
          className={cn(
            "shrink-0 font-bold tabular-nums opacity-75",
            displayMode === "minimal" && "hidden",
            (displayMode === "compact" || displayMode === "normal") && "text-[0.6rem]",
            displayMode === "detailed" && "text-[0.65rem]",
          )}
        >
          {timeStr}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight",
            displayMode === "minimal" && "line-clamp-1 text-[0.55rem]",
            displayMode === "compact" && "text-[0.55rem]",
            displayMode === "normal" && "line-clamp-2 text-[0.6rem]",
            displayMode === "detailed" && "line-clamp-2 text-[0.65rem]",
          )}
        >
          {title}
        </span>
        {controlFlag && displayMode !== "minimal" && (
          <span className="shrink-0 rounded-full bg-warning-500/20 px-1 font-bold text-[0.5rem] text-warning-700 uppercase">
            Ctrl
          </span>
        )}
      </span>
      {displayMode === "detailed" && amountExpected != null && (
        <span className="mt-auto overflow-hidden text-ellipsis whitespace-nowrap font-bold text-[0.6rem] text-success-600">
          {currencyFormatter.format(amountExpected)}
        </span>
      )}
    </>
  );
}

function EventItem({ endHour, event, onEventClick, startHour, tooltipTrigger }: EventItemProps) {
  const position = getEventPosition(event, startHour, endHour);
  if (!position) {
    return null;
  }

  const { durationMinutes, endTimeStr, timeStr } = getEventDisplayTimes(event);
  const displayMode = getDisplayMode(durationMinutes);
  const amountStr =
    event.amountExpected == null ? "" : currencyFormatter.format(event.amountExpected);
  const controlFlag = event.controlIncluded === true;
  const title = event.summary?.trim() ?? "(Sin título)";

  const padding = event.totalColumns > 1 ? 2 : 3;
  const columnWidth = 100 / event.totalColumns;
  const leftPos = event.column * columnWidth;

  const eventButton = (
    <Button
      className={getEventButtonClasses(displayMode, event.category ?? null)}
      onPress={() => onEventClick?.(event)}
      size="sm"
      style={{
        height: position.height,
        left: `calc(${leftPos}% + ${padding}px)`,
        top: position.top,
        width: `calc(${columnWidth}% - ${padding * 2}px)`,
      }}
      variant="ghost"
    >
      <EventButtonContent
        amountExpected={event.amountExpected}
        controlFlag={controlFlag}
        displayMode={displayMode}
        timeStr={timeStr}
        title={title}
      />
    </Button>
  );

  return (
    <Tooltip delay={0} isDisabled={tooltipTrigger === "focus"} trigger={tooltipTrigger}>
      <Tooltip.Trigger>{eventButton}</Tooltip.Trigger>
      <Tooltip.Content
        className="bg-content1 text-foreground border-default-200"
        placement="top"
        showArrow
      >
        {buildEventTooltipContent({
          amountStr,
          controlFlag,
          endTimeStr,
          timeStr,
          title,
        })}
      </Tooltip.Content>
    </Tooltip>
  );
}

// --- Layout Utilities ---

function sortEventsForLayout(events: CalendarEventDetail[]) {
  return [...events].toSorted((a, b) => {
    const { start: startA, end: endA } = getEventTimes(a);
    const { start: startB, end: endB } = getEventTimes(b);
    const startDiff = startA - startB;
    if (startDiff !== 0) {
      return startDiff;
    }
    return endB - startB - (endA - startA);
  });
}

function buildOverlapClusters(sortedEvents: CalendarEventDetail[]) {
  const clusters: CalendarEventDetail[][] = [];

  for (const event of sortedEvents) {
    let added = false;
    for (const cluster of clusters) {
      if (cluster.some((existing) => eventsOverlap(existing, event))) {
        cluster.push(event);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push([event]);
    }
  }

  return clusters;
}

function assignColumnsForCluster(cluster: CalendarEventDetail[]): EventWithLayout[] {
  cluster.sort((a, b) => getEventTimes(a).start - getEventTimes(b).start);

  const columns: number[] = [];
  const clusterEvents: { column: number; event: CalendarEventDetail }[] = [];

  for (const event of cluster) {
    const { start, end } = getEventTimes(event);
    let colIndex = columns.findIndex((colEnd) => start >= colEnd);

    if (colIndex === -1) {
      colIndex = columns.length;
      columns.push(end);
    } else {
      columns[colIndex] = end; // eslint-disable-line security/detect-object-injection
    }
    clusterEvents.push({ column: colIndex, event });
  }

  const totalColumns = Math.min(columns.length, MAX_COLUMNS);
  return clusterEvents.map(({ column, event }) => ({
    ...event,
    column: Math.min(column, MAX_COLUMNS - 1),
    totalColumns,
  }));
}

function getEventTimes(event: CalendarEventDetail) {
  const start = dayjs(event.startDateTime).valueOf();
  let end: number;

  if (event.endDateTime) {
    const endDt = dayjs(event.endDateTime);
    const startDt = dayjs(event.startDateTime);
    // Handle midnight crossing
    if (endDt.isBefore(startDt) || endDt.isSame(startDt)) {
      end = startDt.add(1, "day").startOf("day").valueOf();
    } else {
      end = endDt.valueOf();
    }
  } else {
    end = start + 30 * 60 * 1000;
  }

  return { end, start };
}

function eventsOverlap(a: CalendarEventDetail, b: CalendarEventDetail): boolean {
  const { end: endA, start: startA } = getEventTimes(a);
  const { end: endB, start: startB } = getEventTimes(b);
  return startA < endB && endA > startB;
}

function calculateEventLayout(events: CalendarEventDetail[]): EventWithLayout[] {
  if (events.length === 0) {
    return [];
  }

  const sorted = sortEventsForLayout(events);
  const clusters = buildOverlapClusters(sorted);
  return clusters.flatMap((cluster) => assignColumnsForCluster(cluster));
}

// Get category color class
function getCategoryClass(category: null | string | undefined): string {
  const baseClasses = "border-l-3";
  if (!category) {
    return cn(baseClasses, "bg-content2 border-divider text-foreground");
  }

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

  if (position < 0 || position > 100) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top: `${position}%` }}
      title={`Hora actual: ${now.format("HH:mm")}`}
    >
      <div className="-ml-1.25 size-2.5 animate-pulse rounded-full bg-danger shadow-[0_0_8px] shadow-danger/50" />
      <div className="h-0.5 flex-1 bg-danger" />
    </div>
  );
}
