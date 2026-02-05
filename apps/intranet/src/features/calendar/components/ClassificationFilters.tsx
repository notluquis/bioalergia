import { Button } from "@/components/ui/Button";
import type { MissingFieldFilters } from "../api";

interface ClassificationFiltersProps {
  filters: MissingFieldFilters;
  onSearchChange: (update: Partial<MissingFieldFilters> & { page?: number }) => void;
}

const FILTER_BUTTONS = [
  { key: "missingCategory" as const, label: "Sin categoría" },
  { key: "missingAmount" as const, label: "Sin monto" },
  { key: "missingAttended" as const, label: "Sin asistencia" },
  { key: "missingDosage" as const, label: "Sin dosis" },
  { key: "missingTreatmentStage" as const, label: "Sin etapa" },
] as const;

export function ClassificationFilters({ filters, onSearchChange }: ClassificationFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const toggleFilter = (key: keyof MissingFieldFilters) => {
    onSearchChange({
      missingCategory:
        key === "missingCategory" ? !filters.missingCategory : filters.missingCategory,
      missingAmount: key === "missingAmount" ? !filters.missingAmount : filters.missingAmount,
      missingAttended:
        key === "missingAttended" ? !filters.missingAttended : filters.missingAttended,
      missingDosage: key === "missingDosage" ? !filters.missingDosage : filters.missingDosage,
      missingTreatmentStage:
        key === "missingTreatmentStage"
          ? !filters.missingTreatmentStage
          : filters.missingTreatmentStage,
      filterMode: filters.filterMode,
      page: 0,
    });
  };

  const setFilterMode = (mode: "AND" | undefined) => {
    onSearchChange({
      missingCategory: filters.missingCategory,
      missingAmount: filters.missingAmount,
      missingAttended: filters.missingAttended,
      missingDosage: filters.missingDosage,
      missingTreatmentStage: filters.missingTreatmentStage,
      filterMode: mode,
      page: 0,
    });
  };

  const clearFilters = () => {
    onSearchChange({
      missingCategory: undefined,
      missingAmount: undefined,
      missingAttended: undefined,
      missingDosage: undefined,
      missingTreatmentStage: undefined,
      filterMode: undefined,
      page: 0,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-default-400 text-xs uppercase tracking-wide">Filtrar:</span>
      <div className="flex flex-wrap gap-2">
        {FILTER_BUTTONS.map(({ key, label }) => (
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
