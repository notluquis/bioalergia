import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/context/AuthContext";
import { toast } from "@/lib/toast-interceptor";
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
  const selectedDayItem =
    weekQuery.data.find(
      (item) =>
        dayjs(item.date, DATE_FORMAT).format(DATE_FORMAT) ===
        dayjs(selectedDate).format(DATE_FORMAT),
    ) || null;

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
          const dateKey = dayjs(item.date, DATE_FORMAT).format(DATE_FORMAT);
          entries[dateKey] = calculatedTotal;
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
        date: dayjs(selectedDate).format(DATE_FORMAT),
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
      if (!user?.id) {
        throw new Error("No authenticated user found");
      }
      return dailyBalanceApi.createBalance(payload);
    },
    onMutate: () => {
      setIsSaving(true);
    },
    onError: () => {
      setIsSaving(false);
    },
    onSettled: () => {
      setIsSaving(false);
    },
    onSuccess: (response) => {
      markSaved(response.item.id);
      // Invalidate the week query so dots update
      void queryClient.invalidateQueries({ queryKey: productionBalanceKeys.all });
    },
  });

  type SaveOptions = {
    errorMessage?: string;
    loadingMessage?: string;
    silent?: boolean;
    successMessage?: string;
  };

  const { mutateAsync: saveMutateAsync } = saveMutation;
  const save = useCallback(
    async (options?: SaveOptions) => {
      if (!isDirty || isSaving) {
        return true;
      }

      const operation = saveMutateAsync(formData);

      if (options?.silent) {
        try {
          await operation;
          return true;
        } catch {
          return false;
        }
      }

      try {
        await toast.promise(operation, {
          error: (err: unknown) =>
            options?.errorMessage ??
            (err instanceof Error ? err.message : "Error al guardar el balance"),
          loading: options?.loadingMessage ?? "Guardando balance...",
          success: options?.successMessage ?? "Balance guardado",
        });
        return true;
      } catch {
        return false;
      }
    },
    [formData, isDirty, isSaving, saveMutateAsync],
  );

  const saveDraft = useCallback(() => {
    void save({
      loadingMessage: "Guardando borrador...",
      successMessage: "Borrador guardado",
    });
  }, [save]);

  // Autosave: trigger save after delay when dirty
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    if (isSaving) {
      return;
    }

    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }

    autosaveTimeout.current = setTimeout(() => {
      void save({ silent: true });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, [isDirty, isSaving, save]);

  // Finalize day
  const finalize = useCallback(async () => {
    if (!summary.cuadra) {
      toast.error("El balance no cuadra", {
        description: "Revisa la diferencia antes de finalizar",
      });
      return;
    }
    if (isSaving) {
      return;
    }

    if (isDirty) {
      await save({
        errorMessage: "No se pudo finalizar. Intenta nuevamente.",
        loadingMessage: "Guardando y finalizando...",
        successMessage: "Día finalizado",
      });
      return;
    }

    toast.success("Día finalizado", { description: "No había cambios pendientes por guardar" });
  }, [summary.cuadra, isSaving, isDirty, save]);

  // Navigation
  const goToPrevWeek = useCallback(() => {
    const prev = dayjs(selectedDate).subtract(7, "day").toDate();
    setSelectedDate(prev);
  }, [selectedDate, setSelectedDate]);

  const goToNextWeek = useCallback(() => {
    const next = dayjs(selectedDate).add(7, "day").toDate();
    setSelectedDate(next);
  }, [selectedDate, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(dayjs().toDate());
  }, [setSelectedDate]);

  const selectDate = useCallback(
    (date: Date) => {
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

    save: saveDraft,
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
