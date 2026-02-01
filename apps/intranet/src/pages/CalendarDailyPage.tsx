import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { Filter } from "lucide-react";
import { useEffect, useState } from "react";

import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";
// Components
import { DailyStatsCards } from "@/features/calendar/components/DailyStatsCards";
import { DayNavigation } from "@/features/calendar/components/DayNavigation";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useDisclosure } from "@/hooks/use-disclosure";
import { today } from "@/lib/dates";
import { Route } from "@/routes/_authed/calendar/daily";

import "dayjs/locale/es";

dayjs.locale("es");
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

function CalendarDailyPage() {
  const navigate = Route.useNavigate();
  const searchParams = Route.useSearch();

  const {
    appliedFilters,
    applyFilters,
    availableCategories,
    daily,
    filters,
    loading,
    resetFilters,
    updateFilters,
  } = useCalendarEvents();

  // URL -> Hook State Sync
  // When URL changes (from navigation or initial load), update the store and trigger fetch
  useEffect(() => {
    // 1. Update draft store (Mapping URL params to Store keys)
    if (searchParams.from) updateFilters("from", searchParams.from);
    if (searchParams.to) updateFilters("to", searchParams.to);
    if (searchParams.calendarId) updateFilters("calendarIds", searchParams.calendarId);
    if (searchParams.category) updateFilters("categories", searchParams.category);

    // 2. Trigger fetch (internal hook state)
    applyFilters();
  }, [searchParams, updateFilters, applyFilters]);

  const [selectedDate, setSelectedDate] = useState(() => today());
  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  // Sync selectedDate filter range to ensure data is loaded
  // Load ±2 weeks around the selected date initially, extend when navigating outside
  useEffect(() => {
    const current = dayjs(selectedDate);
    // Use appliedFilters (which should match URL/Store after sync)
    const currentFrom = dayjs(appliedFilters.from);
    const currentTo = dayjs(appliedFilters.to);

    // Check if current date is within loaded range
    const isWithinRange = current.isSameOrAfter(currentFrom) && current.isSameOrBefore(currentTo);

    if (!isWithinRange) {
      // Extend range to include the new date with ±2 weeks buffer
      const twoWeeksBack = current.subtract(2, "week").format("YYYY-MM-DD");
      const twoWeeksForward = current.add(2, "week").format("YYYY-MM-DD");

      // Extend the range rather than replacing (to keep already loaded data context)
      const newFrom =
        currentFrom.isValid() && currentFrom.isBefore(twoWeeksBack)
          ? appliedFilters.from
          : twoWeeksBack;
      const newTo =
        currentTo.isValid() && currentTo.isAfter(twoWeeksForward)
          ? appliedFilters.to
          : twoWeeksForward;

      updateFilters("from", newFrom);
      updateFilters("to", newTo);
      // NOTE: We rely on the Auto-apply effect (or URL sync if we updated URL)
      // But here we are updating STORE.
      // If we update Store, we should probably update URL too?
      // Actually, this logic is for "Infinite Scroll" pattern of data loading.
      // If we change 'from'/'to' here, it's implicit filtering.
      // Ideally we should navigate, but that might change URL visibly.
      // For now, let's trust the existing mechanism which updates filters then applies.
    }
  }, [selectedDate, appliedFilters.from, appliedFilters.to, updateFilters]);

  // Auto-apply filters when date range changes in the draft filters due to navigation
  useEffect(() => {
    // This effect seems to handle the above logic's consequence:
    // If updateFilters changed 'from'/'to', we apply them.
    if (filters.from !== appliedFilters.from || filters.to !== appliedFilters.to) {
      applyFilters();
    }
  }, [filters.from, filters.to, appliedFilters.from, appliedFilters.to, applyFilters]);

  // Get data for selected Day
  const selectedDayEntry = daily?.days.find((d) => d.date === selectedDate);

  const hasEvents = (selectedDayEntry?.events.length ?? 0) > 0;

  return (
    <section className="space-y-4">
      {/* Header with Navigation */}
      <header className="space-y-2.5">
        <DayNavigation
          onSelect={setSelectedDate}
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
          selectedDate={selectedDate}
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
              <div className="text-default-300 flex justify-center pt-2 text-xs">
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
