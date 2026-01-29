/**
 * CalendarFilterPanel - Shared filter UI for calendar pages
 * Extracts duplicated filter logic from CalendarDailyPage, CalendarSchedulePage, etc.
 */

import { DatePicker } from "@heroui/date-picker";
import { type DateValue, parseDate } from "@internationalized/date";
import { RefreshCw } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

import { NULL_CATEGORY_VALUE } from "../constants";
import { useCalendarSync } from "../hooks/useCalendarSync";
import type { CalendarFilters } from "../types";
import { MultiSelectFilter, type MultiSelectOption } from "./MultiSelectFilter";

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

function dateContainerClass(isDropdownLayout: boolean) {
  return cn(isDropdownLayout ? "sm:col-span-1" : "min-w-28 flex-1");
}

function categoryClass(isDropdownLayout: boolean, showDateRange: boolean, showSearch: boolean) {
  if (!isDropdownLayout) return "flex-1 min-w-44";
  if (showDateRange && !showSearch) return "sm:col-span-2";
  return "sm:col-span-1";
}

function searchClass(isDropdownLayout: boolean) {
  return cn(isDropdownLayout ? "sm:col-span-2" : "min-w-44 flex-1");
}

function actionClass(isDropdownLayout: boolean) {
  return cn(
    "flex w-full flex-wrap items-center gap-2",
    isDropdownLayout
      ? "sm:col-span-2 justify-between border-t border-default-100/70 pt-4 sm:justify-end"
      : "ml-auto",
  );
}

/**
 * Shared filter panel for calendar pages
 * Reduces code duplication across CalendarDailyPage, CalendarSchedulePage, CalendarHeatmapPage
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: shared filter with many toggles
export function CalendarFilterPanel({
  className,
  formClassName,
  layout = "row",
  availableCategories = [],

  filters,
  isDirty = true,
  loading = false,
  onApply,
  applyCount,
  showSync = true,
  onFilterChange,
  onReset,
  showDateRange = false,
  showSearch = false,
  variant = "card",
}: Readonly<CalendarFilterPanelProps>) {
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
  const applyLabel =
    applyCount == null ? "Aplicar" : `Aplicar · ${numberFormatter.format(applyCount)}`;

  const isDropdownLayout = layout === "dropdown";
  const hasCategories = availableCategories.length > 0;
  const form = (
    <form
      className={cn(
        isDropdownLayout
          ? "grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:items-start"
          : "flex flex-wrap items-end gap-3 p-3",
        formClassName,
      )}
      onSubmit={handleSubmit}
    >
      {/* Date Range Inputs */}
      {showDateRange && (
        <>
          <div className={dateContainerClass(isDropdownLayout)}>
            <DatePicker
              label="Desde"
              className="max-w-xs"
              classNames={{
                inputWrapper: "bg-content1",
                selectorButton: "bg-default-100 hover:bg-default-200 border border-default-200",
                selectorIcon: "text-foreground-500",
                calendarContent: "bg-content1",
              }}
              value={filters.from ? parseDate(filters.from) : undefined}
              onChange={(date: DateValue | null) =>
                onFilterChange("from", date ? date.toString() : "")
              }
              labelPlacement="inside"
              variant="bordered"
            />
          </div>
          <div className={dateContainerClass(isDropdownLayout)}>
            <DatePicker
              label="Hasta"
              className="max-w-xs"
              classNames={{
                inputWrapper: "bg-content1",
                selectorButton: "bg-default-100 hover:bg-default-200 border border-default-200",
                selectorIcon: "text-foreground-500",
                calendarContent: "bg-content1",
              }}
              value={filters.to ? parseDate(filters.to) : undefined}
              onChange={(date: DateValue | null) =>
                onFilterChange("to", date ? date.toString() : "")
              }
              labelPlacement="inside"
              variant="bordered"
            />
          </div>
        </>
      )}

      {/* Categories Filter */}
      {hasCategories && (
        <MultiSelectFilter
          className={cn(categoryClass(isDropdownLayout, showDateRange, showSearch))}
          density="compact"
          label="Clasificación"
          onChange={(values) => onFilterChange("categories", values)}
          options={categoryOptions}
          placeholder="Todas"
          selected={filters.categories}
        />
      )}

      {/* Search Input */}
      {showSearch && (
        <div className={searchClass(isDropdownLayout)}>
          <Input
            enterKeyHint="search"
            label="Buscar"
            size="sm"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              onFilterChange("search", e.target.value);
            }}
            placeholder="Paciente, tratamiento..."
            value={filters.search ?? ""}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className={cn(actionClass(isDropdownLayout))}>
        {showSync && (
          <Button
            disabled={syncing || loading}
            onClick={(e) => {
              e.preventDefault();
              syncNow();
            }}
            isIconOnly
            size="sm"
            type="button"
            variant="outline"
            title="Sincronizar con Google Calendar"
          >
            <RefreshCw className={syncing ? "animate-spin" : ""} size={14} />
            <span className="sr-only">Sincronizar</span>
          </Button>
        )}

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
          {loading ? "..." : applyLabel}
        </Button>
      </div>
    </form>
  );

  if (variant === "plain") {
    return form;
  }

  return (
    <Card
      className={cn(
        "animate-in slide-in-from-top-2 origin-top rounded-xl border border-default-200/70 bg-content1/70 shadow-sm backdrop-blur duration-200 ease-out",
        className,
      )}
    >
      {form}
    </Card>
  );
}
