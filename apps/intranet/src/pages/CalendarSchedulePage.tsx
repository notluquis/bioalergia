import { Button, ButtonGroup, Chip } from "@heroui/react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import ScheduleCalendar from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useDisclosure } from "@/hooks/use-disclosure";
import { numberFormatter } from "@/lib/format";
import { Route } from "@/routes/_authed/calendar/schedule";

import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

function CalendarSchedulePage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  const {
    availableCategories,
    daily,
    filters,
    isDirty,
    loading,
    resetFilters,
    summary,
    updateFilters,
  } = useCalendarEvents();

  // The displayed week start is derived from the URL's 'from' filter.
  // If not present, we fall back to the current week's Monday.
  const getCurrentWeekStart = () => {
    const today = dayjs();
    const base = today.day() === 0 ? today.add(1, "day") : today;
    return base.isoWeekday(1).format(DATE_FORMAT);
  };

  const displayedWeekStart = search.from ?? getCurrentWeekStart();
  const currentDisplayed = dayjs(displayedWeekStart);

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
  const rangeLabel = currentDisplayed.isValid()
    ? `${currentDisplayed.format("D MMM")} - ${currentDisplayed.add(5, "day").format("D MMM YYYY")}`
    : "Seleccionar rango";

  const isCurrentWeek = currentDisplayed.isSame(dayjs(getCurrentWeekStart()), "day");
  const actualWeekStart = dayjs().isoWeekday(1);
  const isNextWeek = currentDisplayed.isSame(actualWeekStart.add(1, "week"), "day");

  const updateWeek = (newStart: string) => {
    const start = dayjs(newStart);
    const end = start.add(6, "day");

    void navigate({
      search: {
        ...search,
        from: start.format(DATE_FORMAT),
        to: end.format(DATE_FORMAT),
      },
    });
  };

  const goToPreviousWeek = () => {
    updateWeek(currentDisplayed.subtract(1, "week").format(DATE_FORMAT));
  };

  const goToNextWeek = () => {
    updateWeek(currentDisplayed.add(1, "week").format(DATE_FORMAT));
  };

  const goToThisWeek = () => {
    updateWeek(getCurrentWeekStart());
  };

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
                void navigate({
                  search: {
                    ...search,
                    calendarId: filters.calendarIds?.length ? filters.calendarIds : undefined,
                    category: filters.categories?.length ? filters.categories : undefined,
                    search: filters.search || undefined,
                  },
                });
                setFiltersOpen(false);
              }}
              onFilterChange={updateFilters}
              onOpenChange={setFiltersOpen}
              onReset={() => {
                resetFilters();
                void navigate({
                  search: {
                    from: search.from,
                    to: search.to,
                  },
                });
              }}
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
