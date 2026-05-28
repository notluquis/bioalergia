import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Form,
  Label,
  ListBox,
  NumberField,
  Select,
  Skeleton,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import { z } from "zod";
import { AppModal } from "@/components/ui/AppModal";

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

// Services operate in CLP (no per-service currency field) → amounts have no
// decimals. Mirror lib/utils.ts::formatCurrency for CLP.
const CLP_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "CLP",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

// Validation schema for regenerate modal
const regenerateSchema = z.object({
  months: z.coerce.number().min(1, "Meses debe ser al menos 1").max(60, "Máximo 60 meses"),
  startDate: z.string().min(1, "Fecha requerida"),
  defaultAmount: z.coerce.number().min(0).optional(),
  dueDay: z.coerce.number().min(1).max(31).optional(),
  frequency: z.string().optional(),
  emissionDay: z.coerce.number().min(1).max(31).optional(),
});

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
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<null | string>(null);
  const navigate = useNavigate({ from: "/services" });

  const handleRegenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!service) {
      return;
    }
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const formValues = {
        months: formData.get("months"),
        startDate: formData.get("startDate"),
        defaultAmount: formData.get("defaultAmount"),
        dueDay: formData.get("dueDay"),
        frequency: formData.get("frequency"),
        emissionDay: formData.get("emissionDay"),
      };

      // Validate with Zod
      const result = regenerateSchema.safeParse(formValues);
      if (!result.success) {
        const errors = result.error.issues.map((issue) => issue.message).join(", ");
        setRegenerateError(errors);
        return;
      }

      const payload: RegenerateServicePayload = {};
      if (result.data.months) payload.months = result.data.months;
      if (result.data.startDate) payload.startDate = new Date(result.data.startDate);
      if (result.data.defaultAmount) payload.defaultAmount = result.data.defaultAmount;
      if (result.data.dueDay) payload.dueDay = result.data.dueDay;
      if (result.data.frequency) payload.frequency = result.data.frequency as ServiceFrequency;
      if (result.data.emissionDay) payload.emissionDay = result.data.emissionDay;
      await onRegenerate(payload);
      setRegenerateOpen(false);
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
        onEdit={() => {
          void navigate({ to: "/services/$id/edit", params: { id: service.publicId } });
        }}
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
        onSubmit={(...args) => {
          void handleRegenerate(...args);
        }}
        regenerating={regenerating}
        service={service}
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
          <Button onPress={onRegenerate} variant="secondary">
            Regenerar cronograma
          </Button>
        )}
        {canManage && (
          <Button onPress={onEdit} variant="secondary">
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
}: {
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  regenerating: boolean;
  service: ServiceSummary;
}) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Regenerar cronograma"
      size="md"
      footer={
        <>
          <Button onPress={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button form="regenerate-service-form" isDisabled={regenerating} type="submit">
            {regenerating ? "Actualizando..." : "Regenerar"}
          </Button>
        </>
      }
    >
      <Form
        className="space-y-4"
        id="regenerate-service-form"
        onSubmit={onSubmit}
        validationBehavior="aria"
      >
        <NumberField
          defaultValue={service.nextGenerationMonths}
          isRequired
          maxValue={60}
          minValue={1}
          name="months"
        >
          <Label>Meses a generar</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
          <FieldError />
        </NumberField>

        <DatePicker
          defaultValue={parseDate(dayjs(service.startDate).format("YYYY-MM-DD"))}
          isRequired
          name="startDate"
        >
          <Label>Nueva fecha de inicio</Label>
          <DateField.Group>
            <DateField.InputContainer>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
            </DateField.InputContainer>
            <DateField.Suffix>
              <DatePicker.Trigger>
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <FieldError />
          <DatePicker.Popover>
            <Calendar aria-label="Nueva fecha de inicio">
              <Calendar.Header>
                <Calendar.YearPickerTrigger>
                  <Calendar.YearPickerTriggerHeading />
                  <Calendar.YearPickerTriggerIndicator />
                </Calendar.YearPickerTrigger>
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
              <Calendar.YearPickerGrid>
                <Calendar.YearPickerGridBody>
                  {({ year }) => <Calendar.YearPickerCell year={year} />}
                </Calendar.YearPickerGridBody>
              </Calendar.YearPickerGrid>
            </Calendar>
          </DatePicker.Popover>
        </DatePicker>

        <NumberField
          defaultValue={service.defaultAmount}
          formatOptions={CLP_FORMAT_OPTIONS}
          isRequired
          minValue={0}
          name="defaultAmount"
        >
          <Label>Monto base</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
          <FieldError />
        </NumberField>

        <NumberField
          defaultValue={service.dueDay ?? Number.NaN}
          maxValue={31}
          minValue={1}
          name="dueDay"
        >
          <Label>Día de vencimiento</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
        </NumberField>

        <Select isRequired name="frequency" value={service.frequency}>
          <Label>Frecuencia</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="WEEKLY" key="WEEKLY">
                Semanal
              </ListBox.Item>
              <ListBox.Item id="BIWEEKLY" key="BIWEEKLY">
                Quincenal
              </ListBox.Item>
              <ListBox.Item id="MONTHLY" key="MONTHLY">
                Mensual
              </ListBox.Item>
              <ListBox.Item id="BIMONTHLY" key="BIMONTHLY">
                Bimensual
              </ListBox.Item>
              <ListBox.Item id="QUARTERLY" key="QUARTERLY">
                Trimestral
              </ListBox.Item>
              <ListBox.Item id="SEMIANNUAL" key="SEMIANNUAL">
                Semestral
              </ListBox.Item>
              <ListBox.Item id="ANNUAL" key="ANNUAL">
                Anual
              </ListBox.Item>
              <ListBox.Item id="ONCE" key="ONCE">
                Única vez
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        {service.emissionMode === "FIXED_DAY" && (
          <NumberField
            defaultValue={service.emissionDay ?? Number.NaN}
            maxValue={31}
            minValue={1}
            name="emissionDay"
          >
            <Label>Día de emisión</Label>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
            <Description>Aplica a servicios con día fijo de emisión</Description>
          </NumberField>
        )}
        {error && (
          <Description className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
            {error}
          </Description>
        )}
      </Form>
    </AppModal>
  );
}

function ServiceLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl space-y-3 rounded-2xl bg-background p-6 shadow">
        <Skeleton className="h-6 w-48 rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
