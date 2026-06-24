import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { confirmAction } from "@/components/ui/ConfirmDialog";
import { addDays, chileDay, civilNoon, endOfWeek, startOfWeek } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";
import { dailyBalanceApi, type ProductionBalanceItem, type ProductionBalanceStatus } from "../api";
import { productionBalanceKeys } from "../queries";
import type { DailyBalanceFormData, DayEntrySummary } from "../types";
import { areFormDataEqual } from "../utils";
import { generateWeekData, useDailyBalanceStore } from "./use-daily-balance-store";

const AUTOSAVE_DELAY_MS = 2000;

type SaveOptions = {
  errorMessage?: string;
  loadingMessage?: string;
  silent?: boolean;
  status?: ProductionBalanceStatus;
  successMessage?: string;
};

function buildDailyBalancePayload(
  data: DailyBalanceFormData,
  selectedDate: Date,
  status: ProductionBalanceStatus
) {
  return {
    date: chileDay(selectedDate),
    comentarios: data.nota,
    consultasMonto: data.consultas,
    controlesMonto: data.controles,
    gastosDiarios: data.gastos,
    ingresoEfectivo: data.efectivo,
    ingresoTarjetas: data.tarjeta,
    ingresoTransferencias: data.transferencia,
    licenciasMonto: data.licencias,
    otrosAbonos: data.otros,
    roxairMonto: data.roxair,
    status,
    testsMonto: data.tests,
    vacunasMonto: data.vacunas,
  };
}

function getSelectedDayItem(
  data: ProductionBalanceItem[] | undefined,
  selectedDate: Date
): null | ProductionBalanceItem {
  return data?.find((item) => item.date === chileDay(selectedDate)) ?? null;
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
      day.status === nextDay.status &&
      day.total === nextDay.total &&
      chileDay(day.date) === chileDay(nextDay.date)
    );
  });
}

