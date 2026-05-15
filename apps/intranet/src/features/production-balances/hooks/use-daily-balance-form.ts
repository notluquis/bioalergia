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

type SaveOptions = {
  errorMessage?: string;
  loadingMessage?: string;
  silent?: boolean;
  successMessage?: string;
};

function buildDailyBalancePayload(data: DailyBalanceFormData, selectedDate: Date, userId?: number) {
  return {
    date: dayjs(selectedDate).format(DATE_FORMAT),
    comentarios: data.nota,
    consultasMonto: data.consultas,
    controlesMonto: data.controles,
    createdBy: userId,
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
}

function getSelectedDayItem(
  data: ProductionBalanceApiItem[] | undefined,
  selectedDate: Date
): null | ProductionBalanceApiItem {
  return (
    data?.find(
      (item) =>
        dayjs(item.date, DATE_FORMAT).format(DATE_FORMAT) ===
        dayjs(selectedDate).format(DATE_FORMAT)
    ) ?? null
  );
}

function areFormDataEqual(a: DailyBalanceFormData, b: DailyBalanceFormData): boolean {
  return (
    a.consultas === b.consultas &&
    a.controles === b.controles &&
    a.efectivo === b.efectivo &&
    a.gastos === b.gastos &&
    a.licencias === b.licencias &&
    a.nota === b.nota &&
    a.otros === b.otros &&
    a.roxair === b.roxair &&
    a.tarjeta === b.tarjeta &&
    a.tests === b.tests &&
    a.transferencia === b.transferencia &&
    a.vacunas === b.vacunas
  );
}

function areWeekDataEqual(
  currentWeek: ReturnType<typeof generateWeekData> | null,
  nextWeek: ReturnType<typeof generateWeekData>
): boolean {
  if (!currentWeek) return false;
  if (currentWeek.weekLabel !== nextWeek.weekLabel) return false;
  if (currentWeek.days.length !== nextWeek.days.length) return false;

  return currentWeek.days.every((day, index) => {
    const nextDay = nextWeek.days[index];
    if (!nextDay) return false;
    return (
      day.dayName === nextDay.dayName &&
      day.dayNumber === nextDay.dayNumber &&
      day.isSelected === nextDay.isSelected &&
      day.isToday === nextDay.isToday &&
      day.status === nextDay.status &&
      day.total === nextDay.total &&
      dayjs(day.date).isSame(nextDay.date, "day")
    );
  });
}

function useSyncSelectedDayForm(params: {
  currentEntryId: null | number;
  formData: DailyBalanceFormData;
  originalData: DailyBalanceFormData;
  resetForm: () => void;
  selectedDate: Date;
  setOriginalData: (data: DailyBalanceFormData, entryId?: number) => void;
  weekData: ProductionBalanceApiItem[] | undefined;
  weekSuccess: boolean;
}) {
  const {
    currentEntryId,
    formData,
    originalData,
    resetForm,
    selectedDate,
    setOriginalData,
    weekData,
    weekSuccess,
  } = params;
  const selectedDayItem = getSelectedDayItem(weekData, selectedDate);

  useEffect(() => {
    if (selectedDayItem) {
      const nextFormData = mapApiToForm(selectedDayItem);
      const entryChanged = currentEntryId !== selectedDayItem.id;
      // Only sync API → form when:
      //   (a) the entry itself changed (operator picked a different day), or
      //   (b) the form is *clean* (formData == originalData) AND the
      //       server pushed a fresher snapshot for the same entry.
      // The previous `!sameForm` check fired on every keystroke because
      // `formData` is in the deps + the user's typed value always
      // differs from the API copy — that resets the input to 0 mid-edit.
      // Golden rule: never clobber a dirty form.
      const isDirty = !areFormDataEqual(formData, originalData);
      const serverHasNewer = !areFormDataEqual(originalData, nextFormData);
      if (entryChanged || (!isDirty && serverHasNewer)) {
        setOriginalData(nextFormData, selectedDayItem.id);
      }
      return;
    }
    if (weekSuccess && currentEntryId !== null) {
      // The previously-selected day held an entry; the new day has
      // none → wipe the form so it starts blank. Skipped when
      // `currentEntryId === null` so a user typing on a fresh day
      // doesn't have every keystroke reset to empty.
      resetForm();
    }
  }, [
    currentEntryId,
    formData,
    originalData,
    resetForm,
    selectedDate,
    setOriginalData,
    selectedDayItem,
    weekSuccess,
  ]);
}

function useSyncWeekData(params: {
  selectedDate: Date;
  storeWeekData: ReturnType<typeof generateWeekData> | null;
  setWeekData: (week: ReturnType<typeof generateWeekData>) => void;
  weekData: ProductionBalanceApiItem[] | undefined;
}) {
  const { selectedDate, setWeekData, storeWeekData, weekData } = params;

  useEffect(() => {
    const entries: Record<string, number> = {};
    if (weekData) {
      for (const item of weekData) {
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
    if (!areWeekDataEqual(storeWeekData, week)) {
      setWeekData(week);
    }
  }, [selectedDate, setWeekData, storeWeekData, weekData]);
}

function useAutosaveEffect(params: {
  autosaveTimeout: React.MutableRefObject<null | ReturnType<typeof setTimeout>>;
  isDirty: boolean;
  isSaving: boolean;
  save: (options?: SaveOptions) => Promise<boolean>;
}) {
  useEffect(() => {
    if (!params.isDirty || params.isSaving) {
      return;
    }

    if (params.autosaveTimeout.current) {
      clearTimeout(params.autosaveTimeout.current);
    }

    params.autosaveTimeout.current = setTimeout(() => {
      void params.save({ silent: true });
    }, AUTOSAVE_DELAY_MS);

    const timeout = params.autosaveTimeout.current;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [params]);
}

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
    originalData,
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

  useSyncSelectedDayForm({
    currentEntryId,
    formData,
    originalData,
    resetForm,
    selectedDate,
    setOriginalData,
    weekData: weekQuery.data,
    weekSuccess: weekQuery.isSuccess,
  });
  useSyncWeekData({ selectedDate, setWeekData, storeWeekData: weekData, weekData: weekQuery.data });

  const { user } = useAuth();

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DailyBalanceFormData) => {
      const payload = buildDailyBalancePayload(data, selectedDate, user?.id);

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
        void toast.promise(operation, {
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
    [formData, isDirty, isSaving, saveMutateAsync]
  );

  const saveDraft = useCallback(() => {
    void save({
      loadingMessage: "Guardando borrador...",
      successMessage: "Borrador guardado",
    });
  }, [save]);

  useAutosaveEffect({ autosaveTimeout, isDirty, isSaving, save });

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
    setSelectedDate(dayjs(selectedDate).subtract(7, "day").toDate());
  }, [selectedDate, setSelectedDate]);

  const goToNextWeek = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).add(7, "day").toDate());
  }, [selectedDate, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(dayjs().toDate());
  }, [setSelectedDate]);

  const selectDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
    },
    [setSelectedDate]
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
