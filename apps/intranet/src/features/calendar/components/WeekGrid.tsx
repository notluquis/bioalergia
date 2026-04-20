import { Button, Tooltip } from "@heroui/react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { toTitleCase } from "@/lib/person";
import { cn } from "@/lib/utils";

import type { CalendarEventDetail } from "../types";

dayjs.extend(isoWeek);

const DISPLAY_TZ = "America/Santiago";

// All event times arrive as UTC ISO strings (e.g. "2026-04-21T15:00:00.000Z").
// Parse as UTC first, THEN convert to Chile local — `dayjs.tz(str, zone)`
// silently reinterprets the wall-clock of a Z-suffixed string as that zone,
// which drops the offset and shifts displayed times by +4h.
function toLocal(input: null | string | undefined) {
  if (!input) return null;
  const d = dayjs.utc(input).tz(DISPLAY_TZ);
  return d.isValid() ? d : null;
}

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
  const start = toLocal(event.startDateTime);
  const end = toLocal(event.endDateTime);

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
      ? (toLocal(event.startDateTime)?.format("YYYY-MM-DD") ?? null)
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
  weekEnd: dayjs.Dayjs
) {
  return events.filter((event) => {
    if (!event.startDateTime) {
      return false;
    }
    const eventDate = toLocal(event.startDateTime);
    if (!eventDate) return false;
    return eventDate.isSameOrAfter(monday.startOf("day")) && eventDate.isBefore(weekEnd);
  });
}

