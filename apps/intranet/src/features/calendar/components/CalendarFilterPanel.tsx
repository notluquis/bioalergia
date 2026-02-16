/**
 * CalendarFilterPanel - Shared filter UI for calendar pages
 * Redesigned to match "Filtrar Vistas" spec using HeroUI v3
 */

import { Button, DateField, DateInputGroup, Input, Label, TextField } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { RotateCcw } from "lucide-react";
import React, { type SubmitEvent } from "react";

import { cn } from "@/lib/utils";
import { NULL_CATEGORY_VALUE } from "../constants";
import type { CalendarFilters } from "../types";
import { MultiSelectFilter } from "./MultiSelectFilter";

export interface CalendarFilterPanelProps {
  className?: string;
  formClassName?: string;
  layout?: "row" | "dropdown";
  /** Available categories for dropdown */
  availableCategories?: { category: null | string; total: number }[];

  /** Current filter state */
  filters: FilterPanelState;
  /** Whether filters have been modified */
  isDirty?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Callback when filters should be applied */
  onApply: () => void;
  /** Count of items that would be shown after applying filters */
  applyCount?: number;
  /** Show sync button */
  showSync?: boolean;
  /** Callback when a filter value changes - compatible with useCalendarEvents updateFilters */
  onFilterChange: <K extends keyof FilterPanelState>(key: K, value: CalendarFilters[K]) => void;
  /** Callback when filters should be reset */
  onReset: () => void;
  /** Show date range inputs */
  showDateRange?: boolean;
  /** Show search input */
  showSearch?: boolean;
  variant?: "card" | "plain";
}

/** Filter state used by the filter panel - subset of CalendarFilters */
export type FilterPanelState = Pick<CalendarFilters, "categories" | "from" | "search" | "to">;

export function CalendarFilterPanel({
  className,
  formClassName,
  layout = "row",
  availableCategories = [],
  filters,
  isDirty: _isDirty = true,
  loading: _loading = false,
  onApply,
  applyCount,
  onFilterChange,
  onReset,
  showDateRange = false,
  showSearch = false,
  variant: _variant = "card",
}: Readonly<CalendarFilterPanelProps>) {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply();
  };

  // Calculate preview count based on current selection
  const liveApplyCount = React.useMemo(() => {
    if (!filters.categories.length) {
      return applyCount;
    }
    const selectedSet = new Set(filters.categories);
    return availableCategories
      .filter((c) => selectedSet.has(c.category ?? NULL_CATEGORY_VALUE))
      .reduce((sum, c) => sum + c.total, 0);
  }, [filters.categories, availableCategories, applyCount]);

  const applyLabel =
    liveApplyCount == null ? "Aplicar filtros" : `Aplicar filtros ${liveApplyCount}`;

  const isDropdownLayout = layout === "dropdown";

  // If layout is dropdown, use the new specific vertical design
  if (isDropdownLayout) {
    return (
      <form onSubmit={handleSubmit} className={cn("space-y-5 p-4", formClassName, className)}>
        {/* Categories Select */}
        <div className="space-y-1.5">
          <MultiSelectFilter
            label="Clasificación"
            placeholder="Todas"
            density="comfortable"
            options={availableCategories.map((entry) => ({
              value: entry.category ?? NULL_CATEGORY_VALUE,
              label: entry.category ?? "Sin clasificación",
            }))}
            selected={filters.categories}
            onChange={(values) => onFilterChange("categories", values)}
          />
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="space-y-1.5">
            <TextField className="w-full">
              <Label>Búsqueda</Label>
              <Input
                className="h-[44px] rounded-xl"
                placeholder="Paciente, tratamiento..."
                value={filters.search ?? ""}
                variant="secondary"
                onChange={(e) => onFilterChange("search", e.target.value)}
              />
            </TextField>
          </div>
        )}

        {/* Date Range (if enabled) - matching style */}
        {showDateRange && (
          <div className="space-y-1.5">
            <span className="mb-1.5 block font-semibold text-[10px] text-default-600 uppercase tracking-wider">
              Rango de Fechas
            </span>
            <div className="flex gap-2">
              <DateField
                className="flex-1"
                aria-label="Desde"
                value={filters.from ? parseDate(filters.from) : undefined}
                onChange={(d) => onFilterChange("from", d?.toString() ?? "")}
              >
                <DateInputGroup>
                  <DateInputGroup.Input>
                    {(segment) => <DateInputGroup.Segment segment={segment} />}
                  </DateInputGroup.Input>
                </DateInputGroup>
              </DateField>
              <DateField
                className="flex-1"
                aria-label="Hasta"
                value={filters.to ? parseDate(filters.to) : undefined}
                onChange={(d) => onFilterChange("to", d?.toString() ?? "")}
              >
                <DateInputGroup>
                  <DateInputGroup.Input>
                    {(segment) => <DateInputGroup.Segment segment={segment} />}
                  </DateInputGroup.Input>
                </DateInputGroup>
              </DateField>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={onReset}
            className="h-10 rounded-xl px-3 font-medium text-default-400 hover:text-foreground"
          >
            <RotateCcw size={14} />
            Limpiar
          </Button>

          <Button
            type="submit"
            variant="primary"
            className="h-10 rounded-xl px-6 font-semibold shadow-md shadow-primary/20"
          >
            {applyLabel}
          </Button>
        </div>
      </form>
    );
  }

  // Fallback for non-dropdown layout
  return (
    <form
      className={cn("flex flex-wrap items-end gap-3 p-3", formClassName, className)}
      onSubmit={handleSubmit}
    >
      <MultiSelectFilter
        className="min-w-64"
        label="Clasificación"
        density="compact"
        options={availableCategories.map((c) => ({
          value: c.category ?? NULL_CATEGORY_VALUE,
          label: c.category ?? "Sin clasificación",
        }))}
        selected={filters.categories}
        onChange={(values) => onFilterChange("categories", values)}
      />

      <Button size="sm" type="submit" variant="primary">
        Actualizar
      </Button>
    </form>
  );
}
