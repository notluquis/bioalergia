import { useMemo, useState } from "react";
import dayjs from "dayjs";

import type { CalendarEventDetail } from "../types";
import { currencyFormatter } from "@/lib/format";
import WeekGrid from "./WeekGrid";

export type ScheduleCalendarProps = {
  events: CalendarEventDetail[];
  loading?: boolean;
  weekStart?: string; // YYYY-MM-DD of week start (Monday)
};

export function ScheduleCalendar({ events, loading = false, weekStart }: ScheduleCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null);

  // Default to current week's Monday
  const effectiveWeekStart = useMemo(() => {
    if (weekStart) return weekStart;
    return dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD");
  }, [weekStart]);

  return (
    <div className="space-y-4">
      <WeekGrid events={events} weekStart={effectiveWeekStart} loading={loading} onEventClick={setSelectedEvent} />

      {loading && <p className="text-base-content/50 text-center text-xs">Actualizando eventos…</p>}

      {/* Event Detail Panel */}
      {selectedEvent && (
        <div className="border-base-300 bg-base-100 animate-in slide-in-from-bottom-2 rounded-xl border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base-content/50 text-xs tracking-wide uppercase">Evento seleccionado</p>
              <p className="text-base-content truncate text-lg font-semibold">
                {selectedEvent.summary?.trim() || "(Sin título)"}
              </p>
            </div>
            <button
              type="button"
              className="text-primary text-xs font-semibold hover:underline"
              onClick={() => setSelectedEvent(null)}
            >
              Cerrar
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-base-content/50 text-xs">Inicio</dt>
              <dd className="font-medium">
                {selectedEvent.startDateTime ? dayjs(selectedEvent.startDateTime).format("DD MMM HH:mm") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-base-content/50 text-xs">Fin</dt>
              <dd className="font-medium">
                {selectedEvent.endDateTime ? dayjs(selectedEvent.endDateTime).format("DD MMM HH:mm") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-base-content/50 text-xs">Categoría</dt>
              <dd className="font-medium">{selectedEvent.category ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-base-content/50 text-xs">Calendario</dt>
              <dd className="truncate font-medium">{selectedEvent.calendarId}</dd>
            </div>
            {selectedEvent.amountExpected != null && (
              <div>
                <dt className="text-base-content/50 text-xs">Esperado</dt>
                <dd className="font-medium">{currencyFormatter.format(selectedEvent.amountExpected)}</dd>
              </div>
            )}
            {selectedEvent.amountPaid != null && (
              <div>
                <dt className="text-base-content/50 text-xs">Pagado</dt>
                <dd className="text-success font-medium">{currencyFormatter.format(selectedEvent.amountPaid)}</dd>
              </div>
            )}
            {selectedEvent.treatmentStage && (
              <div>
                <dt className="text-base-content/50 text-xs">Etapa</dt>
                <dd className="font-medium">{selectedEvent.treatmentStage}</dd>
              </div>
            )}
            {selectedEvent.dosage && (
              <div>
                <dt className="text-base-content/50 text-xs">Dosis</dt>
                <dd className="font-medium">{selectedEvent.dosage}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

export default ScheduleCalendar;
