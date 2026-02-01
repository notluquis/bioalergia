/**
 * CalendarFilterPanel - Shared filter UI for calendar pages
 * Redesigned to match "Filtrar Vistas" spec using HeroUI v3
 */

import { DateField, DateInputGroup } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { RotateCcw, Search } from "lucide-react";
import type { FormEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

import { NULL_CATEGORY_VALUE } from "../constants";
import type { CalendarFilters } from "../types";

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
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onApply();
  };

  const applyLabel = applyCount == null ? "Aplicar filtros" : `Aplicar filtros ${applyCount}`;

  const isDropdownLayout = layout === "dropdown";

  // If layout is dropdown, use the new specific vertical design
  if (isDropdownLayout) {
    return (
      <form onSubmit={handleSubmit} className={cn("p-4 space-y-5", formClassName, className)}>
        {/* Categories Select */}
        <div className="space-y-1.5">
          <Select
            label="Clasificación"
            placeholder="Todas"
            // @ts-expect-error
            selectionMode="multiple"
            selectedKeys={new Set(filters.categories)}
            // biome-ignore lint/suspicious/noExplicitAny: Select selection mode type inference
            onSelectionChange={(keys: any) => {
              if (keys === "all") {
                const allValues = availableCategories.map((c) => c.category ?? NULL_CATEGORY_VALUE);
                onFilterChange("categories", allValues);
              } else {
                const values = Array.from(keys).map(String);
                onFilterChange("categories", values);
              }
            }}
            classNames={{
              trigger: "bg-default-100 hover:bg-default-200 border border-default-200 min-h-[40px]",
              popoverContent: "bg-content1 border border-default-200",
            }}
          >
            {availableCategories.map((entry) => {
              const value = entry.category ?? NULL_CATEGORY_VALUE;
              const label = entry.category ?? "Sin clasificación";
              return (
                <SelectItem key={value} textValue={label}>
                  <div className="flex justify-between items-center w-full">
                    <span>{label}</span>
                    <span className="text-tiny text-default-400">{entry.total}</span>
                  </div>
                </SelectItem>
              );
            })}
          </Select>
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="space-y-1.5">
            <Input
              label="Búsqueda"
              placeholder="Paciente, tratamiento..."
              value={filters.search ?? ""}
              onChange={(e) => onFilterChange("search", e.target.value)}
              startContent={<Search className="text-default-400" size={18} />}
              containerClassName="h-[40px]"
              className="bg-default-100 hover:bg-default-200 border-default-200"
            />
          </div>
        )}

        {/* Date Range (if enabled) - matching style */}
        {showDateRange && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-default-600 uppercase tracking-wider block mb-1.5">
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
            onClick={onReset}
            className="text-default-500 hover:text-foreground px-3 font-medium h-9"
            startContent={<RotateCcw size={14} />}
          >
            Limpiar
          </Button>

          <Button
            type="submit"
            color="primary"
            className="font-medium bg-blue-600 text-white h-9 px-4 rounded-lg text-sm"
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
      <Select
        className="min-w-48"
        label="Clasificación"
        size="sm"
        // @ts-expect-error
        selectionMode="multiple"
        selectedKeys={new Set(filters.categories)}
        // biome-ignore lint/suspicious/noExplicitAny: Select selection mode type inference
        onSelectionChange={(keys: any) => {
          if (keys === "all") return;
          onFilterChange("categories", Array.from(keys).map(String));
        }}
      >
        {availableCategories.map((c) => (
          <SelectItem key={c.category ?? NULL_CATEGORY_VALUE}>
            {c.category ?? "Sin clasificación"}
          </SelectItem>
        ))}
      </Select>

      <Button type="submit" size="sm" color="primary">
        Actualizar
      </Button>
    </form>
  );
}
