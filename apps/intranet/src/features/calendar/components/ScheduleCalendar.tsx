import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import type { CalendarEventDetail } from "../types";
import { DailyEventCard } from "./DailyEventCard";
import WeekGrid from "./WeekGrid";

export interface ScheduleCalendarProps {
  events: CalendarEventDetail[];
  loading?: boolean;
  weekStart?: string; // YYYY-MM-DD of week start (Monday)
}

export function ScheduleCalendar({
  events,
  loading = false,
  weekStart,
}: Readonly<ScheduleCalendarProps>) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to detail panel when event is selected
  useEffect(() => {
    if (!weekStart) {
      return;
    }
    if (selectedEvent && detailPanelRef.current) {
      // Small delay to allow DOM to update
      requestAnimationFrame(() => {
        detailPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  }, [selectedEvent, weekStart]);

  if (!weekStart) {
    return null;
  }

  return (
    <div className="space-y-4">
      <WeekGrid
        events={events}
        loading={loading}
        onEventClick={setSelectedEvent}
        weekStart={weekStart}
      />

      {loading && <p className="text-center text-foreground-500 text-xs">Actualizando eventos…</p>}

      {/* Event Detail Panel - Uses same card as Daily view */}
      {selectedEvent && (
        <div
          className="slide-in-from-bottom-2 relative animate-in scroll-mt-4"
          ref={detailPanelRef}
        >
          <Button
            aria-label="Cerrar"
            className="absolute -top-2 -right-2 z-10 h-7 w-7 min-w-0 rounded-full border border-default-200 bg-content1 text-foreground-500 shadow-sm hover:bg-default-100 hover:text-foreground"
            isIconOnly
            onPress={() => {
              setSelectedEvent(null);
            }}
            size="sm"
            variant="ghost"
          >
            <X size={14} />
          </Button>
          <DailyEventCard event={selectedEvent} />
        </div>
      )}
    </div>
  );
}

export default ScheduleCalendar;
