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
  // We can make this visual indicator
  const indicatorColor =
    event.status === "confirmed" ? "bg-success" : event.status === "cancelled" ? "bg-error" : "bg-primary";

  return (
    <article className="group bg-base-100 hover:bg-base-200/20 text-base-content border-base-200 relative flex gap-4 rounded-xl border p-4 shadow-sm transition-all hover:shadow-md">
      {/* Time Column */}
      <div className="flex min-w-14 flex-col items-center gap-1 pt-0.5">
        <span className="text-sm font-bold tabular-nums">
          {event.startDateTime ? dayjs(event.startDateTime).format("HH:mm") : "--:--"}
        </span>
        <div className={cn("h-8 w-1 rounded-full opacity-60", indicatorColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-2">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3 className="w-full truncate text-base leading-tight font-semibold sm:w-auto">
            {event.summary?.trim() || "(Sin título)"}
          </h3>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {event.category && (
              <span className="bg-base-200 text-base-content/70 rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                {event.category}
              </span>
            )}
            {isSubcutaneous && event.treatmentStage && (
              <span className="bg-secondary/10 text-secondary rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                {event.treatmentStage}
              </span>
            )}
            {isSubcutaneous && event.dosage && (
              <span className="bg-accent/10 text-accent rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                {event.dosage}
              </span>
            )}
          </div>
        </div>

        {/* Details Row */}
        <div className="text-base-content/70 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          {/* Amounts */}
          <div className="flex gap-3">
            {event.amountExpected != null && (
              <div className="flex flex-col sm:flex-row sm:gap-1">
                <span className="text-[10px] tracking-wide uppercase opacity-70">Esperado</span>
                <span className="text-base-content font-medium">{currencyFormatter.format(event.amountExpected)}</span>
              </div>
            )}
            {event.amountPaid != null && (
              <div className="flex flex-col sm:flex-row sm:gap-1">
                <span className="text-[10px] tracking-wide uppercase opacity-70">Pagado</span>
                <span className="text-success font-medium">{currencyFormatter.format(event.amountPaid)}</span>
              </div>
            )}
          </div>

          {/* Attendance */}
          {event.attended != null &&
            (event.attended || (event.startDateTime && dayjs(event.startDateTime).isBefore(dayjs()))) && (
              <span className={cn("font-medium", event.attended ? "text-success" : "text-error")}>
                {event.attended ? "✓ Asistió" : "✗ No asistió"}
              </span>
            )}
        </div>

        {/* Description */}
        {event.description && <FormattedEventDescription text={event.description} className="mt-2" />}
      </div>
    </article>
  );
}
