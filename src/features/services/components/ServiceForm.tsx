import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
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

type ServiceFormState = CreateServicePayload & {
  emissionExactDate?: string | null;
};

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

const INITIAL_STATE: ServiceFormState = {
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

export function ServiceForm({ onSubmit, onCancel }: ServiceFormProps) {
  const [form, setForm] = useState<ServiceFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [counterpartsLoading, setCounterpartsLoading] = useState(false);
  const [counterpartsError, setCounterpartsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CounterpartAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  useEffect(() => {
    setForm((prev) => {
      if (prev.lateFeeMode === "NONE" && (prev.lateFeeValue != null || prev.lateFeeGraceDays != null)) {
        return { ...prev, lateFeeValue: null, lateFeeGraceDays: null };
      }
      return prev;
    });
  }, [form.lateFeeMode]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.emissionMode === "FIXED_DAY") {
        if (prev.emissionStartDay !== null || prev.emissionEndDay !== null || prev.emissionExactDate) {
          return {
            ...prev,
            emissionStartDay: null,
            emissionEndDay: null,
            emissionExactDate: null,
            emissionDay: prev.emissionDay ?? 1,
          };
        }
        if (prev.emissionDay == null) {
          return { ...prev, emissionDay: 1 };
        }
        return prev;
      }
      if (prev.emissionMode === "DATE_RANGE") {
        const nextStart = prev.emissionStartDay ?? 1;
        const nextEnd = prev.emissionEndDay ?? Math.max(5, nextStart);
        if (
          prev.emissionDay !== null ||
          prev.emissionExactDate ||
          prev.emissionStartDay !== nextStart ||
          prev.emissionEndDay !== nextEnd
        ) {
          return {
            ...prev,
            emissionDay: null,
            emissionExactDate: null,
            emissionStartDay: nextStart,
            emissionEndDay: nextEnd,
          };
        }
        return prev;
      }
      if (prev.emissionMode === "SPECIFIC_DATE") {
        if (prev.emissionDay !== null || prev.emissionStartDay !== null || prev.emissionEndDay !== null) {
          return {
            ...prev,
            emissionDay: null,
            emissionStartDay: null,
            emissionEndDay: null,
          };
        }
        return prev;
      }
      return prev;
    });
  }, [form.emissionMode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCounterpartsLoading(true);
      setCounterpartsError(null);
      try {
        const list = await fetchCounterparts();
        if (!cancelled) {
          setCounterparts(list);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "No se pudo cargar las contrapartes";
          setCounterpartsError(message);
        }
      } finally {
        if (!cancelled) setCounterpartsLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCounterpartSelect = async (value: string) => {
    const id = value ? Number(value) : null;
    handleChange("counterpartId", id);
    handleChange("counterpartAccountId", null);
    setAccounts([]);
    if (!id) return;
    setAccountsLoading(true);
    setCounterpartsError(null);
    try {
      const detail = await fetchCounterpart(id);
      setAccounts(detail.accounts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener las cuentas";
      setCounterpartsError(message);
    } finally {
      setAccountsLoading(false);
    }
  };

  const effectiveMonths = useMemo(() => {
    if (form.recurrenceType === "ONE_OFF" || form.frequency === "ONCE") return 1;
    return form.monthsToGenerate ?? 12;
  }, [form.frequency, form.monthsToGenerate, form.recurrenceType]);

  const emissionMode = form.emissionMode ?? "FIXED_DAY";
  const lateFeeMode = form.lateFeeMode ?? "NONE";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateServicePayload = {
        name: form.name.trim(),
        detail: form.detail?.trim() ? form.detail.trim() : undefined,
        category: form.category?.trim() ? form.category.trim() : undefined,
        serviceType: form.serviceType,
        ownership: form.ownership,
        obligationType: form.obligationType,
        recurrenceType: form.recurrenceType,
        frequency: form.frequency,
        defaultAmount: Number(form.defaultAmount) || 0,
        amountIndexation: form.amountIndexation,
        counterpartId: form.counterpartId ?? null,
        counterpartAccountId: form.counterpartAccountId ?? null,
        accountReference: form.accountReference?.trim() ? form.accountReference.trim() : undefined,
        emissionMode,
        emissionDay: emissionMode === "FIXED_DAY" ? (form.emissionDay ?? null) : null,
        emissionStartDay: emissionMode === "DATE_RANGE" ? (form.emissionStartDay ?? null) : null,
        emissionEndDay: emissionMode === "DATE_RANGE" ? (form.emissionEndDay ?? null) : null,
        emissionExactDate: emissionMode === "SPECIFIC_DATE" ? (form.emissionExactDate ?? undefined) : null,
        dueDay: form.dueDay ?? null,
        startDate: form.startDate,
        monthsToGenerate: form.recurrenceType === "ONE_OFF" || form.frequency === "ONCE" ? 1 : form.monthsToGenerate,
        lateFeeMode,
        lateFeeValue:
          lateFeeMode === "NONE"
            ? null
            : form.lateFeeValue === null || form.lateFeeValue === undefined
              ? null
              : Number(form.lateFeeValue),
        lateFeeGraceDays: lateFeeMode === "NONE" ? null : (form.lateFeeGraceDays ?? null),
        notes: form.notes?.trim() ? form.notes.trim() : undefined,
      };

      await onSubmit(payload);
      setForm(INITIAL_STATE);
      setAccounts([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear el servicio";
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <Input
          label="Nombre"
          value={form.name}
          onChange={(event) => handleChange("name", event.target.value)}
          required
        />
        <Input
          label="Categoría"
          value={form.category ?? ""}
          onChange={(event) => handleChange("category", event.target.value)}
          helper="Ej: Servicios básicos, Marketing, Arriendo"
        />
        <Input
          label="Detalle"
          type="textarea"
          rows={3}
          value={form.detail ?? ""}
          onChange={(event) => handleChange("detail", event.target.value)}
          helper="Describe qué cubre el servicio o condiciones especiales"
        />
        <Input
          label="Notas"
          type="textarea"
          rows={3}
          value={form.notes ?? ""}
          onChange={(event) => handleChange("notes", event.target.value)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Input
          label="Tipo"
          type="select"
          value={form.serviceType}
          onChange={(event) => handleChange("serviceType", event.target.value as ServiceType)}
        >
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input
          label="Propiedad"
          type="select"
          value={form.ownership}
          onChange={(event) => handleChange("ownership", event.target.value as ServiceOwnership)}
        >
          {OWNERSHIP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input
          label="Naturaleza"
          type="select"
          value={form.obligationType}
          onChange={(event) => handleChange("obligationType", event.target.value as ServiceObligationType)}
        >
          {OBLIGATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input
          label="Recurrencia"
          type="select"
          value={form.recurrenceType}
          onChange={(event) => handleChange("recurrenceType", event.target.value as ServiceRecurrenceType)}
        >
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
          value={form.counterpartId ? String(form.counterpartId) : ""}
          onChange={(event) => handleCounterpartSelect(event.target.value)}
          disabled={counterpartsLoading}
          helper={counterpartsError ?? (counterpartsLoading ? "Cargando contrapartes..." : undefined)}
        >
          <option value="">Sin contraparte</option>
          {counterparts.map((counterpart) => (
            <option key={counterpart.id} value={counterpart.id}>
              {counterpart.name}
            </option>
          ))}
        </Input>
        <Input
          label="Cuenta asociada"
          type="select"
          value={form.counterpartAccountId ? String(form.counterpartAccountId) : ""}
          onChange={(event) =>
            handleChange("counterpartAccountId", event.target.value ? Number(event.target.value) : null)
          }
          disabled={!form.counterpartId || accountsLoading}
          helper={
            counterpartsError
              ? "No se pudo cargar las cuentas"
              : counterpartsLoading
                ? "Cargando opciones..."
                : form.counterpartId && !accounts.length
                  ? "Esta contraparte aún no tiene cuentas agregadas"
                  : undefined
          }
        >
          <option value="">Sin cuenta específica</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_identifier}
              {account.bank_name ? ` · ${account.bank_name}` : ""}
            </option>
          ))}
        </Input>
        <Input
          label="Referencia de cuenta"
          value={form.accountReference ?? ""}
          onChange={(event) => handleChange("accountReference", event.target.value)}
          helper="Usa este campo si necesitas un alias o número distinto a las cuentas registradas"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Input
          label="Frecuencia"
          type="select"
          value={form.frequency}
          onChange={(event) => handleChange("frequency", event.target.value as ServiceFrequency)}
        >
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input
          label="Fecha de inicio"
          type="date"
          value={form.startDate}
          onChange={(event) => handleChange("startDate", event.target.value)}
          required
        />
        <Input
          label="Meses a generar"
          type="number"
          value={effectiveMonths}
          onChange={(event) => handleChange("monthsToGenerate", Number(event.target.value))}
          min={1}
          max={60}
          disabled={form.recurrenceType === "ONE_OFF" || form.frequency === "ONCE"}
          helper={
            form.recurrenceType === "ONE_OFF" || form.frequency === "ONCE"
              ? "Para servicios puntuales se genera un único periodo"
              : undefined
          }
        />
        <Input
          label="Día de vencimiento"
          type="number"
          value={form.dueDay ?? ""}
          onChange={(event) => handleChange("dueDay", event.target.value ? Number(event.target.value) : null)}
          min={1}
          max={31}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Modo de emisión"
          type="select"
          value={emissionMode}
          onChange={(event) => handleChange("emissionMode", event.target.value as ServiceEmissionMode)}
        >
          {EMISSION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        {emissionMode === "FIXED_DAY" && (
          <Input
            label="Día emisión"
            type="number"
            value={form.emissionDay ?? ""}
            onChange={(event) => handleChange("emissionDay", event.target.value ? Number(event.target.value) : null)}
            min={1}
            max={31}
          />
        )}
        {emissionMode === "DATE_RANGE" && (
          <>
            <Input
              label="Día inicio emisión"
              type="number"
              value={form.emissionStartDay ?? ""}
              onChange={(event) =>
                handleChange("emissionStartDay", event.target.value ? Number(event.target.value) : null)
              }
              min={1}
              max={31}
            />
            <Input
              label="Día término emisión"
              type="number"
              value={form.emissionEndDay ?? ""}
              onChange={(event) =>
                handleChange("emissionEndDay", event.target.value ? Number(event.target.value) : null)
              }
              min={1}
              max={31}
            />
          </>
        )}
        {emissionMode === "SPECIFIC_DATE" && (
          <Input
            label="Fecha emisión"
            type="date"
            value={form.emissionExactDate ?? ""}
            onChange={(event) => handleChange("emissionExactDate", event.target.value || null)}
          />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Monto base"
          type="number"
          value={form.defaultAmount}
          onChange={(event) => handleChange("defaultAmount", Number(event.target.value))}
          min={0}
          step="0.01"
          required
        />
        <Input
          label="Modo de monto"
          type="select"
          value={form.amountIndexation ?? "NONE"}
          onChange={(event) =>
            handleChange("amountIndexation", event.target.value as ServiceFormState["amountIndexation"])
          }
        >
          {INDEXATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input
          label="Recargo por atraso"
          type="select"
          value={lateFeeMode}
          onChange={(event) => handleChange("lateFeeMode", event.target.value as ServiceLateFeeMode)}
        >
          {LATE_FEE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        {lateFeeMode !== "NONE" && (
          <>
            <Input
              label={lateFeeMode === "PERCENTAGE" ? "% recargo" : "Monto recargo"}
              type="number"
              value={form.lateFeeValue ?? ""}
              onChange={(event) => handleChange("lateFeeValue", Number(event.target.value))}
              min={0}
              step="0.01"
            />
            <Input
              label="Días de gracia"
              type="number"
              value={form.lateFeeGraceDays ?? ""}
              onChange={(event) =>
                handleChange("lateFeeGraceDays", event.target.value ? Number(event.target.value) : null)
              }
              min={0}
              max={31}
            />
          </>
        )}
      </section>

      {error && <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creando..." : "Crear servicio"}
        </Button>
      </div>
    </form>
  );
}

export default ServiceForm;
