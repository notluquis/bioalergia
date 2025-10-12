import { useEffect, useMemo } from "react";
import { z } from "zod";
import dayjs from "dayjs";
import { useForm } from "../../../hooks/useForm";
import { useAsyncData } from "../../../hooks/useAsyncData";
import Input from "../../../components/Input";
import Button from "../../../components/Button";
import type {
  CreateServicePayload,
  ServiceEmissionMode,
  ServiceFrequency,
  ServiceLateFeeMode,
  ServiceOwnership,
  ServiceObligationType,
  ServiceRecurrenceType,
  ServiceType,
} from "../types";
import { fetchCounterparts, fetchCounterpart } from "../../counterparts/api";
import type { Counterpart, CounterpartAccount } from "../../counterparts/types";

interface ServiceFormProps {
  onSubmit: (payload: CreateServicePayload) => Promise<void>;
  onCancel: () => void;
}

// Esquema de validación
const ServiceFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  detail: z.string().trim().optional(),
  category: z.string().trim().optional(),
  serviceType: z.enum(["BUSINESS", "SUPPLIER", "UTILITY", "LEASE", "SOFTWARE", "TAX", "PERSONAL", "OTHER"]),
  ownership: z.enum(["COMPANY", "OWNER", "MIXED", "THIRD_PARTY"]),
  obligationType: z.enum(["SERVICE", "DEBT", "LOAN", "OTHER"]),
  recurrenceType: z.enum(["RECURRING", "ONE_OFF"]),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "ONCE"]),
  defaultAmount: z.coerce.number().min(0, "El monto debe ser mayor o igual a 0"),
  amountIndexation: z.enum(["NONE", "UF"]),
  counterpartId: z.coerce.number().int().positive().nullable(),
  counterpartAccountId: z.coerce.number().int().positive().nullable(),
  accountReference: z.string().trim().optional(),
  emissionMode: z.enum(["FIXED_DAY", "DATE_RANGE", "SPECIFIC_DATE"]),
  emissionDay: z.coerce.number().int().min(1).max(31).nullable(),
  emissionStartDay: z.coerce.number().int().min(1).max(31).nullable(),
  emissionEndDay: z.coerce.number().int().min(1).max(31).nullable(),
  emissionExactDate: z.string().nullable(),
  dueDay: z.coerce.number().int().min(1).max(31).nullable(),
  startDate: z.string().min(1, "La fecha de inicio es requerida"),
  monthsToGenerate: z.coerce.number().int().min(1).max(60),
  lateFeeMode: z.enum(["NONE", "FIXED", "PERCENTAGE"]),
  lateFeeValue: z.coerce.number().min(0).nullable(),
  lateFeeGraceDays: z.coerce.number().int().min(0).max(31).nullable(),
  notes: z.string().trim().optional(),
});

type ServiceFormData = z.infer<typeof ServiceFormSchema>;

const SERVICE_TYPE_OPTIONS: Array<{ value: ServiceType; label: string }> = [
  { value: "BUSINESS", label: "Operación general" },
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "UTILITY", label: "Servicios básicos" },
  { value: "LEASE", label: "Arriendo / leasing" },
  { value: "SOFTWARE", label: "Software / suscripciones" },
  { value: "TAX", label: "Impuestos / contribuciones" },
  { value: "PERSONAL", label: "Personal" },
  { value: "OTHER", label: "Otro" },
];

const OWNERSHIP_OPTIONS: Array<{ value: ServiceOwnership; label: string }> = [
  { value: "COMPANY", label: "Empresa" },
  { value: "OWNER", label: "Personal del dueño" },
  { value: "MIXED", label: "Compartido" },
  { value: "THIRD_PARTY", label: "Terceros" },
];

const OBLIGATION_OPTIONS: Array<{ value: ServiceObligationType; label: string }> = [
  { value: "SERVICE", label: "Servicio / gasto" },
  { value: "DEBT", label: "Deuda" },
  { value: "LOAN", label: "Préstamo" },
  { value: "OTHER", label: "Otro" },
];

const RECURRENCE_OPTIONS: Array<{ value: ServiceRecurrenceType; label: string }> = [
  { value: "RECURRING", label: "Recurrente" },
  { value: "ONE_OFF", label: "Puntual" },
];

const FREQUENCY_OPTIONS: Array<{ value: ServiceFrequency; label: string }> = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "BIMONTHLY", label: "Bimensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
  { value: "ONCE", label: "Única vez" },
];

const INDEXATION_OPTIONS = [
  { value: "NONE", label: "Monto fijo" },
  { value: "UF", label: "Actualiza por UF" },
];

const EMISSION_MODE_OPTIONS: Array<{ value: ServiceEmissionMode; label: string }> = [
  { value: "FIXED_DAY", label: "Día específico" },
  { value: "DATE_RANGE", label: "Rango de días" },
  { value: "SPECIFIC_DATE", label: "Fecha exacta" },
];

