import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef } from "react";

import { useToast } from "@/context/ToastContext";

import { dailyBalanceApi, type ProductionBalanceApiItem } from "../api";
import type { DailyBalanceFormData } from "../types";
import { generateWeekData, useDailyBalanceStore } from "./useDailyBalanceStore";

const AUTOSAVE_DELAY_MS = 2000;
const QUERY_KEY = "production-balances";
const DATE_FORMAT = "YYYY-MM-DD";

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
  // We fetch a 7-day range to populate the week strip logic
  const startOfWeek = dayjs(selectedDate).startOf("week").format(DATE_FORMAT);
  const endOfWeek = dayjs(selectedDate).endOf("week").format(DATE_FORMAT);

  const weekQuery = useQuery({
    queryKey: [QUERY_KEY, "week", startOfWeek, endOfWeek],
    queryFn: async () => {
      // Fetch the whole week
      const response = await dailyBalanceApi.getBalances(startOfWeek, endOfWeek);
      return response.items;
    },
    enabled: !!selectedDate,
  });

  const selectedDayItem = weekQuery.data?.find((item) => item.date === selectedDate) || null;

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
  }, [selectedDayItem, weekQuery.isSuccess, setOriginalData, resetForm, selectedDate]);

  // Generate week data with real status
  useEffect(() => {
    const entries: Record<string, number> = {};
    if (weekQuery.data) {
      weekQuery.data.forEach((item) => {
        entries[item.date] = item.total;
      });
    }
    const week = generateWeekData(selectedDate, entries);
    setWeekData(week);
  }, [selectedDate, weekQuery.data, setWeekData]);

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
      // Invalidate the week query so dots update
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
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
    [setSelectedDate]
  );

  return {
    // State
    selectedDate,
    formData,
    isDirty,
    isLoading: weekQuery.isLoading,
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
