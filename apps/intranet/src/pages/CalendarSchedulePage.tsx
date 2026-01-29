import { Button, ButtonGroup, Chip } from "@heroui/react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import ScheduleCalendar from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useDisclosure } from "@/hooks/use-disclosure";
import { numberFormatter } from "@/lib/format";

import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

function CalendarSchedulePage() {
  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  const {
    appliedFilters,
    applyFilters,
    availableCategories,
    daily,
    filters,
    isDirty,
    loading,
    resetFilters,
    summary,
    updateFilters,
  } = useCalendarEvents();

  // Separate state for which week is displayed (independent from data filter range)
  const getCurrentWeekStart = () => {
    const today = dayjs();
    const base = today.day() === 0 ? today.add(1, "day") : today;
    return base.isoWeekday(1).format(DATE_FORMAT);
  };

  const [displayedWeekStart, setDisplayedWeekStart] = useState(getCurrentWeekStart);

  const allEvents = daily?.days.flatMap((day) => day.events) ?? [];
  const displayedWeekEnd = dayjs(displayedWeekStart).add(6, "day").endOf("day");
  const displayedWeekEvents = allEvents.filter((event) => {
    const start = event.startDateTime ?? event.startDate;
    if (!start) return false;
    const eventDate = dayjs(start);
    return (
      eventDate.isSameOrAfter(dayjs(displayedWeekStart).startOf("day")) &&
      eventDate.isSameOrBefore(displayedWeekEnd)
    );
  });

  // Navigation helpers
  const currentDisplayed = dayjs(displayedWeekStart);
  const rangeLabel = currentDisplayed.isValid()
    ? `${currentDisplayed.format("D MMM")} - ${currentDisplayed.add(5, "day").format("D MMM YYYY")}`
    : "Seleccionar rango";
  const isCurrentWeek = currentDisplayed.isSame(dayjs(getCurrentWeekStart()), "day");
  const actualWeekStart = dayjs().isoWeekday(1);
  const isNextWeek = currentDisplayed.isSame(actualWeekStart.add(1, "week"), "day");

  const goToPreviousWeek = () => {
    setDisplayedWeekStart(currentDisplayed.subtract(1, "week").format(DATE_FORMAT));
  };

  const goToNextWeek = () => {
    setDisplayedWeekStart(currentDisplayed.add(1, "week").format(DATE_FORMAT));
  };

  const goToThisWeek = () => {
    setDisplayedWeekStart(getCurrentWeekStart());
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
    <section className="space-y-4">
      {/* Compact Header */}
      <header className="space-y-3">
        {/* Navigation Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          {/* Left: Week Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            <ButtonGroup size="sm" variant="tertiary">
              <Button aria-label="Semana anterior" isIconOnly onPress={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                className="text-[11px] font-medium uppercase tracking-wide"
                isDisabled={isCurrentWeek}
                onPress={goToThisWeek}
              >
                <span className="hidden sm:inline">Semana actual</span>
                <span className="sm:hidden">Actual</span>
              </Button>
              <Button aria-label="Semana siguiente" isIconOnly onPress={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </ButtonGroup>
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-default-600 font-medium">{rangeLabel}</span>
              {isNextWeek && (
                <Chip size="sm" variant="secondary" color="default" className="text-[11px]">
                  Próxima semana
                </Chip>
              )}
            </div>
          </div>

          {/* Right: Event count + Filter toggle */}
          <div className="flex items-center gap-3">
            {summary && (
              <span className="text-default-400 text-xs">
                {numberFormatter.format(displayedWeekEvents.length)} eventos
              </span>
            )}
            <CalendarFiltersPopover
              applyCount={displayedWeekEvents.length}
              availableCategories={availableCategories}
              className="shadow-lg"
              filters={filters}
              isDirty={isDirty}
              isOpen={filtersOpen}
              layout="dropdown"
              loading={loading}
              onApply={() => {
                applyFilters();
                setFiltersOpen(false);
              }}
              onFilterChange={updateFilters}
              onOpenChange={setFiltersOpen}
              onReset={resetFilters}
              showSearch
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:hidden">
          <span className="text-default-500 font-medium">{rangeLabel}</span>
          {isNextWeek && (
            <Chip size="sm" variant="secondary" color="default" className="text-[11px]">
              Próxima semana
            </Chip>
          )}
        </div>
      </header>

      {/* Calendar - Main Content */}
      <div className="mt-3">
        <ScheduleCalendar events={allEvents} loading={loading} weekStart={displayedWeekStart} />
      </div>
    </section>
  );
}

export default CalendarSchedulePage;
