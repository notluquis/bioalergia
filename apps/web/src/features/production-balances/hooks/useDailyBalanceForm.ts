import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/context/AuthContext";
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
    consultas: item.consultasMonto,
    controles: item.controlesMonto,
    tests: item.testsMonto,
    vacunas: item.vacunasMonto,
    licencias: item.licenciasMonto,
    roxair: item.roxairMonto,
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

  // Find item by balanceDate (formatted as YYYY-MM-DD or comparison)
  // ZenStack likely returns full ISO string "2024-01-01T00:00:00.000Z"
  // So we must compare prefix or use dayjs
  const selectedDayItem = weekQuery.data?.find((item) => item.balanceDate.startsWith(selectedDate)) || null;

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
        // total? We might need to calculate it if backend doesn't send 'total'
        // But for now, let's assume 'total' might be calculated?
        // Wait, schema does NOT have 'total'. I need to calculate it?
        // Or assume the hook logic elsewhere handles totals.
        // For 'weekData' (header dots), we typically just need existence or status?
        // The 'total' property was in the old interface.
        // Let's compute a simple total or 0 if missing.
        // Actually, we can sum the fields.
        const calculatedTotal =
          item.ingresoTarjetas + item.ingresoTransferencias + item.ingresoEfectivo + item.otrosAbonos;
        const dateKey = item.balanceDate.split("T")[0];
        if (dateKey) {
          entries[dateKey] = calculatedTotal;
        }
      });
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
        balanceDate: new Date(selectedDate).toISOString(),
        ingresoTarjetas: data.tarjeta,
        ingresoTransferencias: data.transferencia,
        ingresoEfectivo: data.efectivo,
        gastosDiarios: data.gastos,
        otrosAbonos: data.otros,
        comentarios: data.nota,
        consultasMonto: data.consultas,
        controlesMonto: data.controles,
        testsMonto: data.tests,
        vacunasMonto: data.vacunas,
        licenciasMonto: data.licencias,
        roxairMonto: data.roxair,
        createdBy: user?.id, // Ensure user is connected
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
