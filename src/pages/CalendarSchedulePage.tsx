import { useMemo, useState, lazy, Suspense } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { Filter, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";
import { MultiSelectFilter, type MultiSelectOption } from "@/features/calendar/components/MultiSelectFilter";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { numberFormatter } from "@/lib/format";
import { PAGE_CONTAINER } from "@/lib/styles";

const ScheduleCalendar = lazy(() => import("@/features/calendar/components/ScheduleCalendar"));

dayjs.locale("es");

const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

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

  const allEvents = useMemo(() => daily?.days.flatMap((day) => day.events) ?? [], [daily?.days]);

  // Navigation helpers
  const currentFrom = dayjs(filters.from);
  const currentTo = dayjs(filters.to);
  const rangeLabel =
    currentFrom.isValid() && currentTo.isValid()
      ? `${currentFrom.format("D MMM")} - ${currentTo.format("D MMM YYYY")}`
      : "Seleccionar rango";

  const goToPreviousWeek = () => {
    const newFrom = currentFrom.subtract(1, "week").format("YYYY-MM-DD");
    const newTo = currentTo.subtract(1, "week").format("YYYY-MM-DD");
    updateFilters("from", newFrom);
    updateFilters("to", newTo);
    applyFilters();
  };

  const goToNextWeek = () => {
    const newFrom = currentFrom.add(1, "week").format("YYYY-MM-DD");
    const newTo = currentTo.add(1, "week").format("YYYY-MM-DD");
    updateFilters("from", newFrom);
    updateFilters("to", newTo);
    applyFilters();
  };

  const goToThisWeek = () => {
    const thisWeekStart = dayjs().startOf("week").add(1, "day"); // Monday
    const thisWeekEnd = thisWeekStart.add(6, "day"); // Sunday
    updateFilters("from", thisWeekStart.format("YYYY-MM-DD"));
    updateFilters("to", thisWeekEnd.format("YYYY-MM-DD"));
    applyFilters();
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
          <form
            className="border-base-300 bg-base-100 animate-in slide-in-from-top-2 flex flex-wrap items-end gap-3 rounded-xl border p-3 shadow-sm duration-200"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="min-w-28 flex-1">
              <Input
                label="Desde"
                type="date"
                value={filters.from}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("from", event.target.value)}
              />
            </div>
            <div className="min-w-28 flex-1">
              <Input
                label="Hasta"
                type="date"
                value={filters.to}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("to", event.target.value)}
              />
            </div>
            <div className="min-w-32 flex-1">
              <MultiSelectFilter
                label="Tipos de evento"
                options={eventTypeOptions}
                selected={filters.eventTypes}
                onToggle={(value) => {
                  updateFilters(
                    "eventTypes",
                    filters.eventTypes.includes(value)
                      ? filters.eventTypes.filter((id) => id !== value)
                      : [...filters.eventTypes, value]
                  );
                }}
                placeholder="Todos"
              />
            </div>
            <div className="min-w-32 flex-1">
              <MultiSelectFilter
                label="Clasificación"
                options={categoryOptions}
                selected={filters.categories}
                onToggle={(value) => {
                  updateFilters(
                    "categories",
                    filters.categories.includes(value)
                      ? filters.categories.filter((id) => id !== value)
                      : [...filters.categories, value]
                  );
                }}
                placeholder="Todas"
              />
            </div>
            <div className="min-w-40 flex-1">
              <Input
                label="Buscar"
                placeholder="Paciente, tratamiento..."
                value={filters.search}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("search", event.target.value)}
                enterKeyHint="search"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={loading || !isDirty} onClick={resetFilters}>
                Limpiar
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "..." : "Aplicar"}
              </Button>
            </div>
          </form>
        )}
      </header>

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      {/* Calendar - Main Content */}
      <div className="mt-4">
        <Suspense
          fallback={
            <div className="bg-base-200/50 border-base-300 flex h-96 items-center justify-center rounded-2xl border">
              <div className="flex flex-col items-center gap-2">
                <Calendar className="text-primary h-8 w-8 animate-pulse" />
                <span className="text-base-content/50 text-sm">Cargando calendario...</span>
              </div>
            </div>
          }
        >
          <ScheduleCalendar events={allEvents} loading={loading} />
        </Suspense>
      </div>
    </section>
  );
}

export default CalendarSchedulePage;
