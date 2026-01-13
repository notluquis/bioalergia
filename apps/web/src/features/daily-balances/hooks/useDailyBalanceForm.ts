import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef } from "react";

import { useToast } from "@/context/ToastContext";

import { dailyBalanceApi, type ProductionBalanceApiItem } from "../api";
import type { DailyBalanceFormData } from "../types";
import { generateWeekData, useDailyBalanceStore } from "./useDailyBalanceStore";

const AUTOSAVE_DELAY_MS = 2000;

// Helper to map API item to Form Data
function mapApiToForm(item: ProductionBalanceApiItem): DailyBalanceFormData {
  return {
    tarjeta: item.ingresoTarjetas,
    transferencia: item.ingresoTransferencias,
    efectivo: item.ingresoEfectivo,
    gastos: item.gastosDiarios,
    consultas: item.consultas,
    controles: item.controles,
    tests: item.tests,
    vacunas: item.vacunas,
    licencias: item.licencias,
    roxair: item.roxair,
    otros: item.otrosAbonos || 0,
    nota: item.comentarios || "",
  };
}

/**
 * Hook for Daily Balance form logic with autosave
 */
export function useDailyBalanceForm() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    selectedDate,
    formData,
    isDirty,
    isSaving,
    lastSaved,
    summary,
    status,
    weekData,
    currentEntryId,
    setSelectedDate,
    updateField,
    setOriginalData,
    setWeekData,
    setIsSaving,
    markSaved,
    resetForm,
  } = useDailyBalanceStore();

  // Fetch entry for selected date (and week context)
  // We fetch a 7-day range to populate the week strip logic if needed,
  // or we can just fetch the specific day.
  // Given the backend `listProductionBalances` returns a list, fetching the specific day is safest for the form.
  const entryQuery = useQuery({
    queryKey: ["daily-balances", selectedDate],
    queryFn: async () => {
      // Fetch just the selected date
      const response = await dailyBalanceApi.getBalances(selectedDate, selectedDate);
      return response.items[0] || null;
    },
    enabled: !!selectedDate,
  });

  // Load data when query succeeds
  useEffect(() => {
    // If we have data, map it and set it
    if (entryQuery.data) {
      const formValues = mapApiToForm(entryQuery.data);
      setOriginalData(formValues, entryQuery.data.id);
    }
    // If query succeeded but no data (day is empty), reset form
    else if (entryQuery.isSuccess && !entryQuery.data) {
      resetForm();
    }
  }, [entryQuery.data, entryQuery.isSuccess, setOriginalData, resetForm]);

  // Generate week data
  // NOTE: Ideally we would fetch the whole week's totals here.
  // For now, we will just generate the days structure.
  useEffect(() => {
    // Future improvement: Fetch week totals to show colored dots for other days
    const mockEntries: Record<string, number> = {};
    const week = generateWeekData(selectedDate, mockEntries);
    setWeekData(week);
  }, [selectedDate, setWeekData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DailyBalanceFormData) => {
      if (currentEntryId) {
        // Update existing
        return dailyBalanceApi.updateBalance(currentEntryId, { ...data, date: selectedDate });
      }
      // Create new
      return dailyBalanceApi.createBalance({ ...data, date: selectedDate });
    },
    onMutate: () => {
      setIsSaving(true);
    },
    onSuccess: (response) => {
      markSaved(response.item.id);
      success("Balance guardado");
      queryClient.invalidateQueries({ queryKey: ["daily-balances"] });
      // Also invalidate week view if we had one
    },
    onError: (err) => {
      setIsSaving(false);
      showError(err instanceof Error ? err.message : "Error al guardar");
    },
    onSettled: () => {
      setIsSaving(false);
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
  }, [isDirty, formData, save]);

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
    const prev = dayjs(selectedDate).subtract(7, "day").format("YYYY-MM-DD");
    setSelectedDate(prev);
  }, [selectedDate, setSelectedDate]);

  const goToNextWeek = useCallback(() => {
    const next = dayjs(selectedDate).add(7, "day").format("YYYY-MM-DD");
    setSelectedDate(next);
  }, [selectedDate, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(dayjs().format("YYYY-MM-DD"));
  }, [setSelectedDate]);

  const selectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
    },
    [setSelectedDate]
  );

  return {
    // State
    selectedDate,
    formData,
    isDirty,
    isLoading: entryQuery.isLoading,
    isSaving,
    lastSaved,
    summary,
    status,
    weekData,

    // Actions
    updateField,
    save,
    finalize,
    selectDate,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
  };
}
