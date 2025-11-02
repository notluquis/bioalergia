import dayjs from "dayjs";
import Button from "../../../components/Button";
import type { ServiceSummary, ServiceFrequency, ServiceType } from "../types";

interface ServiceListProps {
  services: ServiceSummary[];
  selectedId: string | null;
  onSelect: (publicId: string) => void;
  onCreateRequest: () => void;
  canManage: boolean;
}

export function ServiceList({ services, selectedId, onSelect, onCreateRequest, canManage }: ServiceListProps) {
  return (
    <aside className="flex h-full flex-col gap-4 p-6 text-sm text-slate-600 bg-base-100">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500/90">Servicios</h2>
          <p className="text-xs text-slate-500">Suscripciones y gastos recurrentes.</p>
        </div>
        {canManage && (
          <Button type="button" variant="primary" size="sm" onClick={onCreateRequest}>
            Nuevo servicio
          </Button>
        )}
      </header>
      <div className="muted-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
        {services.map((service) => {
          const isActive = service.public_id === selectedId;
          const overdue = service.overdue_count > 0;
          const indicatorColor = overdue
            ? "bg-rose-400"
            : service.pending_count === 0
              ? "bg-emerald-400"
              : "bg-amber-400";

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
              key={service.public_id}
              type="button"
              onClick={() => onSelect(service.public_id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-white/70 bg-(--brand-primary)/20 text-(--brand-primary)"
                  : "border-transparent bg-base-100/45 text-slate-600 hover:border-white/60 hover:bg-base-100/65"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight">{service.name}</p>
                  {service.detail && <p className="text-xs uppercase tracking-wide text-slate-400">{service.detail}</p>}
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`} aria-hidden="true" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700">${service.default_amount.toLocaleString("es-CL")}</span>
                <span className="text-slate-500">{frequencyLabels[service.frequency]}</span>
                <span className="text-slate-500">{typeLabels[service.service_type]}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Inicio {dayjs(service.start_date).format("DD MMM YYYY")}</span>
                {service.counterpart_name && <span>{service.counterpart_name}</span>}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Pendientes {service.pending_count} · Vencidos {service.overdue_count}
              </div>
            </button>
          );
        })}
        {!services.length && (
          <p className="rounded-2xl border border-dashed border-white/60 bg-base-100/40 p-4 text-xs text-slate-500">
            Aún no registras servicios recurrentes. Crea el primero para controlar gastos mensuales.
          </p>
        )}
      </div>
    </aside>
  );
}

export default ServiceList;
