import { Card, Chip } from "@heroui/react";
import dayjs from "dayjs";
import {
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock3,
  type LucideIcon,
  XCircle,
} from "lucide-react";

import type { CalendarEventDetail } from "@/features/calendar/types";
import type {
  CalendarEventState,
  CalendarEventStateTone,
} from "@/features/calendar/utils/event-state";
import { getCalendarEventStates } from "@/features/calendar/utils/event-state";
import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

import { FormattedEventDescription } from "./FormattedEventDescription";

interface DailyEventCardProps {
  readonly event: CalendarEventDetail;
}

type StateBadge = CalendarEventState & {
  color: "danger" | "default" | "success" | "warning";
  icon: LucideIcon;
};

function iconByState(state: CalendarEventState): LucideIcon {
  if (state.label === "Programada") {
    return CalendarClock;
  }
  if (state.label === "Asistencia pendiente" || state.label === "Tentativo") {
    return Clock3;
  }
  if (state.label === "Por confirmar") {
    return CircleHelp;
  }
  if (state.tone === "success") {
    return CheckCircle2;
  }
  if (state.tone === "danger") {
    return XCircle;
  }
  return CircleHelp;
}

function chipColorByTone(tone: CalendarEventStateTone): StateBadge["color"] {
  if (tone === "success") return "success";
  if (tone === "danger") return "danger";
  if (tone === "warning") return "warning";
  return "default";
}

function buildRightSideBadges(event: CalendarEventDetail) {
  const isSubcutaneous = event.category === "Tratamiento subcutáneo";
  const badges: Array<{
    className?: string;
    color?: "accent" | "warning";
    label: string;
  }> = [];

  if (event.category) {
    badges.push({
      className: "h-6 font-medium text-[10px] uppercase tracking-wide",
      label: event.category,
    });
  }
  if (event.controlIncluded === true) {
    badges.push({
      className: "h-6 font-medium text-[10px] uppercase tracking-wide",
      color: "warning",
      label: "Control",
    });
  }
  if (isSubcutaneous && event.treatmentStage) {
    badges.push({
      className: "h-6 font-medium text-[10px] uppercase tracking-wide",
      color: "accent",
      label: event.treatmentStage,
    });
  }
  if (isSubcutaneous && event.dosageValue != null && event.dosageUnit) {
    badges.push({
      className: "h-6 font-medium text-[10px] uppercase tracking-wide",
      color: "accent",
      label: `${event.dosageValue} ${event.dosageUnit}`,
    });
  }

  return badges;
}

export function DailyEventCard({ event }: DailyEventCardProps) {
  const start = event.startDateTime ? dayjs(event.startDateTime) : null;
  const end = event.endDateTime ? dayjs(event.endDateTime) : null;
  const durationMinutes = start && end ? end.diff(start, "minute") : null;
  const indicatorColor = getCategoryIndicatorColor(event.category);
  const stateBadges: StateBadge[] = getCalendarEventStates(event).map((state) => ({
    ...state,
    color: chipColorByTone(state.tone),
    icon: iconByState(state),
  }));
  const rightBadges = buildRightSideBadges(event);

  return (
    <Card className="group h-full border border-default-200 shadow-sm transition-all hover:shadow-md">
      <div className="grid grid-cols-[auto_1fr_auto] gap-3 overflow-visible p-3 sm:gap-4 sm:p-4">
        {/* Time Column - Start, Color Bar, Duration, End */}
        <div className="flex flex-col items-center gap-0.5 text-center">
          {/* Start Time */}
          <span className="font-bold text-sm tabular-nums">
            {start ? start.format("HH:mm") : "--:--"}
          </span>

          {/* Category Color Indicator */}
          <div className={cn("min-h-6 w-1.5 flex-1 rounded-full", indicatorColor)} />

          {/* Duration */}
          {durationMinutes != null && durationMinutes > 0 && (
            <span className="whitespace-nowrap font-medium text-[10px] text-foreground-500">
              {formatDuration(durationMinutes)}
            </span>
          )}

          {/* End Time */}
          <span className="font-medium text-foreground-500 text-xs tabular-nums">
            {end ? end.format("HH:mm") : "--:--"}
          </span>
        </div>

        {/* Content - Center Column */}
        <div className="min-w-0 space-y-1.5">
          {/* Title */}
          <h3 className="line-clamp-2 break-words font-semibold text-sm leading-tight sm:text-base">
            {event.summary?.trim() ?? "(Sin título)"}
          </h3>

          {/* Details Row: Amounts + Attendance */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground-600 text-xs">
            {event.amountExpected != null && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase opacity-60">Esperado</span>
                <span className="font-medium text-foreground">
                  {currencyFormatter.format(event.amountExpected)}
                </span>
              </div>
            )}
            {event.amountPaid != null && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase opacity-60">Pagado</span>
                <span className="font-medium text-success">
                  {currencyFormatter.format(event.amountPaid)}
                </span>
              </div>
            )}
            {stateBadges.map((badge) => {
              if (!badge) {
                return null;
              }
              const Icon = badge.icon;
              return (
                <Chip
                  className="h-6 gap-1 font-medium text-[10px] uppercase tracking-wide"
                  color={badge.color}
                  key={badge.key}
                  size="sm"
                  variant="soft"
                >
                  <Icon className="h-3 w-3" />
                  {badge.label}
                </Chip>
              );
            })}
          </div>

          {/* Description */}
          {event.description && (
            <FormattedEventDescription className="mt-1" text={event.description} />
          )}
        </div>

        {/* Right Column - Category Badges */}
        <div className="flex flex-col items-end gap-1 text-right">
          {rightBadges.map((badge) => (
            <Chip
              className={badge.className}
              color={badge.color}
              key={`${badge.label}-${badge.color ?? "default"}`}
              size="sm"
              variant="soft"
            >
              {badge.label}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get category-based indicator color (matches WeekGrid CSS)
 */
function getCategoryIndicatorColor(category: null | string | undefined): string {
  switch (category) {
    case "Inyección": {
      return "bg-amber-400";
    }
    case "Test y exámenes": {
      return "bg-emerald-400";
    }
    case "Tratamiento subcutáneo": {
      return "bg-blue-400";
    }
    default: {
      return "bg-default-300";
    }
  }
}
