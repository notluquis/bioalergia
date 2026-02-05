import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import { fetchCounterpart, fetchCounterparts } from "../../counterparts/api";
import type { CounterpartAccount } from "../../counterparts/types";
import type { CreateServicePayload } from "../types";
import {
  BasicInfoSection,
  CounterpartSection,
  EmissionSection,
  FinancialSection,
  SchedulingSection,
  ServiceClassificationSection,
} from "./ServiceForm/index";

export type ServiceFormState = CreateServicePayload & {
  emissionExactDate?: null | Date;
};

interface ServiceFormProps {
  initialValues?: Partial<CreateServicePayload>;
  onCancel: () => void;
  onSubmit: (payload: CreateServicePayload) => Promise<void>;
  submitLabel?: string;
}

const INITIAL_STATE: ServiceFormState = {
  accountReference: "",
  amountIndexation: "NONE",
  category: "",
  counterpartAccountId: null,
  counterpartId: null,
  defaultAmount: 0,
  detail: "",
  dueDay: null,
  emissionDay: 1,
  emissionEndDay: null,
  emissionExactDate: null,
  emissionMode: "FIXED_DAY",
  emissionStartDay: null,
  frequency: "MONTHLY",
  lateFeeGraceDays: null,
  lateFeeMode: "NONE",
  lateFeeValue: null,
  monthsToGenerate: 12,
  name: "",
  notes: "",
  obligationType: "SERVICE",
  ownership: "COMPANY",
  recurrenceType: "RECURRING",
  serviceType: "BUSINESS",
  startDate: dayjs().toDate(),
};

const resetFormState = (initialValues?: Partial<CreateServicePayload>) => ({
  ...INITIAL_STATE,
  ...initialValues,
  monthsToGenerate: initialValues?.monthsToGenerate ?? INITIAL_STATE.monthsToGenerate,
  startDate: initialValues?.startDate ?? INITIAL_STATE.startDate,
});

const applyFixedDayMode = (prev: ServiceFormState) => {
  if (prev.emissionStartDay !== null || prev.emissionEndDay !== null || prev.emissionExactDate) {
    return {
      ...prev,
      emissionDay: prev.emissionDay ?? 1,
      emissionEndDay: null,
      emissionExactDate: null,
      emissionStartDay: null,
    };
  }
  return prev.emissionDay == null ? { ...prev, emissionDay: 1 } : prev;
};

const applyDateRangeMode = (prev: ServiceFormState) => {
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
      emissionEndDay: nextEnd,
      emissionExactDate: null,
      emissionStartDay: nextStart,
    };
  }
  return prev;
};

const applySpecificDateMode = (prev: ServiceFormState) => {
  if (prev.emissionDay !== null || prev.emissionStartDay !== null || prev.emissionEndDay !== null) {
    return {
      ...prev,
      emissionDay: null,
      emissionEndDay: null,
      emissionStartDay: null,
    };
  }
  return prev;
};

const applyEmissionMode = (
  prev: ServiceFormState,
  emissionMode: ServiceFormState["emissionMode"],
) => {
  if (emissionMode === "FIXED_DAY") {
    return applyFixedDayMode(prev);
  }
  if (emissionMode === "DATE_RANGE") {
    return applyDateRangeMode(prev);
  }
  if (emissionMode === "SPECIFIC_DATE") {
    return applySpecificDateMode(prev);
  }
  return prev;
};

const normalizeOptional = (value?: string | null) => (value?.trim() ? value.trim() : undefined);

const getEmissionFields = (
  form: ServiceFormState,
  emissionMode: ServiceFormState["emissionMode"],
) => ({
  emissionDay: emissionMode === "FIXED_DAY" ? (form.emissionDay ?? null) : null,
  emissionEndDay: emissionMode === "DATE_RANGE" ? (form.emissionEndDay ?? null) : null,
  emissionExactDate:
    emissionMode === "SPECIFIC_DATE" ? (form.emissionExactDate ?? undefined) : null,
  emissionMode,
  emissionStartDay: emissionMode === "DATE_RANGE" ? (form.emissionStartDay ?? null) : null,
});

const getLateFeeValue = (form: ServiceFormState, lateFeeMode: ServiceFormState["lateFeeMode"]) => {
  if (lateFeeMode === "NONE") {
    return null;
  }
  if (form.lateFeeValue === null || form.lateFeeValue === undefined) {
    return null;
  }
  return Number(form.lateFeeValue);
};

const getMonthsToGenerate = (form: ServiceFormState) =>
  form.recurrenceType === "ONE_OFF" || form.frequency === "ONCE" ? 1 : form.monthsToGenerate;