function computeEventMaxHour(event: CalendarEventDetail) {
  if (event.endDateTime) {
    const endTime = toLocal(event.endDateTime);
    const startTime = toLocal(event.startDateTime);
    if (!endTime) return 0;
    const crossesMidnight = startTime && endTime.isBefore(startTime);
    const isMidnight = endTime.hour() === 0 && endTime.minute() === 0;

    if (crossesMidnight || isMidnight) {
      return 24;
    }
    const roundedEndHour = endTime.minute() > 0 ? endTime.hour() + 1 : endTime.hour();
    return Math.min(24, roundedEndHour);
  }

  if (event.startDateTime) {
    const s = toLocal(event.startDateTime);
    return s ? Math.min(24, s.hour() + 1) : 0;
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

  let minTotalMinutes = includeCurrentTime ? now.hour() * 60 : 24 * 60;
  let max = includeCurrentTime ? now.hour() + 1 : 0;

  for (const event of weekEvents) {
    const s = toLocal(event.startDateTime);
    if (s) {
      const m = s.hour() * 60 + s.minute();
      if (m < minTotalMinutes) minTotalMinutes = m;
    }
    max = Math.max(max, computeEventMaxHour(event));
  }

  // If the earliest event starts at :30 or later, keep it in its own hour row
  // so we don't render a full empty hour above it. Otherwise, back off 1h for
  // visual breathing room between the header and the first chip.
  const minHour = Math.floor(minTotalMinutes / 60);
  const minMinute = minTotalMinutes % 60;
  const paddedStart = Math.max(0, minMinute >= 30 ? minHour : minHour - 1);
  const paddedEnd = Math.min(24, max + 1);
  return {
    endHour: paddedEnd,
    startHour: paddedStart,
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
        loading && "pointer-events-none opacity-50 grayscale-[0.3]"
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
            "flex items-baseline justify-center gap-1.5 border-default-200 border-r px-2 py-2.5 text-center last:border-r-0",
            day.isToday && "border-primary border-b-2 bg-primary/10"
          )}
          key={day.key}
        >
          <abbr
            className={cn(
              "font-semibold text-[0.65rem] uppercase tracking-wider",
              day.isToday ? "text-primary" : "text-foreground-400"
            )}
            title={day.fullDayName}
          >
            {day.dayName}
          </abbr>
          <time
            className={cn(
              "font-bold text-base tabular-nums leading-none",
              day.isToday ? "text-primary" : "text-foreground"
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
          className="flex h-16 items-start justify-end border-default-100 border-b pr-2"
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
        day.isToday && "bg-primary/5 dark:bg-primary/10"
      )}
    >
      {/* Hour grid lines */}
      {hours.map((hour) => (
        <div
          className="h-16 border-default-200/50 border-b dark:border-default-200/80"
          key={hour}
        />
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
  // At 64px/h, anything under ~30min is too short for stacked time + title
  // (two lines of text-[0.6rem] + py-0.5 don't fit). Keep those inline.
  if (durationMinutes < 30) {
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
  const start = toLocal(event.startDateTime);
  const end = toLocal(event.endDateTime);
  const durationMinutes = start && end ? Math.max(1, end.diff(start, "minute")) : 30;

  return {
    durationMinutes,
    end,
    endTimeStr: end ? end.format("HH:mm") : "",
    start,
    timeStr: start ? start.format("HH:mm") : "",
  };
}

function getEventButtonClasses(
  displayMode: DisplayMode,
  category: string | null,
  hasPaletteColor: boolean
) {
  return cn(
    "absolute z-1 flex min-h-5 flex-col justify-start gap-0.5 overflow-hidden rounded-md border-l-[3px] text-start shadow-sm transition-shadow hover:z-10 hover:shadow-md dark:shadow-none dark:ring-1 dark:ring-white/5",
    hasPaletteColor ? "border-l-[3px]" : getCategoryClass(category),
    displayMode === "minimal" && "flex-row items-center gap-1 px-1 py-0",
    displayMode === "compact" && "px-1.5 py-0.5",
    displayMode === "normal" && "px-1.5 py-1",
    displayMode === "detailed" && "px-2 py-1.5"
  );
}

// Doctoralia serviceColorSchemaId → hex palette (mirrors the colorSchemas block
// in GET /api/calendarevents). Each event card uses eventColor as background,
// textColor for text, baseColor for the left border accent. `bg`, `icon` and
// `hover` mirror backgroundColor/iconColor/hoverEventColor from the API; fill
// from the live payload when needed.
type DoctoraliaColorSchema = {
  base: string;
  bg?: string;
  event: string;
  hover?: string;
  icon?: string;
  text: string;
};
const DOCTORALIA_COLOR_SCHEMAS: Record<string, DoctoraliaColorSchema> = {
  "1": { base: "#78CE70", event: "#D6F0D4", text: "#487C43" },
  "2": { base: "#F9A83E", event: "#FDE4C5", text: "#7C541F" },
  "3": { base: "#6DCAF1", event: "#D3EFFA", text: "#366578" },
  "4": { base: "#FE9DAF", event: "#FEE1E7", text: "#7F4E57" },
  "5": { base: "#9F9CDE", event: "#E2E1F5", text: "#5F5D85" },
  "6": { base: "#B9D143", event: "#EAF1C6", text: "#5C6821" },
  "7": { base: "#66CFC3", event: "#D1F0ED", text: "#336761" },
  "8": { base: "#FECD1E", event: "#FEF0BB", text: "#7F660F" },
  "9": { base: "#63A5ED", event: "#D0E4F9", text: "#3B638E" },
  "10": { base: "#F76C6C", event: "#FDE1E1", text: "#944040" },
  "11": { base: "#D85F99", event: "#F3CFE0", text: "#6C304D" },
  "12": { base: "#D44138", event: "#F2C6C3", text: "#6A211C" },
  "13": { base: "#3883C8", event: "#C3DAEF", text: "#1C4264" },
  "14": { base: "#C675EC", event: "#EED6F9", text: "#633B76" },
  "15": { base: "#12A985", event: "#B8E5DA", text: "#095543" },
  "16": { base: "#C8803E", event: "#EFD9C5", text: "#64401F" },
  "17": { base: "#E8D3B4", event: "#F8F2E9", text: "#746A5A" },
  "18": { base: "#20538A", event: "#BCCBDC", text: "#102A45" },
  "19": { base: "#B72C23", event: "#E9C0BD", text: "#5C1612" },
  "20": { base: "#58D8E1", event: "#CDF3F6", text: "#2C6C71" },
  "21": { base: "#B71C54", event: "#E9BBCC", text: "#5C0E2A" },
  "22": { base: "#1E931C", event: "#BCDFBB", text: "#0F4A0E" },
  "23": { base: "#5A5FDD", event: "#CECFF5", text: "#2D306F" },
  "24": { base: "#723EC8", event: "#D5C5EF", text: "#391F64" },
  "25": { base: "#A058A6", event: "#E3CDE4", text: "#502C53" },
  "26": { base: "#880E75", event: "#DBB7D6", text: "#44073B" },
  "27": { base: "#DD7617", event: "#F7D5B6", text: "#733B07" },
  "28": { base: "#8E6F52", event: "#DDD4CB", text: "#473829" },
  "29": { base: "#966A15", event: "#E0D2B9", text: "#4B350B" },
  "30": { base: "#75400F", event: "#D6C6B7", text: "#3B2008" },
};

function getDoctoraliaColorStyle(
  colorId: null | string | undefined,
  isDark: boolean
): CSSProperties | null {
  if (!colorId) return null;
  const schema = DOCTORALIA_COLOR_SCHEMAS[colorId];
  if (!schema) return null;
  if (isDark) {
    // Dark mode: keep the saturated base as the left-border accent, paint a
    // stronger tinted background so each chip reads as an actual colored object
    // (not a washed-out grey), and use a lightened mix of the base as the text
    // color so it sits on top of the tint without losing hue. 0.65 keeps hue
    // identifiable (0.75 washed dark-base palettes like #1E931C to near-white
    // failing WCAG AA against the translucent background).
    return {
      backgroundColor: hexWithAlpha(schema.base, 0.38),
      borderLeftColor: schema.base,
      color: hexMixWithWhite(schema.base, 0.65),
    };
  }
  return {
    backgroundColor: schema.event,
    borderLeftColor: schema.base,
    color: schema.text,
  };
}

function hexWithAlpha(hex: string, alpha: number) {
  const a = Math.max(0, Math.min(1, alpha));
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Lerp the hex toward white by `t` (0 = base hex, 1 = pure white). Used for dark
// mode text: mixing ~75% white keeps the hue but raises luminance enough to sit
// on a translucent tinted background at WCAG-passing contrast.
function hexMixWithWhite(hex: string, t: number) {
  const ratio = Math.max(0, Math.min(1, t));
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function buildEventTooltipContent({
  endTimeStr,
  timeStr,
  title,
}: {
  endTimeStr: string;
  timeStr: string;
  title: string;
}) {
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-default-500 tabular-nums">
        {timeStr}
        {endTimeStr ? ` – ${endTimeStr}` : ""}
      </p>
    </div>
  );
}

function EventButtonContent({
  displayMode,
  endTimeStr,
  timeStr,
  title,
}: {
  displayMode: DisplayMode;
  endTimeStr: string;
  timeStr: string;
  title: string;
}) {
  const rangeLabel = endTimeStr ? `${timeStr} – ${endTimeStr}` : timeStr;

  if (displayMode === "minimal") {
    // On very short slots we only have room for one line. Put the time first
    // (tabular-nums so columns align) and collapse the title to the remainder.
    // No wrapper span: the Button is already flex-row in minimal mode, and an
    // intermediate span without a width constraint breaks flex-1's ellipsis.
    return (
      <>
        <span className="shrink-0 font-semibold text-[0.55rem] tabular-nums opacity-80">
          {timeStr}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[0.55rem] leading-tight">
          {title}
        </span>
      </>
    );
  }

  return (
    <>
      <span
        className={cn(
          "shrink-0 font-semibold tabular-nums opacity-80",
          displayMode === "compact" && "text-[0.6rem]",
          displayMode === "normal" && "text-[0.65rem]",
          displayMode === "detailed" && "text-[0.7rem]"
        )}
      >
        {rangeLabel}
      </span>
      <span
        className={cn(
          "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-bold leading-tight",
          displayMode === "compact" && "text-[0.6rem]",
          displayMode === "normal" && "line-clamp-2 text-[0.7rem]",
          displayMode === "detailed" && "line-clamp-2 text-[0.75rem]"
        )}
      >
        {title}
      </span>
    </>
  );
}

function EventItem({ endHour, event, onEventClick, startHour, tooltipTrigger }: EventItemProps) {
  const { isDark } = useTheme();
  const position = getEventPosition(event, startHour, endHour);
  if (!position) {
    return null;
  }

  const { durationMinutes, endTimeStr, timeStr } = getEventDisplayTimes(event);
  const displayMode = getDisplayMode(durationMinutes);
  const title = toTitleCase(event.summary?.trim()) || "(Sin título)";

  const padding = event.totalColumns > 1 ? 2 : 3;
  const columnWidth = 100 / event.totalColumns;
  const leftPos = event.column * columnWidth;

  const paletteStyle = getDoctoraliaColorStyle(event.colorId, isDark);
  const eventButton = (
    <Button
      className={getEventButtonClasses(displayMode, event.category ?? null, paletteStyle !== null)}
      onPress={() => onEventClick?.(event)}
      size="sm"
      style={{
        height: position.height,
        left: `calc(${leftPos}% + ${padding}px)`,
        top: position.top,
        width: `calc(${columnWidth}% - ${padding * 2}px)`,
        ...paletteStyle,
      }}
      variant="ghost"
    >
      <EventButtonContent
        displayMode={displayMode}
        endTimeStr={endTimeStr}
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
  // UTC epoch millis — operator-independent of browser TZ. We only care about
  // relative ordering/overlap here, so we don't need zone conversion.
  const startDt = event.startDateTime ? dayjs(event.startDateTime) : null;
  const start = startDt ? startDt.valueOf() : 0;
  let end: number;

  if (event.endDateTime) {
    const endDt = dayjs(event.endDateTime);
    if (startDt && (endDt.isBefore(startDt) || endDt.isSame(startDt))) {
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
    // Neutral fallback: visible against both content1 (light) and dark bg.
    // bg-content2 alone disappears in dark mode, making color-less events
    // read as empty space.
    return cn(
      baseClasses,
      "bg-default-200/60 text-default-800 border-default-400",
      "dark:bg-default-100/60 dark:text-default-200 dark:border-default-500"
    );
  }

  const cat = category.toLowerCase();

  if (cat.includes("subcutáneo") || cat.includes("subcutaneo")) {
    return cn(
      baseClasses,
      "bg-sky-100 text-sky-900 border-sky-500 dark:bg-sky-900/30 dark:text-sky-100"
    );
  }

  if (cat.includes("test") || cat.includes("examen") || cat.includes("exámenes")) {
    return cn(
      baseClasses,
      "bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-100"
    );
  }

  if (cat.includes("inyección") || cat.includes("inyeccion")) {
    return cn(
      baseClasses,
      "bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-900/30 dark:text-amber-100"
    );
  }

  if (cat.includes("mantención") || cat.includes("mantencion")) {
    return cn(
      baseClasses,
      "bg-sky-100 text-sky-900 border-sky-500 dark:bg-sky-900/30 dark:text-sky-100"
    );
  }

  return cn(baseClasses, "bg-content2 border-divider text-foreground");
}

// Current time indicator - Live Updating
function NowIndicator({ endHour, startHour }: Readonly<{ endHour: number; startHour: number }>) {
  const [now, setNow] = useState(() => dayjs().tz(DISPLAY_TZ));

  useEffect(() => {
    setNow(dayjs().tz(DISPLAY_TZ));
    const timer = setInterval(() => {
      setNow(dayjs().tz(DISPLAY_TZ));
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
      <div className="-ml-1.25 size-2.5 rounded-full bg-danger shadow-[0_0_8px] shadow-danger/50" />
      <div className="h-0.5 flex-1 bg-danger" />
    </div>
  );
}
