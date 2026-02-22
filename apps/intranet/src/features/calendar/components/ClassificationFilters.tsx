import { Button } from "@/components/ui/Button";
import type { MissingFieldFilters } from "../api";

interface ClassificationFiltersProps {
  availableFilters?: readonly { key: string; label: string }[];
  filters: MissingFieldFilters;
  onSearchChange: (update: Partial<MissingFieldFilters> & { page?: number }) => void;
}

const DEFAULT_FILTER_BUTTONS = [
  { key: "missingCategory", label: "Sin categoría" },
  { key: "missingAmountExpected", label: "Sin monto esperado" },
  { key: "missingAmountPaid", label: "Sin monto pagado" },
  { key: "missingAttended", label: "Sin asistencia" },
  { key: "missingDosage", label: "Sin dosis" },
  { key: "missingTreatmentStage", label: "Sin etapa" },
] as const;

const SUPPORTED_FILTER_KEYS = [
  "missingCategory",
  "missingAmountExpected",
  "missingAmountPaid",
  "missingAttended",
  "missingDosage",
  "missingTreatmentStage",
] as const;

type SupportedFilterKey = (typeof SUPPORTED_FILTER_KEYS)[number];

function isSupportedFilterKey(key: string): key is SupportedFilterKey {
  return (SUPPORTED_FILTER_KEYS as readonly string[]).includes(key);
}

export function ClassificationFilters({
  availableFilters,
  filters,
  onSearchChange,
}: ClassificationFiltersProps) {
  const filterButtons = (
    availableFilters?.length ? availableFilters : DEFAULT_FILTER_BUTTONS
  ).filter((f) => isSupportedFilterKey(f.key)) as ReadonlyArray<{
    key: SupportedFilterKey;
    label: string;
  }>;

  const hasActiveFilters =
    filterButtons.some(({ key }) => Boolean(filters[key])) || Boolean(filters.filterMode);

  const toggleFilter = (key: SupportedFilterKey) => {
    const next: Partial<MissingFieldFilters> & { page: number } = {
      filterMode: filters.filterMode,
      page: 0,
    };
    for (const candidate of SUPPORTED_FILTER_KEYS) {
      next[candidate] = candidate === key ? !filters[candidate] : filters[candidate];
    }
    // Clear legacy alias to keep URL clean and avoid ambiguity.
    next.missingAmount = undefined;
    onSearchChange(next);
  };

  const setFilterMode = (mode: "AND" | undefined) => {
    const next: Partial<MissingFieldFilters> & { page: number } = { filterMode: mode, page: 0 };
    for (const candidate of SUPPORTED_FILTER_KEYS) {
      next[candidate] = filters[candidate];
    }
    next.missingAmount = undefined;
    onSearchChange(next);
  };

  const clearFilters = () => {
    const next: Partial<MissingFieldFilters> & { page: number } = {
      filterMode: undefined,
      missingAmount: undefined,
      page: 0,
    };
    for (const candidate of SUPPORTED_FILTER_KEYS) {
      next[candidate] = undefined;
    }
    onSearchChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-default-400 text-xs uppercase tracking-wide">Filtrar:</span>
      <div className="flex flex-wrap gap-2">
        {filterButtons.map(({ key, label }) => (
          <Button
            key={key}
            className="font-medium text-xs"
            color={filters[key] ? "primary" : "default"}
            onClick={() => toggleFilter(key)}
            size="sm"
            type="button"
            variant={filters[key] ? "secondary" : "ghost"}
          >
            {label}
          </Button>
        ))}

        {hasActiveFilters && (
          <>
            <div className="mx-1 h-4 w-px bg-default-200" />
            <div className="flex gap-2">
              <Button
                className="font-medium text-xs"
                color={!filters.filterMode || filters.filterMode === "OR" ? "primary" : "default"}
                onClick={() => setFilterMode(undefined)}
                size="sm"
                type="button"
                variant={!filters.filterMode || filters.filterMode === "OR" ? "secondary" : "ghost"}
              >
                Cualquiera
              </Button>
              <Button
                className="font-medium text-xs"
                color={filters.filterMode === "AND" ? "primary" : "default"}
                onClick={() => setFilterMode("AND")}
                size="sm"
                type="button"
                variant={filters.filterMode === "AND" ? "secondary" : "ghost"}
              >
                Todos
              </Button>
            </div>
            <Button
              className="font-medium text-xs"
              color="danger"
              onClick={clearFilters}
              size="sm"
              type="button"
              variant="tertiary"
            >
              Limpiar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
