import dayjs from "dayjs";
import { type CalendarEventDetail } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormattedEventDescription } from "./FormattedEventDescription";

interface DailyEventCardProps {
  event: CalendarEventDetail;
}

export function DailyEventCard({ event }: DailyEventCardProps) {
  const isSubcutaneous = event.category === "Tratamiento subcutáneo";

  // Determine border color based on status/category
  const indicatorColor =
    event.status === "confirmed" ? "bg-success" : event.status === "cancelled" ? "bg-error" : "bg-primary";

  return (
    <article className="group bg-base-100 hover:bg-base-200/20 text-base-content border-base-200 relative grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border p-3 shadow-sm transition-all hover:shadow-md sm:gap-4 sm:p-4">
      {/* Time Column */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span className="text-sm font-bold tabular-nums">
          {event.startDateTime ? dayjs(event.startDateTime).format("HH:mm") : "--:--"}
        </span>
        <div className={cn("h-6 w-1 rounded-full opacity-60 sm:h-8", indicatorColor)} />
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
