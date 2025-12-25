import dayjs from "dayjs";
import { type CalendarEventDetail } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormattedEventDescription } from "./FormattedEventDescription";

interface DailyEventCardProps {
  event: CalendarEventDetail;
}

/**
 * Get category-based indicator color (matches WeekGrid CSS)
 */
function getCategoryIndicatorColor(category: string | null | undefined): string {
  switch (category) {
    case "Tratamiento subcutáneo":
      return "bg-blue-400";
    case "Test y exámenes":
      return "bg-emerald-400";
    case "Inyección":
      return "bg-amber-400";
    default:
      return "bg-gray-300";
  }
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

export function DailyEventCard({ event }: DailyEventCardProps) {
  const isSubcutaneous = event.category === "Tratamiento subcutáneo";

  // Calculate times and duration
  const start = event.startDateTime ? dayjs(event.startDateTime) : null;
  const end = event.endDateTime ? dayjs(event.endDateTime) : null;
  const durationMinutes = start && end ? end.diff(start, "minute") : null;

  // Category-based indicator color
  const indicatorColor = getCategoryIndicatorColor(event.category);

  return (
    <article className="group bg-base-100 hover:bg-base-200/20 text-base-content border-base-200 relative grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border p-3 shadow-sm transition-all hover:shadow-md sm:gap-4 sm:p-4">
      {/* Time Column - Start, Color Bar, Duration, End */}
      <div className="flex flex-col items-center gap-0.5 text-center">
        {/* Start Time */}
        <span className="text-sm font-bold tabular-nums">{start ? start.format("HH:mm") : "--:--"}</span>

        {/* Category Color Indicator */}
        <div className={cn("min-h-6 w-1.5 flex-1 rounded-full", indicatorColor)} />

        {/* Duration */}
        {durationMinutes != null && durationMinutes > 0 && (
          <span className="text-base-content/50 text-[10px] font-medium whitespace-nowrap">
            {formatDuration(durationMinutes)}
          </span>
        )}

        {/* End Time */}
        <span className="text-base-content/60 text-xs font-medium tabular-nums">
          {end ? end.format("HH:mm") : "--:--"}
        </span>
      </div>

      {/* Content - Center Column */}
      <div className="min-w-0 space-y-1.5">
        {/* Title */}
        <h3 className="truncate text-sm leading-tight font-semibold sm:text-base">
          {event.summary?.trim() || "(Sin título)"}
        </h3>

        {/* Details Row: Amounts + Attendance */}
        <div className="text-base-content/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {event.amountExpected != null && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase opacity-60">Esperado</span>
              <span className="text-base-content font-medium">{currencyFormatter.format(event.amountExpected)}</span>
            </div>
          )}
          {event.amountPaid != null && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase opacity-60">Pagado</span>
              <span className="text-success font-medium">{currencyFormatter.format(event.amountPaid)}</span>
            </div>
          )}
          {event.attended != null &&
            (event.attended || (event.startDateTime && dayjs(event.startDateTime).isBefore(dayjs()))) && (
              <span className={cn("font-medium", event.attended ? "text-success" : "text-error")}>
                {event.attended ? "✓ Asistió" : "✗ No asistió"}
              </span>
            )}
        </div>

        {/* Description */}
        {event.description && <FormattedEventDescription text={event.description} className="mt-1" />}
      </div>

      {/* Right Column - Category Badges */}
      <div className="flex flex-col items-end gap-1 text-right">
        {event.category && (
          <span className="bg-base-200 text-base-content/80 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase">
            {event.category}
          </span>
        )}
        {isSubcutaneous && event.treatmentStage && (
          <span className="bg-secondary/10 text-secondary rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase">
            {event.treatmentStage}
          </span>
        )}
        {isSubcutaneous && event.dosage && (
          <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase">
            {event.dosage}
          </span>
        )}
      </div>
    </article>
  );
}
