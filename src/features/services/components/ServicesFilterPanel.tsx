import { useMemo, type ChangeEvent } from "react";
import type { ServiceSummary, ServiceType } from "../types";
import Input from "../../../components/Input";
import Button from "../../../components/Button";

export type ServicesFilterState = {
  search: string;
  statuses: Set<string>;
  types: Set<ServiceType>;
};

type ServicesFilterPanelProps = {
  services: ServiceSummary[];
  filters: ServicesFilterState;
  onChange: (next: ServicesFilterState) => void;
};

const STATUS_LABELS: Record<ServiceSummary["status"], string> = {
  ACTIVE: "Activo",
  INACTIVE: "Sin pendientes",
  ARCHIVED: "Archivado",
};

const STATUS_ORDER: Array<ServiceSummary["status"]> = ["ACTIVE", "INACTIVE", "ARCHIVED"];

export default function ServicesFilterPanel({ services, filters, onChange }: ServicesFilterPanelProps) {
  const typeOptions = useMemo(() => {
    const counts = new Map<ServiceType, number>();
    services.forEach((service) => {
      counts.set(service.service_type, (counts.get(service.service_type) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [services]);

  const handleStatusToggle = (status: ServiceSummary["status"]) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onChange({ ...filters, statuses: next });
  };

  const handleTypeToggle = (type: ServiceType) => {
    const next = new Set(filters.types);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange({ ...filters, types: next });
  };

  const handleSearchChange = (value: string) => {
    onChange({ ...filters, search: value });
  };

  const resetFilters = () => {
    onChange({ search: "", statuses: new Set(), types: new Set() });
  };

  return (
    <section className="flex flex-col gap-4 border border-base-300 p-4 text-sm text-base-content bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-base-content">Filtros rápidos</p>
          <p className="text-xs text-base-content/50">Filtra por estado, tipo o busca por nombre/detalle.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={resetFilters}
          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          Limpiar filtros
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Input
            label="Buscar"
            placeholder="Nombre, detalle, contraparte..."
            value={filters.search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => handleSearchChange(event.target.value)}
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Estado</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUS_ORDER.map((status) => (
              <Button
                key={status}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleStatusToggle(status)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  filters.statuses.size === 0 || filters.statuses.has(status)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-base-300 bg-base-200 text-base-content/60 hover:border-primary/35 hover:text-primary"
                }`}
              >
                {STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Tipo de servicio</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {typeOptions.map(([type, count]) => {
              const isActive = filters.types.size === 0 || filters.types.has(type);
              return (
                <Button
                  key={type}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTypeToggle(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? "border-secondary/40 bg-secondary/10 text-secondary"
                      : "border-base-300 bg-base-200 text-base-content/60 hover:border-secondary/35 hover:text-secondary"
                  }`}
                >
                  {type.toLowerCase()} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
