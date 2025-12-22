import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { Filter, X } from "lucide-react";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

import Input from "@/components/ui/Input";
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
  // We try to keep a month loaded around the selected date
  useEffect(() => {
    const current = dayjs(selectedDate);
    const startOfMonth = current.startOf("month").format("YYYY-MM-DD");
    const endOfMonth = current.endOf("month").format("YYYY-MM-DD");

    // Only update if current view is drastically out of range to avoid loop
    // or if we want to ensure "month view" behavior
    const isOutOfRange = dayjs(appliedFilters.from).isAfter(current) || dayjs(appliedFilters.to).isBefore(current);

    // Check if the current range covers the month of selected date
    const rangeCoversMonth =
      dayjs(appliedFilters.from).isSameOrBefore(startOfMonth) && dayjs(appliedFilters.to).isSameOrAfter(endOfMonth);

    if (isOutOfRange || !rangeCoversMonth) {
      updateFilters("from", startOfMonth);
      updateFilters("to", endOfMonth);
      // We need to apply filters to trigger fetch
      // But updateFilters just updates "filters" state, applyFilters commits it to "appliedFilters"
      // We can't call applyFilters directly here easily without causing rendering loops if not careful
      // actually useCalendarEvents separates draft "filters" and "appliedFilters".

      // Let's set both
      updateFilters("from", startOfMonth);
      updateFilters("to", endOfMonth);
      // We defer the apply to the user or auto-apply?
      // Ideally for navigation, it should be auto.
      // For this redesign, let's auto-apply date range changes when navigating far.
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
      {/* Header & Navigation */}
      <header className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-base-content text-3xl font-bold tracking-tight">Detalle Diario</h1>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            {showFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            {showFilters ? "Ocultar filtros" : "Filtros"}
          </Button>
        </div>

        {/* Filters Panel (Collapsible) */}
        {showFilters && (
          <form
            className="border-base-300 bg-base-100 animate-in slide-in-from-top-2 grid gap-4 rounded-2xl border p-6 text-xs shadow-sm duration-200 md:grid-cols-6"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            {/* Date range inputs are less relevant now as we auto-navigate, 
                 but kept for explicit specific range override if needed 
                 or maybe strictly for other filters */}
            <div className="md:col-span-2 md:col-start-1">
              <p className="mb-2 font-semibold">Opciones de visualización</p>
              <Input
                label="Días máximos a cargar"
                type="number"
                min={1}
                max={120}
                value={filters.maxDays}
                onChange={(e) => updateFilters("maxDays", parseInt(e.target.value) || 31)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3 md:col-span-6">
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

            <div className="mt-2 flex justify-end gap-2 md:col-span-6">
              <Button type="button" variant="ghost" onClick={resetFilters}>
                Limpiar
              </Button>
              <Button type="submit">Aplicar cambios</Button>
            </div>
          </form>
        )}

        <DayNavigation selectedDate={selectedDate} onSelect={setSelectedDate} />
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Daily Stats */}
      {selectedDayEntry && (
        <DailyStatsCards
          eventsCount={selectedDayEntry.total}
          amountExpected={selectedDayEntry.amountExpected}
          amountPaid={selectedDayEntry.amountPaid}
          className="mt-6"
        />
      )}

      {/* Main Content */}
      <div className="mt-8 space-y-4">
        {loading && !daily ? (
          <CalendarSkeleton days={1} />
        ) : !selectedDayEntry || !hasEvents ? (
          <div className="border-base-200 bg-base-100/50 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed py-16 text-center">
            <div className="bg-base-200 mb-4 rounded-full p-4">
              <Filter className="text-base-content/30 h-8 w-8" />
            </div>
            <h3 className="text-base-content/70 text-lg font-semibold">Sin eventos para este día</h3>
            <p className="text-base-content/50 mt-1 max-w-xs text-sm">
              No hay eventos registrados para el {dayjs(selectedDate).format("DD [de] MMMM")}.
            </p>
            {/* Optional: Add "Create Event" button here later if needed */}
          </div>
        ) : (
          <div className="grid gap-3">
            {selectedDayEntry.events.map((event) => (
              <DailyEventCard key={event.eventId} event={event} />
            ))}

            {/* Summary Footer for the day */}
            <div className="text-base-content/40 flex justify-end pt-4 text-xs">
              Mostrando {selectedDayEntry.total} eventos
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default CalendarDailyPage;
