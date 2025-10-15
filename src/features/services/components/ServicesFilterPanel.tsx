import { useMemo, type ChangeEvent } from "react";
import type { ServiceSummary, ServiceType } from "../types";
import Input from "../../../components/Input";

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
    <section className="glass-card glass-underlay-gradient flex flex-col gap-4 border border-white/40 p-4 text-sm text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Filtros rápidos</p>
          <p className="text-xs text-slate-400">Filtra por estado, tipo o busca por nombre/detalle.</p>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)] hover:underline"
        >
          Limpiar filtros
        </button>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusToggle(status)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  filters.statuses.size === 0 || filters.statuses.has(status)
                    ? "border-[var(--brand-primary)]/40 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "border-white/40 bg-white/50 text-slate-500 hover:border-[var(--brand-primary)]/35 hover:text-[var(--brand-primary)]"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de servicio</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {typeOptions.map(([type, count]) => {
              const isActive = filters.types.size === 0 || filters.types.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeToggle(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? "border-[var(--brand-secondary)]/40 bg-[var(--brand-secondary)]/10 text-[var(--brand-secondary)]"
                      : "border-white/40 bg-white/50 text-slate-500 hover:border-[var(--brand-secondary)]/35 hover:text-[var(--brand-secondary)]"
                  }`}
                >
                  {type.toLowerCase()} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
