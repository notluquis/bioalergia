import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { coerceAmount } from "@/lib/format";

import { saveProductionBalance } from "../api";
import { type FormState, makeDefaultForm, toPayload } from "../formUtils";
import type { ProductionBalance, ProductionBalancePayload } from "../types";
import { deriveTotals } from "../utils";

interface UseProductionBalanceFormParams {
  selectedDate: string | null;
  balances: ProductionBalance[];
}

export function useProductionBalanceForm({ selectedDate, balances }: UseProductionBalanceFormParams) {
  const { success: toastSuccess, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Sync form with selected date and balances
  useEffect(() => {
    if (!selectedDate) {
      setSelectedId(null);
      return;
    }
    const balance = balances.find((b) => b.date === selectedDate || dayjs(b.date).isSame(dayjs(selectedDate), "day"));
    if (balance) {
      setSelectedId(balance.id);
      setForm({
        date: balance.date,
        status: balance.status,
        ingresoTarjetas: String(balance.ingresoTarjetas),
        ingresoTransferencias: String(balance.ingresoTransferencias),
        ingresoEfectivo: String(balance.ingresoEfectivo),
        gastosDiarios: String(balance.gastosDiarios),
        otrosAbonos: String(balance.otrosAbonos),
        consultas: String(balance.consultas),
        controles: String(balance.controles),
        tests: String(balance.tests),
        vacunas: String(balance.vacunas),
        licencias: String(balance.licencias),
        roxair: String(balance.roxair),
        comentarios: balance.comentarios ?? "",
        reason: "",
      });
    } else {
      setSelectedId(null);
      setForm(makeDefaultForm(selectedDate));
    }
  }, [selectedDate, balances]);

  const existingBalance = selectedDate
    ? balances.find((b) => b.date === selectedDate || dayjs(b.date).isSame(dayjs(selectedDate), "day"))
    : null;
  const wasFinal = existingBalance?.status === "FINAL";

  const derived = deriveTotals({
    ingresoTarjetas: coerceAmount(form.ingresoTarjetas),
    ingresoTransferencias: coerceAmount(form.ingresoTransferencias),
    ingresoEfectivo: coerceAmount(form.ingresoEfectivo),
    gastosDiarios: coerceAmount(form.gastosDiarios),
  });

  const serviceTotals =
    coerceAmount(form.consultas) +
    coerceAmount(form.controles) +
    coerceAmount(form.tests) +
    coerceAmount(form.vacunas) +
    coerceAmount(form.licencias) +
    coerceAmount(form.roxair) +
    coerceAmount(form.otrosAbonos);

  const paymentMethodTotal = derived.subtotal;
  const hasDifference = serviceTotals !== paymentMethodTotal;
  const difference = serviceTotals - paymentMethodTotal;

  const mutation = useMutation({
    mutationFn: async (payload: ProductionBalancePayload) => {
      return saveProductionBalance(payload, selectedId);
    },
    onSuccess: (saved) => {
      toastSuccess("Balance guardado correctamente");
      setSelectedId(saved.id);
      setForm((prev) => ({ ...prev, status: saved.status, reason: "" }));
      queryClient.invalidateQueries({ queryKey: ["production-balances"] });
      queryClient.invalidateQueries({ queryKey: ["production-balance-history", saved.id] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo guardar el balance";
      toastError(message);
    },
  });

  const proceedSave = (options: { forceFinal: boolean }) => {
    const { forceFinal } = options;
    if (forceFinal && form.status !== "FINAL") {
      setForm((prev) => ({ ...prev, status: "FINAL" }));
    }

    const payload = toPayload({ ...form, status: forceFinal ? "FINAL" : form.status });
    mutation.mutate(payload);
  };

  return {
    form,
    setForm,
    selectedId,
    setSelectedId,
    wasFinal,
    derived,
    serviceTotals,
    paymentMethodTotal,
    hasDifference,
    difference,
    mutation,
    proceedSave,
    resetForm: (date: string | null) => {
      setForm(makeDefaultForm(date ?? undefined));
      setSelectedId(null);
    },
  };
}