function useSyncSelectedDayForm(params: {
  currentEntryId: null | number;
  formData: DailyBalanceFormData;
  originalData: DailyBalanceFormData;
  resetForm: () => void;
  selectedDate: Date;
  setOriginalData: (data: DailyBalanceFormData, entry?: { finalized: boolean; id: number }) => void;
  weekData: ProductionBalanceItem[] | undefined;
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
        setOriginalData(nextFormData, {
          finalized: selectedDayItem.status === "FINALIZED",
          id: selectedDayItem.id,
        });
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
  weekData: ProductionBalanceItem[] | undefined;
}) {
  const { selectedDate, setWeekData, storeWeekData, weekData } = params;

  useEffect(() => {
    const entries: Record<string, DayEntrySummary> = {};
    if (weekData) {
      for (const item of weekData) {
        const totalMetodos =
          item.ingresoTarjetas + item.ingresoTransferencias + item.ingresoEfectivo;
        const totalServicios =
          item.consultasMonto +
          item.controlesMonto +
          item.testsMonto +
          item.vacunasMonto +
          item.licenciasMonto +
          item.roxairMonto +
          item.otrosAbonos;
        entries[item.date] = {
          cuadra: totalMetodos === totalServicios,
          finalized: item.status === "FINALIZED",
          total: totalMetodos + item.otrosAbonos,
        };
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
  enabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  save: (options?: SaveOptions) => Promise<boolean>;
}) {
  const { autosaveTimeout, enabled, isDirty, isSaving, save } = params;
  useEffect(() => {
    if (!enabled || !isDirty || isSaving) {
      return;
    }

    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }

    autosaveTimeout.current = setTimeout(() => {
      void save({ silent: true });
    }, AUTOSAVE_DELAY_MS);

    const timeout = autosaveTimeout.current;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [autosaveTimeout, enabled, isDirty, isSaving, save]);
}

/**
 * Hook for Daily Balance form logic with autosave
 */
export function useDailyBalanceForm() {
  const queryClient = useQueryClient();
  const autosaveTimeout = useRef<null | ReturnType<typeof setTimeout>>(null);

  const {
    currentEntryId,
    entryFinalized,
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

  // Se trae el rango de la semana completa para alimentar el WeekStrip.
  const weekStartISO = startOfWeek(selectedDate);
  const weekEndISO = endOfWeek(selectedDate);

  const weekQuery = useSuspenseQuery(productionBalanceKeys.week(weekStartISO, weekEndISO));

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

  const saveMutation = useMutation({
    mutationFn: async (input: { data: DailyBalanceFormData; status: ProductionBalanceStatus }) => {
      const payload = buildDailyBalancePayload(input.data, selectedDate, input.status);
      if (currentEntryId) {
        return dailyBalanceApi.updateBalance(currentEntryId, payload);
      }
      return dailyBalanceApi.createBalance(payload);
    },
    onMutate: () => {
      setIsSaving(true);
    },
    onSettled: () => {
      setIsSaving(false);
    },
    onSuccess: (response) => {
      markSaved({ finalized: response.item.status === "FINALIZED", id: response.item.id });
      // Refresca la semana para que los dots del WeekStrip se actualicen.
      void queryClient.invalidateQueries({ queryKey: productionBalanceKeys.all });
    },
  });

  const { mutateAsync: saveMutateAsync } = saveMutation;

  /**
   * Persiste el día. Devuelve `true` solo cuando la mutación realmente
   * terminó OK (la versión anterior retornaba `true` sin esperar).
   */
  const save = useCallback(
    async (options?: SaveOptions) => {
      const nextStatus = options?.status ?? (entryFinalized ? "FINALIZED" : "DRAFT");
      const statusChanges =
        options?.status !== undefined &&
        options.status !== (entryFinalized ? "FINALIZED" : "DRAFT");

      if ((!isDirty && !statusChanges) || isSaving) {
        return true;
      }

      const operation = saveMutateAsync({ data: formData, status: nextStatus });

      if (!options?.silent) {
        toast.promise(operation, {
          error: (err: unknown) =>
            options?.errorMessage ??
            (err instanceof Error ? err.message : "Error al guardar el balance"),
          loading: options?.loadingMessage ?? "Guardando balance...",
          success: options?.successMessage ?? "Balance guardado",
        });
      }

      try {
        await operation;
        return true;
      } catch {
        return false;
      }
    },
    [entryFinalized, formData, isDirty, isSaving, saveMutateAsync]
  );

  const saveDraft = useCallback(() => {
    void save({
      loadingMessage: "Guardando borrador...",
      successMessage: "Borrador guardado",
    });
  }, [save]);

  useAutosaveEffect({ autosaveTimeout, enabled: !entryFinalized, isDirty, isSaving, save });

  /** Cierra el día: persiste status FINALIZED (aunque el form esté limpio). */
  const finalize = useCallback(async () => {
    if (!summary.cuadra) {
      toast.error("El balance no cuadra", {
        description: "Revisa la diferencia antes de finalizar",
      });
      return;
    }
    if (isSaving || entryFinalized) {
      return;
    }

    await save({
      errorMessage: "No se pudo finalizar. Intenta nuevamente.",
      loadingMessage: "Finalizando día...",
      status: "FINALIZED",
      successMessage: "Día finalizado",
    });
  }, [summary.cuadra, isSaving, entryFinalized, save]);

  /** Reabre un día finalizado (vuelve a DRAFT) previa confirmación. */
  const reopen = useCallback(async () => {
    if (!entryFinalized || isSaving) {
      return;
    }
    const confirmed = await confirmAction({
      confirmLabel: "Reabrir",
      description: "El día volverá a estado borrador y podrá editarse nuevamente.",
      title: "¿Reabrir este día?",
    });
    if (!confirmed) {
      return;
    }
    await save({
      errorMessage: "No se pudo reabrir el día.",
      loadingMessage: "Reabriendo día...",
      status: "DRAFT",
      successMessage: "Día reabierto",
    });
  }, [entryFinalized, isSaving, save]);

  /**
   * Cambia de día sin perder trabajo: si hay cambios pendientes primero
   * intenta un guardado silencioso; si falla, pide confirmación para
   * descartar antes de navegar.
   */
  const navigateToDate = useCallback(
    async (date: Date) => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
        autosaveTimeout.current = null;
      }
      if (isDirty && !entryFinalized) {
        const saved = await save({ silent: true });
        if (!saved) {
          const discard = await confirmAction({
            confirmLabel: "Descartar",
            description:
              "No se pudieron guardar los cambios del día actual. ¿Descartar y cambiar de día?",
            title: "Cambios sin guardar",
            variant: "danger",
          });
          if (!discard) {
            return;
          }
        }
      }
      setSelectedDate(date);
    },
    [entryFinalized, isDirty, save, setSelectedDate]
  );

  const goToPrevWeek = useCallback(() => {
    void navigateToDate(civilNoon(addDays(chileDay(selectedDate), -7)));
  }, [navigateToDate, selectedDate]);

  const goToNextWeek = useCallback(() => {
    void navigateToDate(civilNoon(addDays(chileDay(selectedDate), 7)));
  }, [navigateToDate, selectedDate]);

  const goToToday = useCallback(() => {
    void navigateToDate(new Date());
  }, [navigateToDate]);

  const selectDate = useCallback(
    (date: Date) => {
      void navigateToDate(date);
    },
    [navigateToDate]
  );

  return {
    finalize,
    formData,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    isDirty,
    isFinalized: entryFinalized,
    isSaving,
    lastSaved,
    reopen,
    save: saveDraft,
    selectDate,
    selectedDate,
    status,
    summary,
    updateField,
    weekData,
  };
}

// Helper to map API item to Form Data
function mapApiToForm(item: ProductionBalanceItem): DailyBalanceFormData {
  return {
    consultas: item.consultasMonto,
    controles: item.controlesMonto,
    efectivo: item.ingresoEfectivo,
    gastos: item.gastosDiarios,
    licencias: item.licenciasMonto,
    nota: item.comentarios ?? "",
    otros: item.otrosAbonos,
    roxair: item.roxairMonto,
    tarjeta: item.ingresoTarjetas,
    tests: item.testsMonto,
    transferencia: item.ingresoTransferencias,
    vacunas: item.vacunasMonto,
  };
}
