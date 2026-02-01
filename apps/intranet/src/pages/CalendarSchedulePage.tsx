import { ButtonGroup, Chip, Surface } from "@heroui/react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import ScheduleCalendar from "@/features/calendar/components/ScheduleCalendar";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useDisclosure } from "@/hooks/use-disclosure";
import { numberFormatter } from "@/lib/format";
import { Route } from "@/routes/_authed/calendar/schedule";

import "dayjs/locale/es";

dayjs.extend(isoWeek);
dayjs.locale("es");

const DATE_FORMAT = "YYYY-MM-DD";

// Logic moved to validateSearch in route, but we still use it for comparison logic
const getActualWeekStart = () => {
  const today = dayjs();
  const base = today.day() === 0 ? today.add(1, "day") : today;
  return base.isoWeekday(1);
};

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

  // Purely derived state from the URL (Source of Truth)
  const actualWeekStart = getActualWeekStart();
  const currentWeekStartStr = search.from ?? actualWeekStart.format(DATE_FORMAT);
  const currentDisplayed = dayjs(currentWeekStartStr);

  // The hook already filters events by the 'from'/'to' range in the URL.
  // No need to re-filter on the client.
  const displayedWeekEvents = daily?.days.flatMap((day) => day.events) ?? [];

  // Navigation helpers
  const rangeLabel = currentDisplayed.isValid()
    ? `${currentDisplayed.format("D MMM")} - ${currentDisplayed.add(5, "day").format("D MMM YYYY")}`
    : "Seleccionar rango";

  const isCurrentWeek = currentDisplayed.isSame(actualWeekStart, "day");
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
    updateWeek(actualWeekStart.format(DATE_FORMAT));
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
              <Button
                aria-label="Semana anterior"
                isIconOnly
                onPress={goToPreviousWeek}
                variant="ghost"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                className="text-[11px] font-medium uppercase tracking-wide"
                isDisabled={isCurrentWeek}
                onPress={goToThisWeek}
                variant="tertiary"
              >
                <span className="hidden sm:inline">Semana actual</span>
                <span className="sm:hidden">Actual</span>
              </Button>
              <Button
                aria-label="Semana siguiente"
                isIconOnly
                onPress={goToNextWeek}
                variant="ghost"
              >
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
                {numberFormatter.format(summary.totals.events)} eventos
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
                  search: (prev) => ({
                    ...prev,
                    calendarId: undefined,
                    category: undefined,
                    search: undefined,
                  }),
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
      <Surface
        className="mt-3 overflow-hidden rounded-3xl border border-default-100 shadow-sm"
        variant="default"
      >
        {loading && !displayedWeekEvents.length ? (
          <div className="p-6">
            <CalendarSkeleton days={6} />
          </div>
        ) : (
          <ScheduleCalendar
            events={displayedWeekEvents}
            loading={loading}
            weekStart={currentWeekStartStr}
          />
        )}
      </Surface>
    </section>
  );
}

export default CalendarSchedulePage;
