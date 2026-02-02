import Button from "@/components/ui/Button";
import type { MissingFieldFilters } from "../api";

interface ClassificationFiltersProps {
  filters: MissingFieldFilters;
  // biome-ignore lint/suspicious/noExplicitAny: TanStack Router navigate type is complex with search params mutations
  onNavigate: (search: any) => void;
}

const FILTER_BUTTONS = [
  { key: "missingCategory" as const, label: "Sin categoría" },
  { key: "missingAmount" as const, label: "Sin monto" },
  { key: "missingAttended" as const, label: "Sin asistencia" },
  { key: "missingDosage" as const, label: "Sin dosis" },
  { key: "missingTreatmentStage" as const, label: "Sin etapa" },
] as const;

export function ClassificationFilters({ filters, onNavigate }: ClassificationFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const toggleFilter = (key: keyof MissingFieldFilters) => {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router navigate requires complex types
    onNavigate((prev: any) => ({
      ...prev,
      [key]: !prev[key] || undefined,
      page: 0,
    }));
  };

  const setFilterMode = (mode: "AND" | undefined) => {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router navigate requires complex types
    onNavigate((prev: any) => ({
      ...prev,
      filterMode: mode,
      page: 0,
    }));
  };

  const clearFilters = () => {
    onNavigate({ page: 0 });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-default-400 text-xs font-medium tracking-wide uppercase">Filtrar:</span>
      <div className="flex flex-wrap gap-2">
        {FILTER_BUTTONS.map(({ key, label }) => (
          <Button
            key={key}
            className="text-xs font-medium"
            color={filters[key] ? "primary" : "default"}
            onClick={() => toggleFilter(key)}
            size="sm"
            type="button"
            variant={filters[key] ? "bordered" : "ghost"}
          >
            {label}
          </Button>
        ))}

        {hasActiveFilters && (
          <>
            <div className="bg-default-200 h-4 w-px mx-1" />
            <div className="flex gap-2">
              <Button
                className="text-xs font-medium"
                color={!filters.filterMode || filters.filterMode === "OR" ? "primary" : "default"}
                onClick={() => setFilterMode(undefined)}
                size="sm"
                type="button"
                variant={!filters.filterMode || filters.filterMode === "OR" ? "bordered" : "ghost"}
              >
                Cualquiera
              </Button>
              <Button
                className="text-xs font-medium"
                color={filters.filterMode === "AND" ? "primary" : "default"}
                onClick={() => setFilterMode("AND")}
                size="sm"
                type="button"
                variant={filters.filterMode === "AND" ? "bordered" : "ghost"}
              >
                Todos
              </Button>
            </div>
            <Button
              className="text-xs font-medium"
              color="danger"
              onClick={clearFilters}
              size="sm"
              type="button"
              variant="bordered"
            >
              Limpiar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
