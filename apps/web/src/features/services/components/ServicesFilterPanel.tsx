import { type ChangeEvent } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import type { ServiceSummary, ServiceType } from "../types";

export interface ServicesFilterState {
  search: string;
  statuses: Set<ServiceSummary["status"]>;
  types: Set<ServiceType>;
}

interface ServicesFilterPanelProps {
  filters: ServicesFilterState;
  onChange: (next: ServicesFilterState) => void;
  services: ServiceSummary[];
}

const STATUS_LABELS: Record<ServiceSummary["status"], string> = {
  ACTIVE: "Activo",
  ARCHIVED: "Archivado",
  INACTIVE: "Sin pendientes",
};

const STATUS_ORDER: ServiceSummary["status"][] = ["ACTIVE", "INACTIVE", "ARCHIVED"];

export default function ServicesFilterPanel({ filters, onChange, services }: ServicesFilterPanelProps) {
  const typeOptions = (() => {
    const counts = new Map<ServiceType, number>();
    for (const service of services) {
      counts.set(service.service_type, (counts.get(service.service_type) ?? 0) + 1);
    }
    return [...counts.entries()].toSorted((a, b) => b[1] - a[1]);
  })();

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
    <section className="border-base-300 text-base-content bg-base-100 flex flex-col gap-4 border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base-content text-sm font-semibold">Filtros rápidos</p>
          <p className="text-base-content/50 text-xs">Filtra por estado, tipo o busca por nombre/detalle.</p>
        </div>
        <Button
          className="text-primary text-xs font-semibold tracking-wide uppercase hover:underline"
          onClick={resetFilters}
          size="sm"
          type="button"
          variant="secondary"
        >
          Limpiar filtros
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Input
            label="Buscar"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              handleSearchChange(event.target.value);
            }}
            placeholder="Nombre, detalle, contraparte..."
            value={filters.search}
          />
        </div>

        <div>
          <p className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">Estado</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUS_ORDER.map((status) => (
              <Button
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  filters.statuses.size === 0 || filters.statuses.has(status)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-base-300 bg-base-200 text-base-content/60 hover:border-primary/35 hover:text-primary"
                }`}
                key={status}
                onClick={() => {
                  handleStatusToggle(status);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                {STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">Tipo de servicio</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {typeOptions.map(([type, count]) => {
              const isActive = filters.types.size === 0 || filters.types.has(type);
              return (
                <Button
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? "border-secondary/40 bg-secondary/10 text-secondary"
                      : "border-base-300 bg-base-200 text-base-content/60 hover:border-secondary/35 hover:text-secondary"
                  }`}
                  key={type}
                  onClick={() => {
                    handleTypeToggle(type);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
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