const buildServicePayload = (
  form: ServiceFormState,
  emissionMode: ServiceFormState["emissionMode"],
  lateFeeMode: ServiceFormState["lateFeeMode"],
): CreateServicePayload => ({
  accountReference: normalizeOptional(form.accountReference),
  amountIndexation: form.amountIndexation,
  category: normalizeOptional(form.category),
  counterpartAccountId: form.counterpartAccountId ?? null,
  counterpartId: form.counterpartId ?? null,
  defaultAmount: Number(form.defaultAmount) || 0,
  detail: normalizeOptional(form.detail),
  dueDay: form.dueDay ?? null,
  ...getEmissionFields(form, emissionMode),
  frequency: form.frequency,
  lateFeeGraceDays: lateFeeMode === "NONE" ? null : (form.lateFeeGraceDays ?? null),
  lateFeeMode,
  lateFeeValue: getLateFeeValue(form, lateFeeMode),
  monthsToGenerate: getMonthsToGenerate(form),
  name: form.name.trim(),
  notes: normalizeOptional(form.notes),
  obligationType: form.obligationType,
  ownership: form.ownership,
  recurrenceType: form.recurrenceType,
  serviceType: form.serviceType,
  startDate: form.startDate,
});

export function ServiceForm({ initialValues, onCancel, onSubmit, submitLabel }: ServiceFormProps) {
  const [form, setForm] = useState<ServiceFormState>({
    ...INITIAL_STATE,
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const effectiveSubmitLabel = submitLabel ?? "Crear servicio";
  const submittingLabel = submitLabel ? "Guardando..." : "Creando...";

  useEffect(() => {
    setForm(initialValues ? resetFormState(initialValues) : INITIAL_STATE);
  }, [initialValues]);

  // Extract mode values to prevent unnecessary effect runs
  const lateFeeMode = form.lateFeeMode ?? "NONE";
  const emissionMode = form.emissionMode ?? "FIXED_DAY";

  // Clear late fee fields when mode is NONE
  useEffect(() => {
    if (lateFeeMode === "NONE") {
      setForm((prev) => {
        if (prev.lateFeeValue != null || prev.lateFeeGraceDays != null) {
          return { ...prev, lateFeeGraceDays: null, lateFeeValue: null };
        }
        return prev;
      });
    }
  }, [lateFeeMode]);

  const { data: counterparts = [] } = useQuery({
    queryFn: fetchCounterparts,
    queryKey: ["counterparts"],
  });

  const { data: accounts = [] } = useQuery<CounterpartAccount[]>({
    enabled: Boolean(form.counterpartId),
    queryFn: async () => {
      // safe assurance due to enabled check
      // biome-ignore lint/style/noNonNullAssertion: safe assurance due to enabled check
      const detail = await fetchCounterpart(form.counterpartId!);
      return detail.accounts;
    },
    queryKey: ["counterpart-accounts", form.counterpartId],
  });

  const counterpartsError = null; // Suspense handles errors

  // Sync error handling roughly to previous (though React Query handles this better naturally)

  // Adjust emission fields based on emission mode
  useEffect(() => {
    setForm((prev) => applyEmissionMode(prev, emissionMode));
  }, [emissionMode]);

  const handleChange = <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCounterpartSelect = (value: string) => {
    const id = value ? Number(value) : null;
    handleChange("counterpartId", id);
    handleChange("counterpartAccountId", null);
    // Accounts will reload automatically via useQuery dependency on form.counterpartId
  };

  const effectiveMonths =
    form.recurrenceType === "ONE_OFF" || form.frequency === "ONCE"
      ? 1
      : (form.monthsToGenerate ?? 12);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildServicePayload(form, emissionMode, lateFeeMode);

      await onSubmit(payload);
      if (!initialValues) {
        setForm(INITIAL_STATE);
        // setAccounts([]); // Handled by useQuery dependency
      }
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "No se pudo crear el servicio";
      setError(message);
      throw error_;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <BasicInfoSection
        category={form.category}
        detail={form.detail}
        name={form.name}
        notes={form.notes}
        onChange={handleChange}
      />

      <ServiceClassificationSection
        obligationType={form.obligationType}
        onChange={handleChange}
        ownership={form.ownership}
        recurrenceType={form.recurrenceType}
        serviceType={form.serviceType}
      />

      <CounterpartSection
        accountReference={form.accountReference}
        accounts={accounts}
        accountsLoading={false}
        counterpartAccountId={form.counterpartAccountId}
        counterpartId={form.counterpartId}
        counterparts={counterparts}
        counterpartsError={counterpartsError}
        counterpartsLoading={false}
        onChange={handleChange}
        onCounterpartSelect={handleCounterpartSelect}
      />

      <SchedulingSection
        dueDay={form.dueDay}
        effectiveMonths={effectiveMonths}
        frequency={form.frequency}
        monthsToGenerate={form.monthsToGenerate}
        onChange={handleChange}
        recurrenceType={form.recurrenceType}
        startDate={form.startDate}
      />

      <EmissionSection
        emissionDay={form.emissionDay}
        emissionEndDay={form.emissionEndDay}
        emissionExactDate={form.emissionExactDate}
        emissionMode={form.emissionMode}
        emissionStartDay={form.emissionStartDay}
        errors={{}}
        onChange={handleChange}
      />

      <FinancialSection
        amountIndexation={form.amountIndexation}
        defaultAmount={form.defaultAmount}
        lateFeeGraceDays={form.lateFeeGraceDays}
        lateFeeMode={form.lateFeeMode}
        lateFeeValue={form.lateFeeValue}
        onChange={handleChange}
      />

      {error && <p className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button disabled={submitting} onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={submitting} type="submit">
          {submitting ? submittingLabel : effectiveSubmitLabel}
        </Button>
      </div>
    </form>
  );
}

export default ServiceForm;
