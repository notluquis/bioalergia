import Button from "@/components/ui/Button";
import type { MissingFieldFilters } from "../api";

interface ClassificationFiltersProps {
  filters: MissingFieldFilters;
  // biome-ignore lint/suspicious/noExplicitAny: TanStack Router navigate type is complex with search params mutations
  onNavigate: (search: any) => void;
}

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

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-default-400 text-xs font-medium tracking-wide uppercase">Filtrar:</span>
      <div className="flex flex-wrap gap-2">
        <Button
          className="text-xs font-medium"
          onClick={() => toggleFilter("missingCategory")}
          size="sm"
          variant={filters.missingCategory ? "tertiary" : "ghost"}
        >
          Sin categoría
        </Button>
        <Button
          className="text-xs font-medium"
          onClick={() => toggleFilter("missingAmount")}
          size="sm"
          variant={filters.missingAmount ? "tertiary" : "ghost"}
        >
          Sin monto
        </Button>
        <Button
          className="text-xs font-medium"
          onClick={() => toggleFilter("missingAttended")}
          size="sm"
          variant={filters.missingAttended ? "tertiary" : "ghost"}
        >
          Sin asistencia
        </Button>
        <Button
          className="text-xs font-medium"
          onClick={() => toggleFilter("missingDosage")}
          size="sm"
          variant={filters.missingDosage ? "tertiary" : "ghost"}
        >
          Sin dosis
        </Button>
        <Button
          className="text-xs font-medium"
          onClick={() => toggleFilter("missingTreatmentStage")}
          size="sm"
          variant={filters.missingTreatmentStage ? "tertiary" : "ghost"}
        >
          Sin etapa
        </Button>

        {hasActiveFilters && (
          <>
            <div className="bg-default-200 h-4 w-px mx-1" />
            <div className="flex overflow-hidden rounded-lg border border-default-200">
              <Button
                className="text-xs font-medium"
                onClick={() => {
                  // biome-ignore lint/suspicious/noExplicitAny: TanStack Router navigate requires complex types
                  onNavigate((prev: any) => ({
                    ...prev,
                    filterMode: undefined,
                    page: 0,
                  }));
                }}
                size="sm"
                variant={!filters.filterMode || filters.filterMode === "OR" ? "tertiary" : "ghost"}
              >
                Cualquiera
              </Button>
              <Button
                className="text-xs font-medium"
                onClick={() => {
                  // biome-ignore lint/suspicious/noExplicitAny: TanStack Router navigate requires complex types
                  onNavigate((prev: any) => ({
                    ...prev,
                    filterMode: "AND",
                    page: 0,
                  }));
                }}
                size="sm"
                variant={filters.filterMode === "AND" ? "tertiary" : "ghost"}
              >
                Todos
              </Button>
            </div>
            <Button
              className="text-xs font-medium"
              onClick={() => {
                onNavigate({ page: 0 });
              }}
              size="sm"
              variant="danger"
            >
              Limpiar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
