import dayjs from "dayjs";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CalendarEventDetail } from "../types";

import { DailyEventCard } from "./DailyEventCard";
import WeekGrid from "./WeekGrid";

export interface ScheduleCalendarProps {
  events: CalendarEventDetail[];
  loading?: boolean;
  weekStart?: string; // YYYY-MM-DD of week start (Monday)
}

export function ScheduleCalendar({ events, loading = false, weekStart }: ScheduleCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Default to current week's Monday - React Compiler auto-memoizes
  const effectiveWeekStart = weekStart ?? dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD");

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
      <WeekGrid events={events} loading={loading} onEventClick={setSelectedEvent} weekStart={effectiveWeekStart} />

      {loading && <p className="text-base-content/50 text-center text-xs">Actualizando eventos…</p>}

      {/* Event Detail Panel - Uses same card as Daily view */}
      {selectedEvent && (
        <div className="animate-in slide-in-from-bottom-2 relative scroll-mt-4" ref={detailPanelRef}>
          <button
            aria-label="Cerrar"
            className="bg-base-100 border-base-300 text-base-content/60 hover:text-base-content hover:bg-base-200 absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-colors"
            onClick={() => {
              setSelectedEvent(null);
            }}
            type="button"
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
