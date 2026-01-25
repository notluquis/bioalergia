import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import { CalendarFilterPanel } from "@/features/calendar/components/CalendarFilterPanel";
import ScheduleCalendar from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { numberFormatter } from "@/lib/format";

import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

function CalendarSchedulePage() {
  const [showFilters, setShowFilters] = useState(false);

  const {
    appliedFilters,
    applyFilters,
    availableCategories,
    availableEventTypes,
    daily,
    filters,
    isDirty,
    loading,
    resetFilters,
    summary,
    updateFilters,
  } = useCalendarEvents();

  const allEvents = daily?.days.flatMap((day) => day.events) ?? [];

  // Separate state for which week is displayed (independent from data filter range)
  const [displayedWeekStart, setDisplayedWeekStart] = useState(() => {
    // Start on current week's Monday
    return dayjs().isoWeekday(1).format(DATE_FORMAT);
  });

  // Navigation helpers
  const currentDisplayed = dayjs(displayedWeekStart);
  const rangeLabel = currentDisplayed.isValid()
    ? `${currentDisplayed.format("D MMM")} - ${currentDisplayed.add(5, "day").format("D MMM YYYY")}`
    : "Seleccionar rango";

  const goToPreviousWeek = () => {
    setDisplayedWeekStart(currentDisplayed.subtract(1, "week").format(DATE_FORMAT));
  };

  const goToNextWeek = () => {
    setDisplayedWeekStart(currentDisplayed.add(1, "week").format(DATE_FORMAT));
  };

  const goToThisWeek = () => {
    setDisplayedWeekStart(dayjs().isoWeekday(1).format(DATE_FORMAT));
  };

  // On-demand loading: extend date range when navigating to weeks outside current range
  useEffect(() => {
    const weekStart = dayjs(displayedWeekStart);
    const weekEnd = weekStart.add(6, "day");
    const currentFrom = dayjs(appliedFilters.from);
    const currentTo = dayjs(appliedFilters.to);

    // Check if displayed week is outside currently loaded range
    const needsExtension = weekStart.isBefore(currentFrom) || weekEnd.isAfter(currentTo);

    if (needsExtension) {
      // Extend range to include displayed week with buffer
      const newFrom = weekStart.isBefore(currentFrom)
        ? weekStart.subtract(1, "week").format(DATE_FORMAT)
        : appliedFilters.from;
      const newTo = weekEnd.isAfter(currentTo)
        ? weekEnd.add(2, "week").format(DATE_FORMAT)
        : appliedFilters.to;

      updateFilters("from", newFrom);
      updateFilters("to", newTo);
      applyFilters();
    }
  }, [displayedWeekStart, appliedFilters.from, appliedFilters.to, updateFilters, applyFilters]);

  return (
    <section className="space-y-3">
      {/* Compact Header */}
      <header className="space-y-1.5">
        {/* Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          {/* Left: Week Navigation */}
          <div className="flex items-center gap-2">
            <div className="bg-default-50 flex items-center gap-0.5 rounded-lg p-1">
              <button
                aria-label="Semana anterior"
                className="hover:bg-background text-default-600 hover:text-primary rounded-md p-1.5 transition-colors"
                onClick={goToPreviousWeek}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="hover:bg-background rounded-md px-2 py-1 text-xs font-medium uppercase transition-colors"
                onClick={goToThisWeek}
                type="button"
              >
                Hoy
              </button>
              <button
                aria-label="Semana siguiente"
                className="hover:bg-background text-default-600 hover:text-primary rounded-md p-1.5 transition-colors"
                onClick={goToNextWeek}
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="text-default-600 hidden text-sm font-medium sm:inline">
              {rangeLabel}
            </span>
          </div>

          {/* Right: Event count + Filter toggle */}
          <div className="flex items-center gap-2">
            {summary && (
              <span className="text-default-400 text-xs">
                {numberFormatter.format(allEvents.length)} eventos
              </span>
            )}
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
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <CalendarFilterPanel
            availableCategories={availableCategories}
            availableEventTypes={availableEventTypes}
            filters={filters}
            isDirty={isDirty}
            loading={loading}
            applyCount={daily?.totals.events}
            onApply={applyFilters}
            onFilterChange={updateFilters}
            onReset={resetFilters}
            showSearch
          />
        )}
      </header>

      {/* Calendar - Main Content */}
      <div className="mt-3">
        <ScheduleCalendar events={allEvents} loading={loading} weekStart={displayedWeekStart} />
      </div>
    </section>
  );
}

export default CalendarSchedulePage;
