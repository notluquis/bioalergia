import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { Filter } from "lucide-react";
import { useEffect, useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { CalendarFilterPanel } from "@/features/calendar/components/CalendarFilterPanel";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";
// Components
import { DailyStatsCards } from "@/features/calendar/components/DailyStatsCards";
import { DayNavigation } from "@/features/calendar/components/DayNavigation";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { today } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";

import "dayjs/locale/es";

dayjs.locale("es");
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

function CalendarDailyPage() {
  const {
    appliedFilters,
    applyFilters,
    availableCategories,
    availableEventTypes,
    daily,
    error,
    filters,
    loading,
    resetFilters,
    updateFilters,
  } = useCalendarEvents();

  const [selectedDate, setSelectedDate] = useState(() => today());
  const [showFilters, setShowFilters] = useState(false);

  // Sync selectedDate filter range to ensure data is loaded
  // Load ±2 weeks around the selected date initially, extend when navigating outside
  useEffect(() => {
    const current = dayjs(selectedDate);
    const currentFrom = dayjs(appliedFilters.from);
    const currentTo = dayjs(appliedFilters.to);

    // Check if current date is within loaded range
    const isWithinRange = current.isSameOrAfter(currentFrom) && current.isSameOrBefore(currentTo);

    if (!isWithinRange) {
      // Extend range to include the new date with ±2 weeks buffer
      const twoWeeksBack = current.subtract(2, "week").format("YYYY-MM-DD");
      const twoWeeksForward = current.add(2, "week").format("YYYY-MM-DD");

      // Extend the range rather than replacing (to keep already loaded data context)
      const newFrom = currentFrom.isValid() && currentFrom.isBefore(twoWeeksBack) ? appliedFilters.from : twoWeeksBack;
      const newTo = currentTo.isValid() && currentTo.isAfter(twoWeeksForward) ? appliedFilters.to : twoWeeksForward;

      updateFilters("from", newFrom);
      updateFilters("to", newTo);
    }
  }, [selectedDate, appliedFilters.from, appliedFilters.to, updateFilters]);

  // Auto-apply filters when date range changes in the draft filters due to navigation
  useEffect(() => {
    if (filters.from !== appliedFilters.from || filters.to !== appliedFilters.to) {
      applyFilters();
    }
  }, [filters.from, filters.to, appliedFilters.from, appliedFilters.to, applyFilters]);

  // Get data for selected Day
  const selectedDayEntry = daily?.days.find((d) => d.date === selectedDate);

  const hasEvents = (selectedDayEntry?.events.length ?? 0) > 0;

  return (
    <section className={PAGE_CONTAINER}>
      {/* Header with Navigation */}
      <header className="space-y-3">
        <DayNavigation
          onSelect={setSelectedDate}
          rightSlot={
            <Button
              className="gap-1.5"
              onClick={() => {
                setShowFilters(!showFilters);
              }}
              size="sm"
              variant={showFilters ? "secondary" : "ghost"}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{showFilters ? "Cerrar" : "Filtros"}</span>
            </Button>
          }
          selectedDate={selectedDate}
        />

        {/* Filters Panel (Collapsible) */}
        {showFilters && (
          <CalendarFilterPanel
            availableCategories={availableCategories}
            availableEventTypes={availableEventTypes}
            filters={filters}
            loading={loading}
            onApply={applyFilters}
            onFilterChange={updateFilters}
            onReset={resetFilters}
          />
        )}
      </header>

      {error && (
        <Alert className="mt-4" variant="error">
          {error}
        </Alert>
      )}

      {/* Stats Cards - Compact summary */}
      {selectedDayEntry && (
        <DailyStatsCards
          amountExpected={selectedDayEntry.amountExpected}
          amountPaid={selectedDayEntry.amountPaid}
          className="mt-4"
          eventsCount={selectedDayEntry.total}
        />
      )}

      {/* Main Content - Events List */}
      <div className="mt-6 space-y-3">
        {(() => {
          if (loading && !daily) {
            return <CalendarSkeleton days={1} />;
          }

          if (!selectedDayEntry || !hasEvents) {
            return (
              <div className="border-base-200 bg-base-100/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 text-center">
                <div className="bg-base-200 mb-3 rounded-full p-3">
                  <Filter className="text-base-content/30 h-6 w-6" />
                </div>
                <h3 className="text-base-content/70 font-semibold">Sin eventos</h3>
                <p className="text-base-content/50 mt-1 max-w-xs text-sm">
                  No hay eventos para el {dayjs(selectedDate).format("DD [de] MMMM")}.
                </p>
              </div>
            );
          }

          return (
            <>
              {selectedDayEntry.events.map((event) => (
                <DailyEventCard event={event} key={event.eventId} />
              ))}

              {/* Footer */}
              <div className="text-base-content/40 flex justify-center pt-2 text-xs">
                {selectedDayEntry.total} evento{selectedDayEntry.total === 1 ? "" : "s"} ·{" "}
                {dayjs(selectedDate).format("dddd, D [de] MMMM")}
              </div>
            </>
          );
        })()}
      </div>
    </section>
  );
}

export default CalendarDailyPage;
