import { Description } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";

import type {
  RegenerateServicePayload,
  ServiceFrequency,
  ServiceObligationType,
  ServiceOwnership,
  ServiceRecurrenceType,
  ServiceSchedule,
  ServiceSummary,
  ServiceType,
} from "../types";

import { ServiceScheduleAccordion } from "./ServiceScheduleAccordion";
import { ServiceScheduleTable } from "./ServiceScheduleTable";

interface ServiceDetailProps {
  canManage: boolean;
  loading: boolean;
  onEditSchedule?: (schedule: ServiceSchedule) => void;
  onRegenerate: (overrides: RegenerateServicePayload) => Promise<void>;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onSkipSchedule?: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
  schedules: ServiceSchedule[];
  service: null | ServiceSummary;
}

const getStatusBadge = (service: ServiceSummary) => {
  switch (service.status) {
    case "ARCHIVED":
      return { className: "bg-default-50 text-foreground", label: "Archivado" };
    case "INACTIVE":
      return { className: "bg-emerald-100 text-emerald-700", label: "Sin pendientes" };
    default:
      return service.overdueCount > 0
        ? { className: "bg-rose-100 text-rose-700", label: "Vencidos" }
        : { className: "bg-amber-100 text-amber-700", label: "Activo" };
  }
};

const getFrequencyLabel = (frequency: ServiceFrequency) =>
  ({
    ANNUAL: "Anual",
    BIMONTHLY: "Bimensual",
    BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual",
    ONCE: "Única vez",
    QUARTERLY: "Trimestral",
    SEMIANNUAL: "Semestral",
    WEEKLY: "Semanal",
  })[frequency];

const getServiceTypeLabel = (serviceType: ServiceType) =>
  ({
    BUSINESS: "Operación general",
    LEASE: "Arriendo / leasing",
    OTHER: "Otro",
    PERSONAL: "Personal",
    SOFTWARE: "Software / suscripciones",
    SUPPLIER: "Proveedor",
    TAX: "Impuestos / contribuciones",
    UTILITY: "Servicios básicos",
  })[serviceType];

const getOwnershipLabel = (ownership: ServiceOwnership) =>
  ({
    COMPANY: "Empresa",
    MIXED: "Compartido",
    OWNER: "Personal del dueño",
    THIRD_PARTY: "Terceros",
  })[ownership];

const getObligationLabel = (obligation: ServiceObligationType) =>
  ({
    DEBT: "Deuda",
    LOAN: "Préstamo",
    OTHER: "Otro",
    SERVICE: "Servicio / gasto",
  })[obligation];

const getRecurrenceLabel = (recurrence: ServiceRecurrenceType) =>
  ({
    ONE_OFF: "Puntual",
    RECURRING: "Recurrente",
  })[recurrence];

const getAmountModeLabel = (amountIndexation: ServiceSummary["amountIndexation"]) =>
  amountIndexation === "UF" ? "UF" : "Monto fijo";

const getLateFeeLabel = (service: ServiceSummary) =>
  ({
    FIXED: service.lateFeeValue ? `$${service.lateFeeValue.toLocaleString("es-CL")}` : "Monto fijo",
    NONE: "Sin recargo",
    PERCENTAGE: service.lateFeeValue == null ? "% del monto" : `${service.lateFeeValue}%`,
  })[service.lateFeeMode];

const getCounterpartSummary = (service: ServiceSummary) => {
  if (service.counterpartName) {
    return service.counterpartName;
  }
  if (service.counterpartId) {
    return `Contraparte #${service.counterpartId}`;
  }
  return "Sin contraparte";
};

const getEmissionSummary = (service: ServiceSummary) => {
  if (service.emissionMode === "FIXED_DAY" && service.emissionDay) {
    return `Día ${service.emissionDay}`;
  }
  if (service.emissionMode === "DATE_RANGE" && service.emissionStartDay && service.emissionEndDay) {
    return `Entre día ${service.emissionStartDay} y ${service.emissionEndDay}`;
  }
  if (service.emissionMode === "SPECIFIC_DATE" && service.emissionExactDate) {
    return `Fecha ${dayjs(service.emissionExactDate).format("DD MMM YYYY")}`;
  }
  return "Sin especificar";
};

