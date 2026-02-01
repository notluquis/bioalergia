import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";

import type {
  RegenerateServicePayload,
  ServiceFrequency,
  ServiceLateFeeMode,
  ServiceObligationType,
  ServiceOwnership,
  ServiceRecurrenceType,
  ServiceSchedule,
  ServiceSummary,
  ServiceType,
} from "../types";

import ServiceScheduleAccordion from "./ServiceScheduleAccordion";
import ServiceScheduleTable from "./ServiceScheduleTable";

interface ServiceDetailProps {
  canManage: boolean;
  loading: boolean;
  onRegenerate: (overrides: RegenerateServicePayload) => Promise<void>;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
  schedules: ServiceSchedule[];
  service: null | ServiceSummary;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy component
export function ServiceDetail({
  canManage,
  loading,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
  service,
}: ServiceDetailProps) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState<RegenerateServicePayload>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<null | string>(null);
  const navigate = useNavigate();

  const statusBadge = (() => {
    if (!service) return { className: "", label: "" };
    switch (service.status) {
      case "ARCHIVED": {
        return { className: "bg-default-50 text-foreground", label: "Archivado" };
      }
      case "INACTIVE": {
        return { className: "bg-emerald-100 text-emerald-700", label: "Sin pendientes" };
      }
      default: {
        return service.overdue_count > 0
          ? { className: "bg-rose-100 text-rose-700", label: "Vencidos" }
          : { className: "bg-amber-100 text-amber-700", label: "Activo" };
      }
    }
  })();

  const frequencyLabel = (() => {
    if (!service) return "";
    const labels: Record<ServiceFrequency, string> = {
      ANNUAL: "Anual",
      BIMONTHLY: "Bimensual",
      BIWEEKLY: "Quincenal",
      MONTHLY: "Mensual",
      ONCE: "Única vez",
      QUARTERLY: "Trimestral",
      SEMIANNUAL: "Semestral",
      WEEKLY: "Semanal",
    };
    return labels[service.frequency];
  })();

  const serviceTypeLabel = (() => {
    if (!service) return "";
    const labels: Record<ServiceType, string> = {
      BUSINESS: "Operación general",
      LEASE: "Arriendo / leasing",
      OTHER: "Otro",
      PERSONAL: "Personal",
      SOFTWARE: "Software / suscripciones",
      SUPPLIER: "Proveedor",
      TAX: "Impuestos / contribuciones",
      UTILITY: "Servicios básicos",
    };
    return labels[service.service_type];
  })();

  const ownershipLabel = (() => {
    if (!service) return "";
    const labels: Record<ServiceOwnership, string> = {
      COMPANY: "Empresa",
      MIXED: "Compartido",
      OWNER: "Personal del dueño",
      THIRD_PARTY: "Terceros",
    };
    return labels[service.ownership];
  })();

  const obligationLabel = (() => {
    if (!service) return "";
    const labels: Record<ServiceObligationType, string> = {
      DEBT: "Deuda",
      LOAN: "Préstamo",
      OTHER: "Otro",
      SERVICE: "Servicio / gasto",
    };
    return labels[service.obligation_type];
  })();

  const recurrenceLabel = (() => {
    if (!service) return "";
    const labels: Record<ServiceRecurrenceType, string> = {
      ONE_OFF: "Puntual",
      RECURRING: "Recurrente",
    };
    return labels[service.recurrence_type];
  })();

  const amountModeLabel = (() => {
    if (!service) return "";
    return service.amount_indexation === "UF" ? "UF" : "Monto fijo";
  })();

  const lateFeeLabel = (() => {
    if (!service) return "Sin recargo";
    const labels: Record<ServiceLateFeeMode, string> = {
      FIXED: service.late_fee_value
        ? `$${service.late_fee_value.toLocaleString("es-CL")}`
        : "Monto fijo",
      NONE: "Sin recargo",
      PERCENTAGE: service.late_fee_value == null ? "% del monto" : `${service.late_fee_value}%`,
    };
    return labels[service.late_fee_mode];
  })();

