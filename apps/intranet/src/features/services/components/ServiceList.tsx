import { Description } from "@heroui/react";
import dayjs from "dayjs";

import { Button } from "@/components/ui/Button";

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
    <aside className="flex h-full min-h-80 flex-col gap-4 rounded-2xl border border-default-200/60 bg-background/80 p-5 text-foreground text-sm shadow-inner">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="block font-semibold text-default-500 text-xs uppercase tracking-wide">
            Servicios
          </span>
          <Description className="text-default-500 text-xs">
            Suscripciones y gastos recurrentes.
          </Description>
        </div>
        {canManage && (
          <Button onClick={onCreateRequest} size="sm" type="button" variant="primary">
            Nuevo servicio
          </Button>
        )}
      </header>
      <div className="muted-scrollbar flex-1 space-y-3 pr-2 sm:max-h-[60dvh] sm:overflow-y-auto sm:overscroll-y-contain">
        {loading &&
          services.length === 0 &&
          skeletons.map((value) => (
            <div
              className="rounded-2xl border border-default-200/60 bg-default-50/60 p-4 shadow-sm"
              key={value}
            >
              <div className="skeleton-line mb-3 w-3/4" />
              <div className="flex gap-2 text-default-400 text-xs">
                <span className="skeleton-line w-20" />
                <span className="skeleton-line w-16" />
              </div>
            </div>
          ))}
        {services.map((service) => {
          const isActive = service.publicId === selectedId;
          const overdue = service.overdueCount > 0;
          const indicatorColor = (() => {
            if (overdue) {
              return "bg-rose-400";
            }
            if (service.pendingCount === 0) {
              return "bg-emerald-400";
            }
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
            <Button
              className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all ${
                isActive
                  ? "border-default-200 bg-primary/20 text-primary"
                  : "border-transparent bg-background/45 text-foreground hover:border-default-200 hover:bg-background/65"
              }`}
              key={service.publicId}
              onPress={() => {
                onSelect(service.publicId);
              }}
              type="button"
              variant="ghost"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block font-semibold text-sm tracking-tight">{service.name}</span>
                  {service.detail && (
                    <Description className="text-default-400 text-xs uppercase tracking-wide">
                      {service.detail}
                    </Description>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-inner`}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-foreground">
                  ${service.defaultAmount.toLocaleString("es-CL")}
                </span>
                <span className="text-default-500">{frequencyLabels[service.frequency]}</span>
                <span className="text-default-500">{typeLabels[service.serviceType]}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-default-400 text-xs">
                <span>Inicio {dayjs(service.startDate).format("DD MMM YYYY")}</span>
                {service.counterpartName && <span>{service.counterpartName}</span>}
              </div>
              <div className="mt-2 text-default-400 text-xs">
                Pendientes {service.pendingCount} · Vencidos {service.overdueCount}
              </div>
            </Button>
          );
        })}
        {services.length === 0 && (
          <Description className="rounded-2xl border border-default-200 border-dashed bg-background/40 p-4 text-default-500 text-xs">
            Aún no registras servicios recurrentes. Crea el primero para controlar gastos mensuales.
          </Description>
        )}
      </div>
    </aside>
  );
}
