import { Filter } from "lucide-react";

import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";
// Components
import { DailyStatsCards } from "@/features/calendar/components/DailyStatsCards";
import { DayNavigation } from "@/features/calendar/components/DayNavigation";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useDisclosure } from "@/hooks/use-disclosure";
import { Route } from "@/routes/_authed/calendar/daily";

import "dayjs/locale/es";
import dayjs from "dayjs";

function CalendarDailyPage() {
  const navigate = Route.useNavigate();

  const {
    // appliedFilters unused in daily list now
    availableCategories,
    currentSelectedDate,
    daily,
    filters,
    loading,
    resetFilters,
    updateFilters,
  } = useCalendarEvents();

  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  // Get data for selected Day
  const selectedDayEntry = daily?.days.find((d) => d.date === currentSelectedDate);

  const hasEvents = (selectedDayEntry?.events.length ?? 0) > 0;

  return (
    <section className="space-y-4">
      {/* Header with Navigation */}
      <header className="space-y-2.5">
        <DayNavigation
          onSelect={(newDate: string) => {
            void navigate({
              search: (prev) => ({
                ...prev,
                date: newDate,
                // Optional: reset from/to to force hook to re-buffer if we implement that
              }),
            });
          }}
          allowedWeekdays={[1, 2, 3, 4, 5, 6]}
          rightSlot={
            <CalendarFiltersPopover
              applyCount={daily?.totals.events}
              availableCategories={availableCategories}
              className="shadow-lg"
              filters={filters}
              isOpen={filtersOpen}
              layout="dropdown"
              loading={loading}
              onApply={() => {
                // UPDATE URL instead of direct apply
                void navigate({
                  search: {
                    ...filters,
                    date: currentSelectedDate,
                    // Ensure arrays are preserved or undefined if empty
                    calendarId: filters.calendarIds?.length ? filters.calendarIds : undefined,
                    category: filters.categories?.length ? filters.categories : undefined,
                  },
                });
                setFiltersOpen(false);
              }}
              onFilterChange={updateFilters}
              onOpenChange={setFiltersOpen}
              onReset={() => {
                resetFilters(); // Resets store
                void navigate({ search: {} }); // Resets URL
              }}
              panelWidthClassName="w-[min(92vw,480px)]"
            />
          }
          selectedDate={currentSelectedDate}
        />
      </header>

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
      <div className="mt-4 space-y-3">
        {(() => {
          if (loading && !daily) {
            return <CalendarSkeleton days={1} />;
          }

          if (!selectedDayEntry || !hasEvents) {
            return (
              <div className="border-default-100 bg-background/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 text-center">
                <div className="bg-default-50 mb-3 rounded-full p-3">
                  <Filter className="text-default-200 h-6 w-6" />
                </div>
                <h3 className="text-default-600 font-semibold">Sin eventos</h3>
                <p className="text-default-400 mt-1 max-w-xs text-sm">
                  No hay eventos para el {dayjs(currentSelectedDate).format("DD [de] MMMM")}.
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
              <div className="text-default-300 flex justify-center pt-2 text-xs">
                {selectedDayEntry.total} evento{selectedDayEntry.total === 1 ? "" : "s"} ·{" "}
                {dayjs(currentSelectedDate).format("dddd, D [de] MMMM")}
              </div>
            </>
          );
        })()}
      </div>
    </section>
  );
}

export default CalendarDailyPage;
