/**
 * CalendarFilterPanel - Shared filter UI for calendar pages
 * Extracts duplicated filter logic from CalendarDailyPage, CalendarSchedulePage, etc.
 */

import type { ChangeEvent, FormEvent } from "react";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { numberFormatter } from "@/lib/format";

import { NULL_CATEGORY_VALUE, NULL_EVENT_TYPE_VALUE } from "../constants";
import { useCalendarSync } from "../hooks/useCalendarSync";
import type { CalendarFilters } from "../types";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";

export interface CalendarFilterPanelProps {
  /** Available categories for dropdown */
  availableCategories?: { category: null | string; total: number }[];
  /** Available event types for dropdown */
  availableEventTypes?: { eventType: null | string; total: number }[];
  /** Current filter state */
  filters: FilterPanelState;
  /** Whether filters have been modified */
  isDirty?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Callback when filters should be applied */
  onApply: () => void;
  /** Callback when a filter value changes - compatible with useCalendarEvents updateFilters */
  onFilterChange: <K extends keyof FilterPanelState>(key: K, value: CalendarFilters[K]) => void;
  /** Callback when filters should be reset */
  onReset: () => void;
  /** Show date range inputs */
  showDateRange?: boolean;
  /** Show search input */
  showSearch?: boolean;
}

/** Filter state used by the filter panel - subset of CalendarFilters */
export type FilterPanelState = Pick<
  CalendarFilters,
  "categories" | "eventTypes" | "from" | "search" | "to"
>;

/**
 * Shared filter panel for calendar pages
 * Reduces code duplication across CalendarDailyPage, CalendarSchedulePage, CalendarHeatmapPage
 */
export function CalendarFilterPanel({
  availableCategories = [],
  availableEventTypes = [],
  filters,
  isDirty = true,
  loading = false,
  onApply,
  onFilterChange,
  onReset,
  showDateRange = false,
  showSearch = false,
}: Readonly<CalendarFilterPanelProps>) {
  // ... (keep logic)
  // Build event type options for MultiSelect
  const eventTypeOptions: MultiSelectOption[] = availableEventTypes.map((entry) => {
    const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
    const label = entry.eventType ?? "Sin tipo";
    return { label: `${label} · ${numberFormatter.format(entry.total)}`, value };
  });

  // Build category options for MultiSelect
  const categoryOptions: MultiSelectOption[] = availableCategories.map((entry) => {
    const value = entry.category ?? NULL_CATEGORY_VALUE;
    const label = entry.category ?? "Sin clasificación";
    return { label: `${label} · ${numberFormatter.format(entry.total)}`, value };
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  const { syncNow, syncing } = useCalendarSync();

  return (
    <Card className="animate-in slide-in-from-top-2 duration-200">
      <form className="flex flex-wrap items-end gap-3 p-3" onSubmit={handleSubmit}>
        {/* Date Range Inputs */}
        {showDateRange && (
          <>
            <div className="min-w-28 flex-1">
              <Input
                label="Desde"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  onFilterChange("from", e.target.value);
                }}
                type="date"
                value={filters.from}
              />
            </div>
            <div className="min-w-28 flex-1">
              <Input
                label="Hasta"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  onFilterChange("to", e.target.value);
                }}
                type="date"
                value={filters.to}
              />
            </div>
          </>
        )}

        {/* Event Types Filter */}
        {availableEventTypes.length > 0 && (
          <MultiSelectFilter
            className="flex-1 min-w-50"
            label="Tipos de evento"
            onChange={(values) => onFilterChange("eventTypes", values)}
            options={eventTypeOptions}
            placeholder="Todos"
            selected={filters.eventTypes ?? []}
          />
        )}

        {/* Categories Filter */}
        {availableCategories.length > 0 && (
          <MultiSelectFilter
            className="flex-1 min-w-50"
            label="Clasificación"
            onChange={(values) => onFilterChange("categories", values)}
            options={categoryOptions}
            placeholder="Todas"
            selected={filters.categories}
          />
        )}

        {/* Search Input */}
        {showSearch && (
          <div className="min-w-40 flex-1">
            <Input
              enterKeyHint="search"
              label="Buscar"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                onFilterChange("search", e.target.value);
              }}
              placeholder="Paciente, tratamiento..."
              value={filters.search ?? ""}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            disabled={syncing || loading}
            onClick={(e) => {
              e.preventDefault();
              syncNow();
            }}
            size="sm"
            type="button"
            variant="outline"
            className="mr-auto"
            title="Sincronizar con Google Calendar"
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>

          <Button
            disabled={loading || !isDirty}
            onClick={onReset}
            size="sm"
            type="button"
            variant="ghost"
          >
            Limpiar
          </Button>
          <Button disabled={loading} size="sm" type="submit">
            {loading ? "..." : "Aplicar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
