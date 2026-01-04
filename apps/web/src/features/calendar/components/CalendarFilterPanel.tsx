/**
 * CalendarFilterPanel - Shared filter UI for calendar pages
 * Extracts duplicated filter logic from CalendarDailyPage, CalendarSchedulePage, etc.
 */

import type { ChangeEvent } from "react";
import { type FormEvent, useMemo } from "react";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { numberFormatter } from "@/lib/format";

import { NULL_CATEGORY_VALUE, NULL_EVENT_TYPE_VALUE } from "../constants";
import { CalendarFilters } from "../types";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";

/** Filter state used by the filter panel - subset of CalendarFilters */
export type FilterPanelState = Pick<CalendarFilters, "from" | "to" | "eventTypes" | "categories" | "search">;

export interface CalendarFilterPanelProps {
  /** Current filter state */
  filters: FilterPanelState;
  /** Available event types for dropdown */
  availableEventTypes?: Array<{ eventType: string | null; total: number }>;
  /** Available categories for dropdown */
  availableCategories?: Array<{ category: string | null; total: number }>;
  /** Show date range inputs */
  showDateRange?: boolean;
  /** Show search input */
  showSearch?: boolean;
  /** Callback when a filter value changes - compatible with useCalendarEvents updateFilters */
  onFilterChange: <K extends keyof FilterPanelState>(key: K, value: CalendarFilters[K]) => void;
  /** Callback when filters should be applied */
  onApply: () => void;
  /** Callback when filters should be reset */
  onReset: () => void;
  /** Loading state */
  loading?: boolean;
  /** Whether filters have been modified */
  isDirty?: boolean;
}

/**
 * Shared filter panel for calendar pages
 * Reduces code duplication across CalendarDailyPage, CalendarSchedulePage, CalendarHeatmapPage
 */
export function CalendarFilterPanel({
  filters,
  availableEventTypes = [],
  availableCategories = [],
  showDateRange = false,
  showSearch = false,
  onFilterChange,
  onApply,
  onReset,
  loading = false,
  isDirty = true,
}: CalendarFilterPanelProps) {
  // ... (keep logic)
  // Build event type options for MultiSelect
  const eventTypeOptions: MultiSelectOption[] = useMemo(
    () =>
      availableEventTypes.map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableEventTypes]
  );

  // Build category options for MultiSelect
  const categoryOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCategories.map((entry) => {
        const value = entry.category ?? NULL_CATEGORY_VALUE;
        const label = entry.category ?? "Sin clasificación";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableCategories]
  );

  const toggleEventType = (value: string) => {
    const currentTypes = filters.eventTypes ?? [];
    onFilterChange(
      "eventTypes",
      currentTypes.includes(value) ? currentTypes.filter((id) => id !== value) : [...currentTypes, value]
    );
  };

  const toggleCategory = (value: string) => {
    onFilterChange(
      "categories",
      filters.categories.includes(value)
        ? filters.categories.filter((id) => id !== value)
        : [...filters.categories, value]
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  return (
    <Card className="animate-in slide-in-from-top-2 duration-200">
      <form className="flex flex-wrap items-end gap-3 p-3" onSubmit={handleSubmit}>
        {/* Date Range Inputs */}
        {showDateRange && (
          <>
            <div className="min-w-28 flex-1">
              <Input
                label="Desde"
                type="date"
                value={filters.from}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange("from", e.target.value)}
              />
            </div>
            <div className="min-w-28 flex-1">
              <Input
                label="Hasta"
                type="date"
                value={filters.to}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange("to", e.target.value)}
              />
            </div>
          </>
        )}

        {/* Event Types Filter */}
        {availableEventTypes.length > 0 && (
          <div className="min-w-35 flex-1">
            <MultiSelectFilter
              label="Tipos de evento"
              options={eventTypeOptions}
              selected={filters.eventTypes ?? []}
              onToggle={toggleEventType}
              placeholder="Todos"
            />
          </div>
        )}

        {/* Categories Filter */}
        {availableCategories.length > 0 && (
          <div className="min-w-35 flex-1">
            <MultiSelectFilter
              label="Clasificación"
              options={categoryOptions}
              selected={filters.categories}
              onToggle={toggleCategory}
              placeholder="Todas"
            />
          </div>
        )}

        {/* Search Input */}
        {showSearch && (
          <div className="min-w-40 flex-1">
            <Input
              label="Buscar"
              placeholder="Paciente, tratamiento..."
              value={filters.search ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onFilterChange("search", e.target.value)}
              enterKeyHint="search"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={loading || !isDirty} onClick={onReset}>
            Limpiar
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "..." : "Aplicar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