export function ServiceDetail({
  canManage,
  loading,
  onEditSchedule,
  onRegenerate,
  onRegisterPayment,
  onSkipSchedule,
  onUnlinkPayment,
  schedules,
  service,
}: ServiceDetailProps) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState<RegenerateServicePayload>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<null | string>(null);
  const navigate = useNavigate({ from: "/services" });

  const handleRegenerate = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!service) {
      return;
    }
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
      <section className="flex h-full flex-col items-center justify-center rounded-3xl bg-background p-10 text-default-500 text-sm">
        <p>Selecciona un servicio para ver el detalle.</p>
      </section>
    );
  }

  return (
    <section className="relative flex h-full min-w-0 flex-col gap-6 rounded-3xl bg-background p-6">
      <ServiceHeader
        canManage={canManage}
        onEdit={() => navigate({ to: "/services/$id/edit", params: { id: service.publicId } })}
        onRegenerate={() => setRegenerateOpen(true)}
        service={service}
      />

      <ServiceSummarySection service={service} />

      <ServiceMetaSection service={service} />

      <ServiceScheduleAccordion
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        schedules={schedules}
        service={service}
      />

      <ServiceScheduleTable
        canManage={canManage}
        onEditSchedule={onEditSchedule}
        onRegisterPayment={onRegisterPayment}
        onSkipSchedule={onSkipSchedule}
        onUnlinkPayment={onUnlinkPayment}
        schedules={schedules}
      />

      {service.notes && <ServiceNotes notes={service.notes} />}

      <RegenerateServiceModal
        error={regenerateError}
        isOpen={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
        onSubmit={handleRegenerate}
        regenerating={regenerating}
        service={service}
        setRegenerateForm={setRegenerateForm}
        values={regenerateForm}
      />

      {loading && <ServiceLoadingOverlay />}
    </section>
  );
}