  const counterpartSummary = (() => {
    if (!service) return "Sin contraparte";
    if (service.counterpart_name) return service.counterpart_name;
    if (service.counterpart_id) return `Contraparte #${service.counterpart_id}`;
    return "Sin contraparte";
  })();

  const handleRegenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!service) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await onRegenerate(regenerateForm);
      setRegenerateOpen(false);
      setRegenerateForm({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo regenerar el cronograma";
      setRegenerateError(message);
    } finally {
      setRegenerating(false);
    }
  };

  if (!service) {
    return (
      <section className="text-default-500 bg-background flex h-full flex-col items-center justify-center rounded-3xl p-10 text-sm">
        <p>Selecciona un servicio para ver el detalle.</p>
      </section>
    );
  }

  return (
    <section className="bg-background relative flex h-full min-w-0 flex-col gap-6 rounded-3xl p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-primary text-2xl font-bold break-all drop-shadow-sm">
            {service.name}
          </h1>
          <p className="text-foreground text-sm">
            {service.detail || "Gasto"} · {serviceTypeLabel} · {ownershipLabel}
          </p>
          <div className="text-default-500 flex flex-wrap items-center gap-3 text-xs">
            <span>Inicio {dayjs(service.start_date).format("DD MMM YYYY")}</span>
            <span>Frecuencia {frequencyLabel.toLowerCase()}</span>
            {service.due_day && <span>Vence día {service.due_day}</span>}
            <span>{recurrenceLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          {canManage && (
            <Button
              onClick={() => {
                setRegenerateOpen(true);
              }}
              type="button"
              variant="secondary"
            >
              Regenerar cronograma
            </Button>
          )}
          {canManage && (
            <Button
              onClick={() => navigate({ to: `/services/${service.public_id}/edit` })}
              type="button"
              variant="secondary"
            >
              Editar servicio
            </Button>
          )}
        </div>
      </header>

      <section className="border-default-200 bg-default-50 text-foreground grid gap-4 rounded-2xl border p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Monto base</p>
          <p className="text-foreground text-lg font-semibold">
            ${service.default_amount.toLocaleString("es-CL")}
          </p>
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Pendientes</p>
          <p className="text-foreground text-lg font-semibold">{service.pending_count}</p>
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Vencidos</p>
          <p className="text-lg font-semibold text-rose-600">{service.overdue_count}</p>
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Total pagado</p>
          <p className="text-lg font-semibold text-emerald-600">
            ${Number(service.total_paid ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Modo de cálculo</p>
          <p className="text-foreground text-sm font-semibold">{amountModeLabel}</p>
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Recargo</p>
          <p className="text-foreground text-sm font-semibold">{lateFeeLabel}</p>
          {service.late_fee_grace_days != null && service.late_fee_mode !== "NONE" && (
            <p className="text-default-400 text-xs">Tras {service.late_fee_grace_days} días</p>
          )}
        </div>
      </section>

      <section className="border-default-200 bg-default-50 text-foreground grid gap-4 rounded-2xl border p-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Contraparte</p>
          <p className="text-foreground font-semibold">{counterpartSummary}</p>
          {service.counterpart_account_identifier && (
            <p className="text-default-500 text-xs">
              Cuenta {service.counterpart_account_identifier}
              {service.counterpart_account_bank_name
                ? ` · ${service.counterpart_account_bank_name}`
                : ""}
            </p>
          )}
          {service.account_reference && (
            <p className="text-default-500 text-xs">Referencia: {service.account_reference}</p>
          )}
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Emisión</p>
          <p className="text-foreground font-semibold">
            {(() => {
              if (service.emission_mode === "FIXED_DAY" && service.emission_day) {
                return `Día ${service.emission_day}`;
              }
              if (
                service.emission_mode === "DATE_RANGE" &&
                service.emission_start_day &&
                service.emission_end_day
              ) {
                return `Entre día ${service.emission_start_day} y ${service.emission_end_day}`;
              }
              if (service.emission_mode === "SPECIFIC_DATE" && service.emission_exact_date) {
                return `Fecha ${dayjs(service.emission_exact_date).format("DD MMM YYYY")}`;
              }
              return "Sin especificar";
            })()}
          </p>
        </div>
        <div>
          <p className="text-default-400 text-xs tracking-wide uppercase">Clasificación</p>
          <p className="text-foreground font-semibold">{obligationLabel}</p>
          <p className="text-default-500 text-xs">{recurrenceLabel}</p>
        </div>
      </section>

      <ServiceScheduleAccordion
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        schedules={schedules}
        service={service}
      />

      <ServiceScheduleTable
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        schedules={schedules}
      />

      {service.notes && (
        <div className="border-default-200 bg-default-50 text-foreground rounded-2xl border p-4 text-sm">
          <p className="text-default-400 text-xs tracking-wide uppercase">Notas</p>
          <p>{service.notes}</p>
        </div>
      )}

      <Modal
        isOpen={regenerateOpen}
        onClose={() => {
          setRegenerateOpen(false);
        }}
        title="Regenerar cronograma"
      >
        <form className="space-y-4" onSubmit={handleRegenerate}>
          <Input
            label="Meses a generar"
            max={60}
            min={1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({ ...prev, months: Number(event.target.value) }));
            }}
            type="number"
            value={regenerateForm.months ?? service.next_generation_months}
          />
          <Input
            label="Nueva fecha de inicio"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({
                ...prev,
                startDate: event.target.value ? dayjs(event.target.value).toDate() : undefined,
              }));
            }}
            type="date"
            value={dayjs(regenerateForm.startDate ?? service.start_date).format("YYYY-MM-DD")}
          />
          <Input
            label="Monto base"
            min={0}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({ ...prev, defaultAmount: Number(event.target.value) }));
            }}
            step="0.01"
            type="number"
            value={regenerateForm.defaultAmount ?? service.default_amount}
          />
          <Input
            label="Día de vencimiento"
            max={31}
            min={1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({
                ...prev,
                dueDay: event.target.value ? Number(event.target.value) : null,
              }));
            }}
            type="number"
            value={regenerateForm.dueDay ?? service.due_day ?? ""}
          />
          <Select
            label="Frecuencia"
            onChange={(val) => {
              const newVal = val as string; // val is Key (string | number).
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: newVal as RegenerateServicePayload["frequency"],
              }));
            }}
            value={regenerateForm.frequency ?? service.frequency}
          >
            <SelectItem key="WEEKLY">Semanal</SelectItem>
            <SelectItem key="BIWEEKLY">Quincenal</SelectItem>
            <SelectItem key="MONTHLY">Mensual</SelectItem>
            <SelectItem key="BIMONTHLY">Bimensual</SelectItem>
            <SelectItem key="QUARTERLY">Trimestral</SelectItem>
            <SelectItem key="SEMIANNUAL">Semestral</SelectItem>
            <SelectItem key="ANNUAL">Anual</SelectItem>
            <SelectItem key="ONCE">Única vez</SelectItem>
          </Select>
          {service.emission_mode === "FIXED_DAY" && (
            <Input
              helper="Aplica a servicios con día fijo de emisión"
              label="Día de emisión"
              max={31}
              min={1}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setRegenerateForm((prev) => ({
                  ...prev,
                  emissionDay: event.target.value ? Number(event.target.value) : null,
                }));
              }}
              type="number"
              value={regenerateForm.emissionDay ?? service.emission_day ?? ""}
            />
          )}
          {regenerateError && (
            <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">
              {regenerateError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              disabled={regenerating}
              onClick={() => {
                setRegenerateOpen(false);
              }}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={regenerating} type="submit">
              {regenerating ? "Actualizando..." : "Regenerar"}
            </Button>
          </div>
        </form>
      </Modal>

      {loading && (
        <div className="bg-background/40 absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm">
          <p className="bg-background text-primary rounded-full px-4 py-2 text-sm font-semibold shadow">
            Cargando servicio...
          </p>
        </div>
      )}
    </section>
  );
}

export default ServiceDetail;
