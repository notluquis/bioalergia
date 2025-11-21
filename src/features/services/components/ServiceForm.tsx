import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Button from "../../../components/ui/Button";
import type { CreateServicePayload } from "../types";
import { fetchCounterparts, fetchCounterpart } from "../../counterparts/api";
import type { Counterpart, CounterpartAccount } from "../../counterparts/types";
import {
  BasicInfoSection,
  ServiceClassificationSection,
  CounterpartSection,
  SchedulingSection,
  EmissionSection,
  FinancialSection,
} from "./ServiceForm/index";

interface ServiceFormProps {
  onSubmit: (payload: CreateServicePayload) => Promise<void>;
  onCancel: () => void;
  initialValues?: Partial<CreateServicePayload>;
  submitLabel?: string;
}

export type ServiceFormState = CreateServicePayload & {
  emissionExactDate?: string | null;
};

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

export function ServiceForm({ onSubmit, onCancel, initialValues, submitLabel }: ServiceFormProps) {
  const [form, setForm] = useState<ServiceFormState>({
    ...INITIAL_STATE,
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSubmitLabel = submitLabel ?? "Crear servicio";
  const submittingLabel = submitLabel ? "Guardando..." : "Creando...";

  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [counterpartsLoading, setCounterpartsLoading] = useState(false);
  const [counterpartsError, setCounterpartsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CounterpartAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  useEffect(() => {
    if (initialValues) {
      setForm({
        ...INITIAL_STATE,
        ...initialValues,
        monthsToGenerate: initialValues.monthsToGenerate ?? INITIAL_STATE.monthsToGenerate,
        startDate: initialValues.startDate ?? INITIAL_STATE.startDate,
      });
    } else {
      setForm(INITIAL_STATE);
    }
  }, [initialValues]);

  // Memoize extracted mode values to prevent unnecessary effect runs
  const lateFeeMode = useMemo(() => form.lateFeeMode ?? "NONE", [form.lateFeeMode]);
  const emissionMode = useMemo(() => form.emissionMode ?? "FIXED_DAY", [form.emissionMode]);

  // Clear late fee fields when mode is NONE
  useEffect(() => {
    if (lateFeeMode === "NONE") {
      setForm((prev) => {
        if (prev.lateFeeValue != null || prev.lateFeeGraceDays != null) {
          return { ...prev, lateFeeValue: null, lateFeeGraceDays: null };
        }
        return prev;
      });
    }
  }, [lateFeeMode]);

  // Adjust emission fields based on emission mode
  useEffect(() => {
    setForm((prev) => {
      if (emissionMode === "FIXED_DAY") {
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
  }, [emissionMode]);

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
      if (!initialValues) {
        setForm(INITIAL_STATE);
        setAccounts([]);
      }
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
      <BasicInfoSection
        name={form.name}
        category={form.category}
        detail={form.detail}
        notes={form.notes}
        onChange={handleChange}
      />

      <ServiceClassificationSection
        serviceType={form.serviceType}
        ownership={form.ownership}
        obligationType={form.obligationType}
        recurrenceType={form.recurrenceType}
        onChange={handleChange}
      />

      <CounterpartSection
        counterpartId={form.counterpartId}
        counterpartAccountId={form.counterpartAccountId}
        accountReference={form.accountReference}
        counterparts={counterparts}
        accounts={accounts}
        counterpartsLoading={counterpartsLoading}
        accountsLoading={accountsLoading}
        counterpartsError={counterpartsError}
        onCounterpartSelect={handleCounterpartSelect}
        onChange={handleChange}
      />

      <SchedulingSection
        frequency={form.frequency}
        startDate={form.startDate}
        monthsToGenerate={form.monthsToGenerate}
        dueDay={form.dueDay}
        recurrenceType={form.recurrenceType}
        effectiveMonths={effectiveMonths}
        onChange={handleChange}
      />

      <EmissionSection
        emissionMode={form.emissionMode}
        emissionDay={form.emissionDay}
        emissionStartDay={form.emissionStartDay}
        emissionEndDay={form.emissionEndDay}
        emissionExactDate={form.emissionExactDate}
        onChange={handleChange}
      />

      <FinancialSection
        defaultAmount={form.defaultAmount}
        amountIndexation={form.amountIndexation}
        lateFeeMode={form.lateFeeMode}
        lateFeeValue={form.lateFeeValue}
        lateFeeGraceDays={form.lateFeeGraceDays}
        onChange={handleChange}
      />

      {error && <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? submittingLabel : effectiveSubmitLabel}
        </Button>
      </div>
    </form>
  );
}

export default ServiceForm;
