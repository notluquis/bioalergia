import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

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
  service: ServiceSummary | null;
  schedules: ServiceSchedule[];
  loading: boolean;
  canManage: boolean;
  onRegenerate: (overrides: RegenerateServicePayload) => Promise<void>;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
}

export function ServiceDetail({
  service,
  schedules,
  loading,
  canManage,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
}: ServiceDetailProps) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState<RegenerateServicePayload>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const navigate = useNavigate();

  const statusBadge = useMemo(() => {
    if (!service) return { label: "", className: "" };
    switch (service.status) {
      case "INACTIVE":
        return { label: "Sin pendientes", className: "bg-emerald-100 text-emerald-700" };
      case "ARCHIVED":
        return { label: "Archivado", className: "bg-base-200 text-base-content" };
      default:
        return service.overdue_count > 0
          ? { label: "Vencidos", className: "bg-rose-100 text-rose-700" }
          : { label: "Activo", className: "bg-amber-100 text-amber-700" };
    }
  }, [service]);

  const frequencyLabel = useMemo(() => {
    if (!service) return "";
    const labels: Record<ServiceFrequency, string> = {
      WEEKLY: "Semanal",
      BIWEEKLY: "Quincenal",
      MONTHLY: "Mensual",
      BIMONTHLY: "Bimensual",
      QUARTERLY: "Trimestral",
      SEMIANNUAL: "Semestral",
      ANNUAL: "Anual",
      ONCE: "Única vez",
    };
    return labels[service.frequency];
  }, [service]);

  const serviceTypeLabel = useMemo(() => {
    if (!service) return "";
    const labels: Record<ServiceType, string> = {
      BUSINESS: "Operación general",
      SUPPLIER: "Proveedor",
      UTILITY: "Servicios básicos",
      LEASE: "Arriendo / leasing",
      SOFTWARE: "Software / suscripciones",
      TAX: "Impuestos / contribuciones",
      PERSONAL: "Personal",
      OTHER: "Otro",
    };
    return labels[service.service_type];
  }, [service]);

  const ownershipLabel = useMemo(() => {
    if (!service) return "";
    const labels: Record<ServiceOwnership, string> = {
      COMPANY: "Empresa",
      OWNER: "Personal del dueño",
      MIXED: "Compartido",
      THIRD_PARTY: "Terceros",
    };
    return labels[service.ownership];
  }, [service]);

  const obligationLabel = useMemo(() => {
    if (!service) return "";
    const labels: Record<ServiceObligationType, string> = {
      SERVICE: "Servicio / gasto",
      DEBT: "Deuda",
      LOAN: "Préstamo",
      OTHER: "Otro",
    };
    return labels[service.obligation_type];
  }, [service]);

  const recurrenceLabel = useMemo(() => {
    if (!service) return "";
    const labels: Record<ServiceRecurrenceType, string> = {
      RECURRING: "Recurrente",
      ONE_OFF: "Puntual",
    };
    return labels[service.recurrence_type];
  }, [service]);

  const amountModeLabel = useMemo(() => {
    if (!service) return "";
    return service.amount_indexation === "UF" ? "UF" : "Monto fijo";
  }, [service]);

  const lateFeeLabel = useMemo(() => {
    if (!service) return "Sin recargo";
    const labels: Record<ServiceLateFeeMode, string> = {
      NONE: "Sin recargo",
      FIXED: service.late_fee_value ? `$${service.late_fee_value.toLocaleString("es-CL")}` : "Monto fijo",
      PERCENTAGE: service.late_fee_value != null ? `${service.late_fee_value}%` : "% del monto",
    };
    return labels[service.late_fee_mode];
  }, [service]);

  const counterpartSummary = useMemo(() => {
    if (!service) return "Sin contraparte";
    if (service.counterpart_name) return service.counterpart_name;
    if (service.counterpart_id) return `Contraparte #${service.counterpart_id}`;
    return "Sin contraparte";
  }, [service]);

  const handleRegenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!service) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await onRegenerate(regenerateForm);
      setRegenerateOpen(false);
      setRegenerateForm({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo regenerar el cronograma";
      setRegenerateError(message);
    } finally {
      setRegenerating(false);
    }
  };

  if (!service) {
    return (
      <section className="text-base-content/60 bg-base-100 flex h-full flex-col items-center justify-center rounded-3xl p-10 text-sm">
        <p>Selecciona un servicio para ver el detalle.</p>
      </section>
    );
  }

  return (
    <section className="bg-base-100 relative flex h-full min-w-0 flex-col gap-6 rounded-3xl p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-primary text-2xl font-bold break-all drop-shadow-sm">{service.name}</h1>
          <p className="text-base-content text-sm">
            {service.detail || "Gasto"} · {serviceTypeLabel} · {ownershipLabel}
          </p>
          <div className="text-base-content/60 flex flex-wrap items-center gap-3 text-xs">
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
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(true)}>
              Regenerar cronograma
            </Button>
          )}
          {canManage && (
            <Button type="button" variant="secondary" onClick={() => navigate(`/services/${service.public_id}/edit`)}>
              Editar servicio
            </Button>
          )}
        </div>
      </header>

      <section className="border-base-300 bg-base-200 text-base-content grid gap-4 rounded-2xl border p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Monto base</p>
          <p className="text-base-content text-lg font-semibold">${service.default_amount.toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Pendientes</p>
          <p className="text-base-content text-lg font-semibold">{service.pending_count}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Vencidos</p>
          <p className="text-lg font-semibold text-rose-600">{service.overdue_count}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Total pagado</p>
          <p className="text-lg font-semibold text-emerald-600">
            ${Number(service.total_paid ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Modo de cálculo</p>
          <p className="text-base-content text-sm font-semibold">{amountModeLabel}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Recargo</p>
          <p className="text-base-content text-sm font-semibold">{lateFeeLabel}</p>
          {service.late_fee_grace_days != null && service.late_fee_mode !== "NONE" && (
            <p className="text-base-content/50 text-xs">Tras {service.late_fee_grace_days} días</p>
          )}
        </div>
      </section>

      <section className="border-base-300 bg-base-200 text-base-content grid gap-4 rounded-2xl border p-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Contraparte</p>
          <p className="text-base-content font-semibold">{counterpartSummary}</p>
          {service.counterpart_account_identifier && (
            <p className="text-base-content/60 text-xs">
              Cuenta {service.counterpart_account_identifier}
              {service.counterpart_account_bank_name ? ` · ${service.counterpart_account_bank_name}` : ""}
            </p>
          )}
          {service.account_reference && (
            <p className="text-base-content/60 text-xs">Referencia: {service.account_reference}</p>
          )}
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Emisión</p>
          <p className="text-base-content font-semibold">
            {service.emission_mode === "FIXED_DAY" && service.emission_day
              ? `Día ${service.emission_day}`
              : service.emission_mode === "DATE_RANGE" && service.emission_start_day && service.emission_end_day
                ? `Entre día ${service.emission_start_day} y ${service.emission_end_day}`
                : service.emission_mode === "SPECIFIC_DATE" && service.emission_exact_date
                  ? `Fecha ${dayjs(service.emission_exact_date).format("DD MMM YYYY")}`
                  : "Sin especificar"}
          </p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Clasificación</p>
          <p className="text-base-content font-semibold">{obligationLabel}</p>
          <p className="text-base-content/60 text-xs">{recurrenceLabel}</p>
        </div>
      </section>

      <ServiceScheduleAccordion
        service={service}
        schedules={schedules}
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
      />

      <ServiceScheduleTable
        schedules={schedules}
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
      />

      {service.notes && (
        <div className="border-base-300 bg-base-200 text-base-content rounded-2xl border p-4 text-sm">
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Notas</p>
          <p>{service.notes}</p>
        </div>
      )}

      <Modal isOpen={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Regenerar cronograma">
        <form onSubmit={handleRegenerate} className="space-y-4">
          <Input
            label="Meses a generar"
            type="number"
            value={regenerateForm.months ?? service.next_generation_months}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({ ...prev, months: Number(event.target.value) }))
            }
            min={1}
            max={60}
          />
          <Input
            label="Nueva fecha de inicio"
            type="date"
            value={regenerateForm.startDate ?? service.start_date}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({ ...prev, startDate: event.target.value }))
            }
          />
          <Input
            label="Monto base"
            type="number"
            value={regenerateForm.defaultAmount ?? service.default_amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({ ...prev, defaultAmount: Number(event.target.value) }))
            }
            min={0}
            step="0.01"
          />
          <Input
            label="Día de vencimiento"
            type="number"
            value={regenerateForm.dueDay ?? service.due_day ?? ""}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({
                ...prev,
                dueDay: event.target.value ? Number(event.target.value) : null,
              }))
            }
            min={1}
            max={31}
          />
          <Input
            label="Frecuencia"
            as="select"
            value={regenerateForm.frequency ?? service.frequency}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: event.target.value as RegenerateServicePayload["frequency"],
              }))
            }
          >
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
            <option value="BIMONTHLY">Bimensual</option>
            <option value="QUARTERLY">Trimestral</option>
            <option value="SEMIANNUAL">Semestral</option>
            <option value="ANNUAL">Anual</option>
            <option value="ONCE">Única vez</option>
          </Input>
          {service.emission_mode === "FIXED_DAY" && (
            <Input
              label="Día de emisión"
              type="number"
              value={regenerateForm.emissionDay ?? service.emission_day ?? ""}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setRegenerateForm((prev) => ({
                  ...prev,
                  emissionDay: event.target.value ? Number(event.target.value) : null,
                }))
              }
              min={1}
              max={31}
              helper="Aplica a servicios con día fijo de emisión"
            />
          )}
          {regenerateError && (
            <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{regenerateError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(false)} disabled={regenerating}>
              Cancelar
            </Button>
            <Button type="submit" disabled={regenerating}>
              {regenerating ? "Actualizando..." : "Regenerar"}
            </Button>
          </div>
        </form>
      </Modal>

      {loading && (
        <div className="bg-base-100/40 absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm">
          <p className="bg-base-100 text-primary rounded-full px-4 py-2 text-sm font-semibold shadow">
            Cargando servicio...
          </p>
        </div>
      )}
    </section>
  );
}

export default ServiceDetail;
