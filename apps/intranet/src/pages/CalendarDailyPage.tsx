import { getRouteApi } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import { CalendarFiltersPopover } from "@/features/calendar/components/CalendarFiltersPopover";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";
// Components
import { DailyStatsCards } from "@/features/calendar/components/DailyStatsCards";
import { DayNavigation } from "@/features/calendar/components/DayNavigation";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { useDisclosure } from "@/hooks/use-disclosure";

const routeApi = getRouteApi("/_authed/calendar/daily");
import "dayjs/locale/es";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

function CalendarDailyPage() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const { appliedFilters, availableCategories, currentSelectedDate, daily, defaults, loading } =
    useCalendarEvents();

  // Local state for filter draft
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const { isOpen: filtersOpen, set: setFiltersOpen } = useDisclosure(false);

  // Sync draft with applied filters when popover is closed
  useEffect(() => {
    if (!filtersOpen) {
      setDraftFilters(appliedFilters);
    }
  }, [appliedFilters, filtersOpen]);

  // Get data for selected Day
  const selectedDayEntry = daily?.days.find(
    (d) =>
      dayjs(d.date, "YYYY-MM-DD").format("YYYY-MM-DD") ===
      dayjs(currentSelectedDate).format("YYYY-MM-DD"),
  );

  const hasEvents = (selectedDayEntry?.events.length ?? 0) > 0;

  return (
    <section className="space-y-4">
      {/* Header with Navigation */}
      <header className="space-y-2.5">
        <DayNavigation
          onSelect={(newDate: Date) => {
            void navigate({
              search: (prev) => ({
                ...prev,
                date: dayjs(newDate).format("YYYY-MM-DD"),
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
              filters={draftFilters}
              isOpen={filtersOpen}
              layout="dropdown"
              loading={loading}
              onApply={() => {
                void navigate({
                  search: {
                    ...search,
                    calendarId: draftFilters.calendarIds?.length
                      ? draftFilters.calendarIds
                      : undefined,
                    category: draftFilters.categories,
                    search: draftFilters.search || undefined,
                  },
                });
                setFiltersOpen(false);
              }}
              onFilterChange={(key, value) => {
                setDraftFilters((prev) => ({ ...prev, [key]: value }));
              }}
              onOpenChange={setFiltersOpen}
              onReset={() => {
                setDraftFilters(defaults);
                void navigate({
                  search: (prev: Record<string, unknown>) => ({
                    ...prev,
                    calendarId: undefined,
                    category: [],
                    search: undefined,
                  }),
                });
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
          events={selectedDayEntry.events}
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
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-default-100 border-dashed bg-background/50 py-12 text-center">
                <div className="mb-3 rounded-full bg-default-50 p-3">
                  <Filter className="h-6 w-6 text-default-200" />
                </div>
                <h3 className="font-semibold text-default-600">Sin eventos</h3>
                <p className="mt-1 max-w-xs text-default-400 text-sm">
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
              <div className="flex justify-center pt-2 text-default-300 text-xs">
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
export { CalendarDailyPage };