const LATE_FEE_OPTIONS: Array<{ value: ServiceLateFeeMode; label: string }> = [
  { value: "NONE", label: "Sin recargo" },
  { value: "FIXED", label: "Monto fijo" },
  { value: "PERCENTAGE", label: "% del monto" },
];

const INITIAL_DATA: ServiceFormData = {
  name: "",
  detail: "",
  category: "",
  serviceType: "BUSINESS",
  ownership: "COMPANY",
  obligationType: "SERVICE",
  recurrenceType: "RECURRING",
  frequency: "MONTHLY",
  defaultAmount: 0,
  amountIndexation: "NONE",
  counterpartId: null,
  counterpartAccountId: null,
  accountReference: "",
  emissionMode: "FIXED_DAY",
  emissionDay: 1,
  emissionStartDay: null,
  emissionEndDay: null,
  emissionExactDate: null,
  dueDay: null,
  startDate: dayjs().format("YYYY-MM-DD"),
  monthsToGenerate: 12,
  lateFeeMode: "NONE",
  lateFeeValue: null,
  lateFeeGraceDays: null,
  notes: "",
};

export function ServiceFormRefactored({ onSubmit, onCancel }: ServiceFormProps) {
  const {
    values: data,
    setValue,
    getFieldProps,
    handleSubmit,
    isSubmitting,
    reset,
  } = useForm({
    initialValues: INITIAL_DATA,
    validationSchema: ServiceFormSchema,
    onSubmit: async (formData) => {
      const payload: CreateServicePayload = {
        name: formData.name,
        detail: formData.detail || undefined,
        category: formData.category || undefined,
        serviceType: formData.serviceType,
        ownership: formData.ownership,
        obligationType: formData.obligationType,
        recurrenceType: formData.recurrenceType,
        frequency: formData.frequency,
        defaultAmount: formData.defaultAmount,
        amountIndexation: formData.amountIndexation,
        counterpartId: formData.counterpartId,
        counterpartAccountId: formData.counterpartAccountId,
        accountReference: formData.accountReference || undefined,
        emissionMode: formData.emissionMode,
        emissionDay: formData.emissionMode === "FIXED_DAY" ? formData.emissionDay : null,
        emissionStartDay: formData.emissionMode === "DATE_RANGE" ? formData.emissionStartDay : null,
        emissionEndDay: formData.emissionMode === "DATE_RANGE" ? formData.emissionEndDay : null,
        emissionExactDate: formData.emissionMode === "SPECIFIC_DATE" ? formData.emissionExactDate : null,
        dueDay: formData.dueDay,
        startDate: formData.startDate,
        monthsToGenerate:
          formData.recurrenceType === "ONE_OFF" || formData.frequency === "ONCE" ? 1 : formData.monthsToGenerate,
        lateFeeMode: formData.lateFeeMode,
        lateFeeValue: formData.lateFeeMode === "NONE" ? null : formData.lateFeeValue,
        lateFeeGraceDays: formData.lateFeeMode === "NONE" ? null : formData.lateFeeGraceDays,
        notes: formData.notes || undefined,
      };

      await onSubmit(payload);
      reset();
    },
  });

  // Estados para contrapartes usando useAsyncData
  const counterpartsState = useAsyncData<Counterpart>();
  const { loadData: loadCounterparts } = counterpartsState;
  const accountsState = useAsyncData<CounterpartAccount>();

  // Cargar contrapartes al montar
  useEffect(() => {
    loadCounterparts(async () => {
      const list = await fetchCounterparts();
      return { data: list, total: list.length };
    });
  }, [loadCounterparts]);

  // Limpiar campos de emisión según modo
  useEffect(() => {
    if (data.lateFeeMode === "NONE") {
      setValue("lateFeeValue", null);
      setValue("lateFeeGraceDays", null);
    }
  }, [data.lateFeeMode, setValue]);

  useEffect(() => {
    switch (data.emissionMode) {
      case "FIXED_DAY":
        setValue("emissionStartDay", null);
        setValue("emissionEndDay", null);
        setValue("emissionExactDate", null);
        if (!data.emissionDay) setValue("emissionDay", 1);
        break;
      case "DATE_RANGE":
        setValue("emissionDay", null);
        setValue("emissionExactDate", null);
        if (!data.emissionStartDay) setValue("emissionStartDay", 1);
        if (!data.emissionEndDay) setValue("emissionEndDay", 5);
        break;
      case "SPECIFIC_DATE":
        setValue("emissionDay", null);
        setValue("emissionStartDay", null);
        setValue("emissionEndDay", null);
        break;
    }
  }, [data.emissionMode, data.emissionDay, data.emissionStartDay, data.emissionEndDay, setValue]);

  // Cargar cuentas cuando cambia contraparte
  const handleCounterpartSelect = (value: string) => {
    const id = value ? Number(value) : null;
    setValue("counterpartId", id);
    setValue("counterpartAccountId", null);

    if (id) {
      accountsState.loadData(async () => {
        const detail = await fetchCounterpart(id);
        return { data: detail.accounts, total: detail.accounts.length };
      });
    } else {
      accountsState.reset();
    }
  };

  const effectiveMonths = useMemo(() => {
    if (data.recurrenceType === "ONE_OFF" || data.frequency === "ONCE") return 1;
    return data.monthsToGenerate ?? 12;
  }, [data.frequency, data.monthsToGenerate, data.recurrenceType]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <Input label="Nombre" {...getFieldProps("name")} required />
        <Input label="Categoría" {...getFieldProps("category")} helper="Ej: Servicios básicos, Marketing, Arriendo" />
        <Input
          label="Detalle"
          type="textarea"
          rows={3}
          {...getFieldProps("detail")}
          helper="Describe qué cubre el servicio o condiciones especiales"
        />
        <Input label="Notas" type="textarea" rows={3} {...getFieldProps("notes")} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Input label="Tipo" type="select" {...getFieldProps("serviceType")}>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input label="Propiedad" type="select" {...getFieldProps("ownership")}>
          {OWNERSHIP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input label="Naturaleza" type="select" {...getFieldProps("obligationType")}>
          {OBLIGATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input label="Recurrencia" type="select" {...getFieldProps("recurrenceType")}>
          {RECURRENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Input
          label="Empresa / contraparte"
          type="select"
          value={data.counterpartId ? String(data.counterpartId) : ""}
          onChange={(event) => handleCounterpartSelect(event.target.value)}
          disabled={counterpartsState.loading}
          helper={counterpartsState.error || (counterpartsState.loading ? "Cargando contrapartes..." : undefined)}
        >
          <option value="">Sin contraparte</option>
          {counterpartsState.data.map((counterpart: Counterpart) => (
            <option key={counterpart.id} value={counterpart.id}>
              {counterpart.name}
            </option>
          ))}
        </Input>
        <Input
          label="Cuenta asociada"
          type="select"
          value={data.counterpartAccountId ? String(data.counterpartAccountId) : ""}
          onChange={(event) => setValue("counterpartAccountId", event.target.value ? Number(event.target.value) : null)}
          disabled={!data.counterpartId || accountsState.loading}
          helper={
            accountsState.error ||
            (accountsState.loading
              ? "Cargando opciones..."
              : data.counterpartId && !accountsState.data.length
                ? "Esta contraparte aún no tiene cuentas agregadas"
                : undefined)
          }
        >
          <option value="">Sin cuenta específica</option>
          {accountsState.data.map((account: CounterpartAccount) => (
            <option key={account.id} value={account.id}>
              {account.account_identifier}
              {account.bank_name ? ` · ${account.bank_name}` : ""}
            </option>
          ))}
        </Input>
        <Input
          label="Referencia de cuenta"
          {...getFieldProps("accountReference")}
          helper="Usa este campo si necesitas un alias o número distinto a las cuentas registradas"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Input label="Frecuencia" type="select" {...getFieldProps("frequency")}>
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input label="Fecha de inicio" type="date" {...getFieldProps("startDate")} required />
        <Input
          label="Meses a generar"
          type="number"
          value={effectiveMonths}
          onChange={(event) => setValue("monthsToGenerate", Number(event.target.value))}
          min={1}
          max={60}
          disabled={data.recurrenceType === "ONE_OFF" || data.frequency === "ONCE"}
          helper={
            data.recurrenceType === "ONE_OFF" || data.frequency === "ONCE"
              ? "Para servicios puntuales se genera un único periodo"
              : undefined
          }
        />
        <Input label="Día de vencimiento" type="number" {...getFieldProps("dueDay")} min={1} max={31} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input label="Modo de emisión" type="select" {...getFieldProps("emissionMode")}>
          {EMISSION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        {data.emissionMode === "FIXED_DAY" && (
          <Input label="Día emisión" type="number" {...getFieldProps("emissionDay")} min={1} max={31} />
        )}
        {data.emissionMode === "DATE_RANGE" && (
          <>
            <Input label="Día inicio emisión" type="number" {...getFieldProps("emissionStartDay")} min={1} max={31} />
            <Input label="Día término emisión" type="number" {...getFieldProps("emissionEndDay")} min={1} max={31} />
          </>
        )}
        {data.emissionMode === "SPECIFIC_DATE" && (
          <Input label="Fecha emisión" type="date" {...getFieldProps("emissionExactDate")} />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input label="Monto base" type="number" {...getFieldProps("defaultAmount")} min={0} step="0.01" required />
        <Input label="Modo de monto" type="select" {...getFieldProps("amountIndexation")}>
          {INDEXATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input label="Recargo por atraso" type="select" {...getFieldProps("lateFeeMode")}>
          {LATE_FEE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        {data.lateFeeMode !== "NONE" && (
          <>
            <Input
              label={data.lateFeeMode === "PERCENTAGE" ? "% recargo" : "Monto recargo"}
              type="number"
              {...getFieldProps("lateFeeValue")}
              min={0}
              step="0.01"
            />
            <Input label="Días de gracia" type="number" {...getFieldProps("lateFeeGraceDays")} min={0} max={31} />
          </>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando..." : "Crear servicio"}
        </Button>
      </div>
    </form>
  );
}

export default ServiceFormRefactored;
