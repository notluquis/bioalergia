import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { dailyBalanceApi, type ProductionBalanceApiItem } from "../api";
import { productionBalanceKeys } from "../queries";
import type { DailyBalanceFormData } from "../types";
import { generateWeekData, useDailyBalanceStore } from "./use-daily-balance-store";

const AUTOSAVE_DELAY_MS = 2000;

const DATE_FORMAT = "YYYY-MM-DD";

/**
 * Hook for Daily Balance form logic with autosave
 */
export function useDailyBalanceForm() {
  const { error: showError, success } = useToast();
  const queryClient = useQueryClient();
  const autosaveTimeout = useRef<null | ReturnType<typeof setTimeout>>(null);

  const {
    currentEntryId,
    formData,
    isDirty,
    isSaving,
    lastSaved,
    markSaved,
    resetForm,
    selectedDate,
    setIsSaving,
    setOriginalData,
    setSelectedDate,
    setWeekData,
    status,
    summary,
    updateField,
    weekData,
  } = useDailyBalanceStore();

  // Fetch entry for selected date (and week context)
  // We fetch a 7-day range to populate the week strip logic
  const startOfWeek = dayjs(selectedDate).startOf("week").format(DATE_FORMAT);
  const endOfWeek = dayjs(selectedDate).endOf("week").format(DATE_FORMAT);

  const weekQuery = useSuspenseQuery(productionBalanceKeys.week(startOfWeek, endOfWeek));

  // Find item by date (YYYY-MM-DD)
  const selectedDayItem = weekQuery.data.find((item) => item.date === selectedDate) || null;

  // Load data when query succeeds (if day changes or we just loaded data)
  useEffect(() => {
    // If we have data for this day, map it and set it
    if (selectedDayItem) {
      const formValues = mapApiToForm(selectedDayItem);
      setOriginalData(formValues, selectedDayItem.id);
    }
    // If query succeeded but no data for this day, reset form
    else if (weekQuery.isSuccess && !selectedDayItem) {
      // Only reset if we are not currently saving (to avoid race conditions)
      resetForm();
    }
  }, [selectedDayItem, weekQuery.isSuccess, setOriginalData, resetForm]);

  // Generate week data with real status
  useEffect(() => {
    const entries: Record<string, number> = {};
    if (weekQuery.data) {
      for (const item of weekQuery.data) {
        // total? We might need to calculate it if backend doesn't send 'total'
        // But for now, let's assume 'total' might be calculated?
        // Wait, schema does NOT have 'total'. I need to calculate it?
        // Or assume the hook logic elsewhere handles totals.
        // For 'weekData' (header dots), we typically just need existence or status?
        // The 'total' property was in the old interface.
        // Let's compute a simple total or 0 if missing.
        // Actually, we can sum the fields.
        const calculatedTotal =
          item.ingresoTarjetas +
          item.ingresoTransferencias +
          item.ingresoEfectivo +
          item.otrosAbonos;
        if (item.date) {
          entries[item.date] = calculatedTotal;
        }
      }
    }
    const week = generateWeekData(selectedDate, entries);
    setWeekData(week);
  }, [selectedDate, weekQuery.data, setWeekData]);

  const { user } = useAuth();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DailyBalanceFormData) => {
      // transform to schema format
      const payload = {
        date: selectedDate,
        comentarios: data.nota,
        consultasMonto: data.consultas,
        controlesMonto: data.controles,
        createdBy: user?.id, // Ensure user is connected
        gastosDiarios: data.gastos,
        ingresoEfectivo: data.efectivo,
        ingresoTarjetas: data.tarjeta,
        ingresoTransferencias: data.transferencia,
        licenciasMonto: data.licencias,
        otrosAbonos: data.otros,
        roxairMonto: data.roxair,
        testsMonto: data.tests,
        vacunasMonto: data.vacunas,
      };

      if (currentEntryId) {
        // Update existing (we don't strictly need Date/User on update if they don't change, but safer to send)
        // Check if update API allows changing Date/User? Usually ID is enough.
        // But let's send mapped fields.
        return dailyBalanceApi.updateBalance(currentEntryId, payload);
      }
      // Create new
      if (!user?.id) throw new Error("No authenticated user found");
      return dailyBalanceApi.createBalance(payload);
    },
    onMutate: () => {
      setIsSaving(true);
    },
    onError: (err) => {
      setIsSaving(false);
      showError(err instanceof Error ? err.message : "Error al guardar");
    },
    onSettled: () => {
      setIsSaving(false);
    },
    onSuccess: (response) => {
      markSaved(response.item.id);
      success("Balance guardado");
      // Invalidate the week query so dots update
      void queryClient.invalidateQueries({ queryKey: productionBalanceKeys.all });
    },
  });

  // Save function
  const { mutate: saveMutate } = saveMutation;
  const save = useCallback(() => {
    if (!isDirty) return;
    saveMutate(formData);
  }, [isDirty, formData, saveMutate]);

  // Autosave: trigger save after delay when dirty
  useEffect(() => {
    if (!isDirty) return;

    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }

    autosaveTimeout.current = setTimeout(() => {
      save();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, [isDirty, save]);

  // Finalize day
  const finalize = useCallback(() => {
    if (!summary.cuadra) {
      showError("El balance no cuadra");
      return;
    }
    // For now, finalizing just means ensuring it's saved.
    // In the future, this might trigger a status update to "CLOSED" if the API supports it.
    if (isDirty) {
      save();
    }
    success("Día finalizado");
  }, [summary, success, showError, isDirty, save]);

  // Navigation
  const goToPrevWeek = useCallback(() => {
    const prev = dayjs(selectedDate).subtract(7, "day").format(DATE_FORMAT);
    setSelectedDate(prev);
  }, [selectedDate, setSelectedDate]);

  const goToNextWeek = useCallback(() => {
    const next = dayjs(selectedDate).add(7, "day").format(DATE_FORMAT);
    setSelectedDate(next);
  }, [selectedDate, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(dayjs().format(DATE_FORMAT));
  }, [setSelectedDate]);

  const selectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
    },
    [setSelectedDate],
  );

  return {
    finalize,
    formData,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    isDirty,
    isLoading: weekQuery.isLoading,
    isSaving,
    lastSaved,

    save,
    selectDate,
    // State
    selectedDate,
    status,
    summary,
    // Actions
    updateField,
    weekData,
  };
}

// Helper to map API item to Form Data
function mapApiToForm(item: ProductionBalanceApiItem): DailyBalanceFormData {
  return {
    consultas: item.consultasMonto,
    controles: item.controlesMonto,
    efectivo: item.ingresoEfectivo,
    gastos: item.gastosDiarios,
    licencias: item.licenciasMonto,
    nota: item.comentarios || "",
    otros: item.otrosAbonos || 0,
    roxair: item.roxairMonto,
    tarjeta: item.ingresoTarjetas,
    tests: item.testsMonto,
    transferencia: item.ingresoTransferencias,
    vacunas: item.vacunasMonto,
  };
}
