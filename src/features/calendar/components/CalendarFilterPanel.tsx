/**
 * CalendarFilterPanel - Shared filter UI for calendar pages
 * Extracts duplicated filter logic from CalendarDailyPage, CalendarSchedulePage, etc.
 */

import { useMemo, type FormEvent } from "react";
import type { ChangeEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";
import { NULL_EVENT_TYPE_VALUE, NULL_CATEGORY_VALUE } from "../constants";
import { numberFormatter } from "@/lib/format";

/** Filter state used by the filter panel - subset of CalendarFilters */
export interface FilterPanelState {
  from: string;
  to: string;
  eventTypes: string[];
  categories: string[];
  search?: string;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFilterChange: (key: any, value: any) => void;
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
    onFilterChange(
      "eventTypes",
      filters.eventTypes.includes(value)
        ? filters.eventTypes.filter((id) => id !== value)
        : [...filters.eventTypes, value]
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
    <form
      className="border-base-300 bg-base-100 animate-in slide-in-from-top-2 flex flex-wrap items-end gap-3 rounded-xl border p-3 shadow-sm duration-200"
      onSubmit={handleSubmit}
    >
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
            selected={filters.eventTypes}
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
  );
}
