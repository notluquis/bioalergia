import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { Filter, X } from "lucide-react";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { today } from "@/lib/dates";
import { MultiSelectFilter, type MultiSelectOption } from "@/features/calendar/components/MultiSelectFilter";
import { CalendarSkeleton } from "@/features/calendar/components/CalendarSkeleton";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { numberFormatter } from "@/lib/format";
import { PAGE_CONTAINER } from "@/lib/styles";

// New Components
import { DailyStatsCards } from "@/features/calendar/components/DailyStatsCards";
import { DayNavigation } from "@/features/calendar/components/DayNavigation";
import { DailyEventCard } from "@/features/calendar/components/DailyEventCard";

dayjs.locale("es");
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

function CalendarDailyPage() {
  const {
    filters,
    appliedFilters,
    daily,
    loading,
    error,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    updateFilters,
    applyFilters,
    resetFilters,
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

  const toggleCalendar = (calendarId: string) => {
    updateFilters(
      "calendarIds",
      filters.calendarIds.includes(calendarId)
        ? filters.calendarIds.filter((id) => id !== calendarId)
        : [...filters.calendarIds, calendarId]
    );
  };

  const toggleEventType = (value: string) => {
    updateFilters(
      "eventTypes",
      filters.eventTypes.includes(value)
        ? filters.eventTypes.filter((id) => id !== value)
        : [...filters.eventTypes, value]
    );
  };

  const toggleCategory = (value: string) => {
    updateFilters(
      "categories",
      filters.categories.includes(value)
        ? filters.categories.filter((id) => id !== value)
        : [...filters.categories, value]
    );
  };

  const calendarOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCalendars.map((entry) => ({
        value: entry.calendarId,
        label: `${entry.calendarId} · ${numberFormatter.format(entry.total)}`,
      })),
    [availableCalendars]
  );

  const eventTypeOptions: MultiSelectOption[] = useMemo(
    () =>
      availableEventTypes.map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableEventTypes]
  );

  const categoryOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCategories.map((entry) => {
        const value = entry.category ?? NULL_CATEGORY_VALUE;
        const label = entry.category ?? "Sin clasificación";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableCategories]
  );

  // Get data for selected Day
  const selectedDayEntry = useMemo(() => {
    return daily?.days.find((d) => d.date === selectedDate);
  }, [daily, selectedDate]);

  const hasEvents = (selectedDayEntry?.events.length ?? 0) > 0;

  return (
    <section className={PAGE_CONTAINER}>
      {/* Compact Header with Navigation */}
      <header className="space-y-4">
        {/* Date Navigation - Primary focus */}
        <div className="flex items-center justify-between gap-4">
          <DayNavigation selectedDate={selectedDate} onSelect={setSelectedDate} />
          <Button
            variant={showFilters ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0 gap-2"
          >
            {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            <span className="hidden sm:inline">{showFilters ? "Cerrar" : "Filtros"}</span>
          </Button>
        </div>

        {/* Filters Panel (Collapsible) */}
        {showFilters && (
          <form
            className="border-base-300 bg-base-100 animate-in slide-in-from-top-2 rounded-xl border p-4 shadow-sm duration-200"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MultiSelectFilter
                label="Calendarios"
                options={calendarOptions}
                selected={filters.calendarIds}
                onToggle={toggleCalendar}
                placeholder="Todos"
              />
              <MultiSelectFilter
                label="Tipos de evento"
                options={eventTypeOptions}
                selected={filters.eventTypes}
                onToggle={toggleEventType}
                placeholder="Todos"
              />
              <MultiSelectFilter
                label="Clasificación"
                options={categoryOptions}
                selected={filters.categories}
                onToggle={toggleCategory}
                placeholder="Todas"
              />
            </div>

            <div className="border-base-200 mt-3 flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                Limpiar
              </Button>
              <Button type="submit" size="sm">
                Aplicar
              </Button>
            </div>
          </form>
        )}
      </header>

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {/* Stats Cards - Compact summary */}
      {selectedDayEntry && (
        <DailyStatsCards
          eventsCount={selectedDayEntry.total}
          amountExpected={selectedDayEntry.amountExpected}
          amountPaid={selectedDayEntry.amountPaid}
          className="mt-4"
        />
      )}

      {/* Main Content - Events List */}
      <div className="mt-6 space-y-3">
        {loading && !daily ? (
          <CalendarSkeleton days={1} />
        ) : !selectedDayEntry || !hasEvents ? (
          <div className="border-base-200 bg-base-100/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 text-center">
            <div className="bg-base-200 mb-3 rounded-full p-3">
              <Filter className="text-base-content/30 h-6 w-6" />
            </div>
            <h3 className="text-base-content/70 font-semibold">Sin eventos</h3>
            <p className="text-base-content/50 mt-1 max-w-xs text-sm">
              No hay eventos para el {dayjs(selectedDate).format("DD [de] MMMM")}.
            </p>
          </div>
        ) : (
          <>
            {selectedDayEntry.events.map((event) => (
              <DailyEventCard key={event.eventId} event={event} />
            ))}

            {/* Footer */}
            <div className="text-base-content/40 flex justify-center pt-2 text-xs">
              {selectedDayEntry.total} evento{selectedDayEntry.total !== 1 ? "s" : ""} ·{" "}
              {dayjs(selectedDate).format("dddd, D [de] MMMM")}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default CalendarDailyPage;