function ServiceHeader({
  canManage,
  onEdit,
  onRegenerate,
  service,
}: {
  canManage: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  service: ServiceSummary;
}) {
  const statusBadge = getStatusBadge(service);
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <span className="block break-all font-bold text-2xl text-primary drop-shadow-sm">
          {service.name}
        </span>
        <Description className="text-foreground text-sm">
          {service.detail || "Gasto"} · {getServiceTypeLabel(service.serviceType)} ·{" "}
          {getOwnershipLabel(service.ownership)}
        </Description>
        <div className="flex flex-wrap items-center gap-3 text-default-500 text-xs">
          <span>Inicio {dayjs(service.startDate).format("DD MMM YYYY")}</span>
          <span>Frecuencia {getFrequencyLabel(service.frequency).toLowerCase()}</span>
          {service.dueDay && <span>Vence día {service.dueDay}</span>}
          <span>{getRecurrenceLabel(service.recurrenceType)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <span
          className={`rounded-full px-3 py-1 font-semibold text-xs uppercase tracking-wide ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
        {canManage && (
          <Button onClick={onRegenerate} type="button" variant="secondary">
            Regenerar cronograma
          </Button>
        )}
        {canManage && (
          <Button onClick={onEdit} type="button" variant="secondary">
            Editar servicio
          </Button>
        )}
      </div>
    </header>
  );
}

function ServiceSummarySection({ service }: { service: ServiceSummary }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm sm:grid-cols-3 lg:grid-cols-5">
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Monto base
        </Description>
        <span className="block font-semibold text-foreground text-lg">
          ${service.defaultAmount.toLocaleString("es-CL")}
        </span>
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Pendientes
        </Description>
        <span className="block font-semibold text-foreground text-lg">{service.pendingCount}</span>
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Vencidos
        </Description>
        <span className="block font-semibold text-lg text-rose-600">{service.overdueCount}</span>
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Total pagado
        </Description>
        <span className="block font-semibold text-emerald-600 text-lg">
          ${Number(service.totalPaid ?? 0).toLocaleString("es-CL")}
        </span>
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Modo de cálculo
        </Description>
        <span className="block font-semibold text-foreground text-sm">
          {getAmountModeLabel(service.amountIndexation)}
        </span>
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Recargo
        </Description>
        <span className="block font-semibold text-foreground text-sm">
          {getLateFeeLabel(service)}
        </span>
        {service.lateFeeGraceDays != null && service.lateFeeMode !== "NONE" && (
          <Description className="text-default-400 text-xs">
            Tras {service.lateFeeGraceDays} días
          </Description>
        )}
      </div>
    </section>
  );
}

function ServiceMetaSection({ service }: { service: ServiceSummary }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm md:grid-cols-3">
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Contraparte
        </Description>
        <span className="block font-semibold text-foreground">
          {getCounterpartSummary(service)}
        </span>
        {service.counterpartAccountIdentifier && (
          <Description className="text-default-500 text-xs">
            Cuenta {service.counterpartAccountIdentifier}
            {service.counterpartAccountBankName ? ` · ${service.counterpartAccountBankName}` : ""}
          </Description>
        )}
        {service.accountReference && (
          <Description className="text-default-500 text-xs">
            Referencia: {service.accountReference}
          </Description>
        )}
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Emisión
        </Description>
        <span className="block font-semibold text-foreground">{getEmissionSummary(service)}</span>
      </div>
      <div>
        <Description className="text-default-400 text-xs uppercase tracking-wide">
          Clasificación
        </Description>
        <span className="block font-semibold text-foreground">
          {getObligationLabel(service.obligationType)}
        </span>
        <Description className="text-default-500 text-xs">
          {getRecurrenceLabel(service.recurrenceType)}
        </Description>
      </div>
    </section>
  );
}

function ServiceNotes({ notes }: { notes: string }) {
  return (
    <div className="rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm">
      <Description className="text-default-400 text-xs uppercase tracking-wide">Notas</Description>
      <Description>{notes}</Description>
    </div>
  );
}

function RegenerateServiceModal({
  error,
  isOpen,
  onClose,
  onSubmit,
  regenerating,
  service,
  setRegenerateForm,
  values,
}: {
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  regenerating: boolean;
  service: ServiceSummary;
  setRegenerateForm: React.Dispatch<React.SetStateAction<RegenerateServicePayload>>;
  values: RegenerateServicePayload;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Regenerar cronograma">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          label="Meses a generar"
          max={60}
          min={1}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setRegenerateForm((prev) => ({ ...prev, months: Number(event.target.value) }));
          }}
          type="number"
          value={values.months ?? service.nextGenerationMonths}
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
          value={dayjs(values.startDate ?? service.startDate).format("YYYY-MM-DD")}
        />

        <Input
          label="Monto base"
          min={0}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setRegenerateForm((prev) => ({ ...prev, defaultAmount: Number(event.target.value) }));
          }}
          step="0.01"
          type="number"
          value={values.defaultAmount ?? service.defaultAmount}
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
          value={values.dueDay ?? service.dueDay ?? ""}
        />

        <Select
          label="Frecuencia"
          onChange={(val) => {
            const newVal = val as string;
            setRegenerateForm((prev) => ({
              ...prev,
              frequency: newVal as RegenerateServicePayload["frequency"],
            }));
          }}
          value={values.frequency ?? service.frequency}
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
        {service.emissionMode === "FIXED_DAY" && (
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
            value={values.emissionDay ?? service.emissionDay ?? ""}
          />
        )}
        {error && (
          <Description className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
            {error}
          </Description>
        )}
        <div className="flex justify-end gap-3">
          <Button disabled={regenerating} onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={regenerating} type="submit">
            {regenerating ? "Actualizando..." : "Regenerar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ServiceLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-sm">
      <Description className="rounded-full bg-background px-4 py-2 font-semibold text-primary text-sm shadow">
        Cargando servicio...
      </Description>
    </div>
  );
}
