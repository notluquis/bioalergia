import { useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";
import { Filter, ChevronLeft, ChevronRight } from "lucide-react";

dayjs.extend(isoWeek);

import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { CalendarFilterPanel } from "@/features/calendar/components/CalendarFilterPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { numberFormatter } from "@/lib/format";
import { PAGE_CONTAINER } from "@/lib/styles";

import ScheduleCalendar from "@/features/calendar/components/ScheduleCalendar";

dayjs.locale("es");

function CalendarSchedulePage() {
  const [showFilters, setShowFilters] = useState(false);

  const {
    filters,
    daily,
    summary,
    loading,
    error,
    isDirty,
    availableEventTypes,
    availableCategories,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const allEvents = useMemo(() => daily?.days.flatMap((day) => day.events) ?? [], [daily?.days]);

  // Separate state for which week is displayed (independent from data filter range)
  const [displayedWeekStart, setDisplayedWeekStart] = useState(() => {
    // Start on current week's Monday
    return dayjs().isoWeekday(1).format("YYYY-MM-DD");
  });

  // Navigation helpers
  const currentDisplayed = dayjs(displayedWeekStart);
  const rangeLabel = currentDisplayed.isValid()
    ? `${currentDisplayed.format("D MMM")} - ${currentDisplayed.add(5, "day").format("D MMM YYYY")}`
    : "Seleccionar rango";

  const goToPreviousWeek = () => {
    setDisplayedWeekStart(currentDisplayed.subtract(1, "week").format("YYYY-MM-DD"));
  };

  const goToNextWeek = () => {
    setDisplayedWeekStart(currentDisplayed.add(1, "week").format("YYYY-MM-DD"));
  };

  const goToThisWeek = () => {
    setDisplayedWeekStart(dayjs().isoWeekday(1).format("YYYY-MM-DD"));
  };

  return (
    <section className={PAGE_CONTAINER}>
      {/* Compact Header */}
      <header className="space-y-3">
        {/* Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Week Navigation */}
          <div className="flex items-center gap-2">
            <div className="bg-base-200 flex items-center gap-0.5 rounded-lg p-1">
              <button
                type="button"
                onClick={goToPreviousWeek}
                className="hover:bg-base-100 text-base-content/70 hover:text-primary rounded-md p-1.5 transition-colors"
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToThisWeek}
                className="hover:bg-base-100 rounded-md px-2 py-1 text-xs font-medium uppercase transition-colors"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={goToNextWeek}
                className="hover:bg-base-100 text-base-content/70 hover:text-primary rounded-md p-1.5 transition-colors"
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="text-base-content/70 hidden text-sm font-medium sm:inline">{rangeLabel}</span>
          </div>

          {/* Right: Event count + Filter toggle */}
          <div className="flex items-center gap-2">
            {summary && (
              <span className="text-base-content/50 text-xs">{numberFormatter.format(allEvents.length)} eventos</span>
            )}
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{showFilters ? "Cerrar" : "Filtros"}</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <CalendarFilterPanel
            filters={filters}
            availableEventTypes={availableEventTypes}
            availableCategories={availableCategories}
            showDateRange
            showSearch
            onFilterChange={updateFilters}
            onApply={applyFilters}
            onReset={resetFilters}
            loading={loading}
            isDirty={isDirty}
          />
        )}
      </header>

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      {/* Calendar - Main Content */}
      <div className="mt-4">
        <ScheduleCalendar events={allEvents} loading={loading} weekStart={displayedWeekStart} />
      </div>
    </section>
  );
}

export default CalendarSchedulePage;
