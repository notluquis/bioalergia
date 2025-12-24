import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { X } from "lucide-react";

import type { CalendarEventDetail } from "../types";
import WeekGrid from "./WeekGrid";
import { DailyEventCard } from "./DailyEventCard";

export type ScheduleCalendarProps = {
  events: CalendarEventDetail[];
  loading?: boolean;
  weekStart?: string; // YYYY-MM-DD of week start (Monday)
};

export function ScheduleCalendar({ events, loading = false, weekStart }: ScheduleCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Default to current week's Monday
  const effectiveWeekStart = useMemo(() => {
    if (weekStart) return weekStart;
    return dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD");
  }, [weekStart]);

  // Auto-scroll to detail panel when event is selected
  useEffect(() => {
    if (selectedEvent && detailPanelRef.current) {
      // Small delay to allow DOM to update
      requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  }, [selectedEvent]);

  return (
    <div className="space-y-4">
      <WeekGrid events={events} weekStart={effectiveWeekStart} loading={loading} onEventClick={setSelectedEvent} />

      {loading && <p className="text-base-content/50 text-center text-xs">Actualizando eventos…</p>}

      {/* Event Detail Panel - Uses same card as Daily view */}
      {selectedEvent && (
        <div ref={detailPanelRef} className="animate-in slide-in-from-bottom-2 relative scroll-mt-4">
          <button
            type="button"
            className="bg-base-100 border-base-300 text-base-content/60 hover:text-base-content hover:bg-base-200 absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
            onClick={() => setSelectedEvent(null)}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
          <DailyEventCard event={selectedEvent} />
        </div>
      )}
    </div>
  );
}

export default ScheduleCalendar;
