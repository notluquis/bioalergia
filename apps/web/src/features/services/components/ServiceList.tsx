import dayjs from "dayjs";

import Button from "@/components/ui/Button";

import type { ServiceFrequency, ServiceSummary, ServiceType } from "../types";

interface ServiceListProps {
  services: ServiceSummary[];
  selectedId: string | null;
  onSelect: (publicId: string) => void;
  onCreateRequest: () => void;
  canManage: boolean;
  loading?: boolean;
}

export function ServiceList({
  services,
  selectedId,
  onSelect,
  onCreateRequest,
  canManage,
  loading = false,
}: ServiceListProps) {
  const skeletons = Array.from({ length: 5 }, (_, index) => index);

  return (
    <aside className="border-base-300/60 bg-base-100/80 text-base-content flex h-full min-h-80 flex-col gap-4 rounded-2xl border p-5 text-sm shadow-inner">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">Servicios</h2>
          <p className="text-base-content/60 text-xs">Suscripciones y gastos recurrentes.</p>
        </div>
        {canManage && (
          <Button type="button" variant="primary" size="sm" onClick={onCreateRequest}>
            Nuevo servicio
          </Button>
        )}
      </header>
      <div className="muted-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
        {loading &&
          services.length === 0 &&
          skeletons.map((value) => (
            <div key={value} className="border-base-300/60 bg-base-200/60 rounded-2xl border p-4 shadow-sm">
              <div className="skeleton-line mb-3 w-3/4" />
              <div className="text-base-content/50 flex gap-2 text-xs">
                <span className="skeleton-line w-20" />
                <span className="skeleton-line w-16" />
              </div>
            </div>
          ))}
        {services.map((service) => {
          const isActive = service.public_id === selectedId;
          const overdue = service.overdue_count > 0;
          const indicatorColor = (() => {
            if (overdue) return "bg-rose-400";
            if (service.pending_count === 0) return "bg-emerald-400";
            return "bg-amber-400";
          })();

          const frequencyLabels: Record<ServiceFrequency, string> = {
            WEEKLY: "Semanal",
            BIWEEKLY: "Quincenal",
            MONTHLY: "Mensual",
            BIMONTHLY: "Bimensual",
            QUARTERLY: "Trimestral",
            SEMIANNUAL: "Semestral",
            ANNUAL: "Anual",
            ONCE: "Única vez",
          };

          const typeLabels: Record<ServiceType, string> = {
            BUSINESS: "Operación",
            SUPPLIER: "Proveedor",
            UTILITY: "Servicios básicos",
            LEASE: "Arriendo",
            SOFTWARE: "Software",
            TAX: "Impuestos",
            PERSONAL: "Personal",
            OTHER: "Otro",
          };

          return (
            <button
              type="button"
              key={service.public_id}
              onClick={() => onSelect(service.public_id)}
              className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-base-300 bg-primary/20 text-primary"
                  : "bg-base-100/45 text-base-content hover:border-base-300 hover:bg-base-100/65 border-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">{service.name}</p>
                  {service.detail && (
                    <p className="text-base-content/50 text-xs tracking-wide uppercase">{service.detail}</p>
                  )}
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`} aria-hidden="true" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-base-content font-semibold">
                  ${service.default_amount.toLocaleString("es-CL")}
                </span>
                <span className="text-base-content/60">{frequencyLabels[service.frequency]}</span>
                <span className="text-base-content/60">{typeLabels[service.service_type]}</span>
              </div>
              <div className="text-base-content/50 mt-1 flex flex-wrap items-center gap-3 text-xs">
                <span>Inicio {dayjs(service.start_date).format("DD MMM YYYY")}</span>
                {service.counterpart_name && <span>{service.counterpart_name}</span>}
              </div>
              <div className="text-base-content/50 mt-2 text-xs">
                Pendientes {service.pending_count} · Vencidos {service.overdue_count}
              </div>
            </button>
          );
        })}
        {services.length === 0 && (
          <p className="border-base-300 bg-base-100/40 text-base-content/60 rounded-2xl border border-dashed p-4 text-xs">
            Aún no registras servicios recurrentes. Crea el primero para controlar gastos mensuales.
          </p>
        )}
      </div>
    </aside>
  );
}

export default ServiceList;
