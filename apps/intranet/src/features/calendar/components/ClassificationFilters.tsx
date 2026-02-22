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

export function ClassificationFilters({
  availableFilters,
  filters,
  onSearchChange,
}: ClassificationFiltersProps) {
  const filterButtons = availableFilters?.length ? availableFilters : DEFAULT_FILTER_BUTTONS;
  const activeMissing = filters.missing ?? [];

  const hasActiveFilters = activeMissing.length > 0 || Boolean(filters.filterMode);

  const toggleFilter = (key: string) => {
    const currentMissing = new Set(activeMissing);
    if (currentMissing.has(key)) {
      currentMissing.delete(key);
    } else {
      currentMissing.add(key);
    }

    const nextMissing = [...currentMissing];

    onSearchChange({
      filterMode: filters.filterMode,
      missing: nextMissing.length > 0 ? nextMissing : undefined,
      page: 0,
    });
  };

  const setFilterMode = (mode: "AND" | undefined) => {
    onSearchChange({
      filterMode: mode,
      missing: activeMissing.length > 0 ? activeMissing : undefined,
      page: 0,
    });
  };

  const clearFilters = () => {
    onSearchChange({
      filterMode: undefined,
      missing: undefined,
      page: 0,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-default-400 text-xs uppercase tracking-wide">Filtrar:</span>
      <div className="flex flex-wrap gap-2">
        {filterButtons.map(({ key, label }) => (
          <Button
            key={key}
            className="font-medium text-xs"
            color={activeMissing.includes(key) ? "primary" : "default"}
            onClick={() => toggleFilter(key)}
            size="sm"
            type="button"
            variant={activeMissing.includes(key) ? "secondary" : "ghost"}
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
