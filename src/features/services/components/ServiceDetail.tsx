import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import Button from "../../../components/Button";
import Modal from "../../../components/Modal";
import Input from "../../../components/Input";
import type {
  RegenerateServicePayload,
  ServiceSchedule,
  ServiceSummary,
  ServiceFrequency,
  ServiceLateFeeMode,
  ServiceType,
  ServiceOwnership,
  ServiceObligationType,
  ServiceRecurrenceType,
} from "../types";
import ServiceScheduleTable from "./ServiceScheduleTable";
import ServiceScheduleAccordion from "./ServiceScheduleAccordion";

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

  const statusBadge = useMemo(() => {
    if (!service) return { label: "", className: "" };
    switch (service.status) {
      case "INACTIVE":
        return { label: "Sin pendientes", className: "bg-emerald-100 text-emerald-700" };
      case "ARCHIVED":
        return { label: "Archivado", className: "bg-slate-100 text-slate-600" };
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
      <section className="glass-card glass-underlay-gradient flex h-full flex-col items-center justify-center rounded-3xl p-10 text-sm text-slate-500">
        <p>Selecciona un servicio para ver el detalle.</p>
      </section>
    );
  }

  return (
    <section className="glass-card glass-underlay-gradient relative flex h-full flex-col gap-6 rounded-3xl p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">{service.name}</h1>
          <p className="text-sm text-slate-600/90">
            {service.detail || "Gasto"} · {serviceTypeLabel} · {ownershipLabel}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Inicio {dayjs(service.start_date).format("DD MMM YYYY")}</span>
            <span>Frecuencia {frequencyLabel.toLowerCase()}</span>
            {service.due_day && <span>Vence día {service.due_day}</span>}
            <span>{recurrenceLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          {canManage && (
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(true)}>
              Regenerar cronograma
            </Button>
          )}
          {canManage && (
            <Link
              to={`/services/${service.public_id}/edit`}
              className="rounded-full border border-white/60 bg-white/65 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-[var(--brand-primary)]/40 hover:text-[var(--brand-primary)]"
            >
              Editar servicio
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-4 rounded-2xl border border-white/55 bg-white/55 p-4 text-sm text-slate-600 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Monto base</p>
          <p className="text-lg font-semibold text-slate-800">${service.default_amount.toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Pendientes</p>
          <p className="text-lg font-semibold text-slate-800">{service.pending_count}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Vencidos</p>
          <p className="text-lg font-semibold text-rose-600">{service.overdue_count}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Total pagado</p>
          <p className="text-lg font-semibold text-emerald-600">
            ${Number(service.total_paid ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Modo de cálculo</p>
          <p className="text-sm font-semibold text-slate-700">{amountModeLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Recargo</p>
          <p className="text-sm font-semibold text-slate-700">{lateFeeLabel}</p>
          {service.late_fee_grace_days != null && service.late_fee_mode !== "NONE" && (
            <p className="text-xs text-slate-400">Tras {service.late_fee_grace_days} días</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-white/55 bg-white/55 p-4 text-sm text-slate-600 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Contraparte</p>
          <p className="font-semibold text-slate-700">{counterpartSummary}</p>
          {service.counterpart_account_identifier && (
            <p className="text-xs text-slate-500">
              Cuenta {service.counterpart_account_identifier}
              {service.counterpart_account_bank_name ? ` · ${service.counterpart_account_bank_name}` : ""}
            </p>
          )}
          {service.account_reference && (
            <p className="text-xs text-slate-500">Referencia: {service.account_reference}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Emisión</p>
          <p className="font-semibold text-slate-700">
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
          <p className="text-xs uppercase tracking-wide text-slate-400">Clasificación</p>
          <p className="font-semibold text-slate-700">{obligationLabel}</p>
          <p className="text-xs text-slate-500">{recurrenceLabel}</p>
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
        <div className="rounded-2xl border border-white/55 bg-white/55 p-4 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-wide text-slate-400">Notas</p>
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
            type="select"
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/40 backdrop-blur-sm">
          <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] shadow">
            Cargando servicio...
          </p>
        </div>
      )}
    </section>
  );
}

export default ServiceDetail;
