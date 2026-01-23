import dayjs from "dayjs";

import Button from "@/components/ui/Button";

import type { ServiceFrequency, ServiceSummary, ServiceType } from "../types";

interface ServiceListProps {
  canManage: boolean;
  loading?: boolean;
  onCreateRequest: () => void;
  onSelect: (publicId: string) => void;
  selectedId: null | string;
  services: ServiceSummary[];
}

export function ServiceList({
  canManage,
  loading = false,
  onCreateRequest,
  onSelect,
  selectedId,
  services,
}: ServiceListProps) {
  const skeletons = Array.from({ length: 5 }, (_, index) => index);

  return (
    <aside className="border-default-200/60 bg-background/80 text-foreground flex h-full min-h-80 flex-col gap-4 rounded-2xl border p-5 text-sm shadow-inner">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-default-500 text-xs font-semibold tracking-wide uppercase">
            Servicios
          </h2>
          <p className="text-default-500 text-xs">Suscripciones y gastos recurrentes.</p>
        </div>
        {canManage && (
          <Button onClick={onCreateRequest} size="sm" type="button" variant="primary">
            Nuevo servicio
          </Button>
        )}
      </header>
      <div className="muted-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
        {loading &&
          services.length === 0 &&
          skeletons.map((value) => (
            <div
              className="border-default-200/60 bg-default-50/60 rounded-2xl border p-4 shadow-sm"
              key={value}
            >
              <div className="skeleton-line mb-3 w-3/4" />
              <div className="text-default-400 flex gap-2 text-xs">
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
            ANNUAL: "Anual",
            BIMONTHLY: "Bimensual",
            BIWEEKLY: "Quincenal",
            MONTHLY: "Mensual",
            ONCE: "Única vez",
            QUARTERLY: "Trimestral",
            SEMIANNUAL: "Semestral",
            WEEKLY: "Semanal",
          };

          const typeLabels: Record<ServiceType, string> = {
            BUSINESS: "Operación",
            LEASE: "Arriendo",
            OTHER: "Otro",
            PERSONAL: "Personal",
            SOFTWARE: "Software",
            SUPPLIER: "Proveedor",
            TAX: "Impuestos",
            UTILITY: "Servicios básicos",
          };

          return (
            <button
              className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-default-200 bg-primary/20 text-primary"
                  : "bg-background/45 text-foreground hover:border-default-200 hover:bg-background/65 border-transparent"
              }`}
              key={service.public_id}
              onClick={() => {
                onSelect(service.public_id);
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">{service.name}</p>
                  {service.detail && (
                    <p className="text-default-400 text-xs tracking-wide uppercase">
                      {service.detail}
                    </p>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-foreground font-semibold">
                  ${service.default_amount.toLocaleString("es-CL")}
                </span>
                <span className="text-default-500">{frequencyLabels[service.frequency]}</span>
                <span className="text-default-500">{typeLabels[service.service_type]}</span>
              </div>
              <div className="text-default-400 mt-1 flex flex-wrap items-center gap-3 text-xs">
                <span>Inicio {dayjs(service.start_date).format("DD MMM YYYY")}</span>
                {service.counterpart_name && <span>{service.counterpart_name}</span>}
              </div>
              <div className="text-default-400 mt-2 text-xs">
                Pendientes {service.pending_count} · Vencidos {service.overdue_count}
              </div>
            </button>
          );
        })}
        {services.length === 0 && (
          <p className="border-default-200 bg-background/40 text-default-500 rounded-2xl border border-dashed p-4 text-xs">
            Aún no registras servicios recurrentes. Crea el primero para controlar gastos mensuales.
          </p>
        )}
      </div>
    </aside>
  );
}

export default ServiceList;
