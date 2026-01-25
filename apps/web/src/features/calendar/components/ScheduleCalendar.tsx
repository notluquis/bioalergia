import dayjs from "dayjs";
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

  // Default to current week's Monday; if it's Sunday, show the upcoming week.
  const effectiveWeekStart =
    weekStart ??
    (() => {
      const today = dayjs();
      const base = today.day() === 0 ? today.add(1, "day") : today;
      return base.isoWeekday(1).format("YYYY-MM-DD");
    })();

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
      <WeekGrid
        events={events}
        loading={loading}
        onEventClick={setSelectedEvent}
        weekStart={effectiveWeekStart}
      />

      {loading && <p className="text-foreground-500 text-center text-xs">Actualizando eventos…</p>}

      {/* Event Detail Panel - Uses same card as Daily view */}
      {selectedEvent && (
        <div
          className="animate-in slide-in-from-bottom-2 relative scroll-mt-4"
          ref={detailPanelRef}
        >
          <Button
            aria-label="Cerrar"
            className="bg-content1 border-default-200 text-foreground-500 hover:text-foreground hover:bg-default-100 absolute -top-2 -right-2 z-10 h-7 w-7 min-w-0 rounded-full border shadow-sm"
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
