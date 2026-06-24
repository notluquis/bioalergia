import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import { useMemo } from "react";

import { addDays, chileDay, civilNoon, formatChile, startOfWeek } from "@/lib/dates";
import type {
  BalanceSummary,
  DailyBalanceFormData,
  DayCell,
  DayEntrySummary,
  DayStatus,
  WeekData,
} from "../types";

import { areFormDataEqual, calculateSummary, getDayAbbrev } from "../utils";

const defaultFormData: DailyBalanceFormData = {
  consultas: 0,
  controles: 0,
  efectivo: 0,
  gastos: 0,
  licencias: 0,
  nota: "",
  otros: 0,
  roxair: 0,
  tarjeta: 0,
  tests: 0,
  transferencia: 0,
  vacunas: 0,
};

export interface DailyBalanceState {
  // ID de la entrada en DB para el día seleccionado (null = día sin guardar)
  currentEntryId: null | number;
  // true cuando la entrada del día está FINALIZED en el API
  entryFinalized: boolean;
  // Form del día seleccionado
  formData: DailyBalanceFormData;
  isSaving: boolean;
  lastSaved: Date | null;
  // Snapshot del último estado persistido (para detectar dirty)
  originalData: DailyBalanceFormData;
  selectedDate: Date;
  // Datos derivados para el WeekStrip
  weekData: null | WeekData;
}

export const dailyBalanceStore = new Store<DailyBalanceState>({
  currentEntryId: null,
  entryFinalized: false,
  formData: { ...defaultFormData },
  isSaving: false,
  lastSaved: null,
  originalData: { ...defaultFormData },
  selectedDate: new Date(),
  weekData: null,
});

function dayStatusFromEntry(entry: DayEntrySummary | undefined): DayStatus {
  if (!entry || entry.total <= 0) {
    return "empty";
  }
  if (entry.finalized) {
    return "finalized";
  }
  return entry.cuadra ? "draft" : "unbalanced";
}

export function generateWeekData(
  centerDate: Date,
  entries: Record<string, DayEntrySummary>
): WeekData {
  const centerISO = chileDay(centerDate);
  const weekStart = startOfWeek(centerISO); // lunes ISO

  const days: DayCell[] = [];

  for (let i = 0; i < 7; i++) {
    const dateStr = addDays(weekStart, i);
    const entry = entries[dateStr];
    const dateObj = civilNoon(dateStr);

    days.push({
      date: dateObj,
      dayName: getDayAbbrev(dateObj),
      dayNumber: Number(dateStr.slice(8, 10)),
      status: dayStatusFromEntry(entry),
      total: entry?.total ?? 0,
    });
  }

  const weekEnd = addDays(weekStart, 6);

  return {
    days,
    weekLabel: `${formatChile(weekStart, "D")} – ${formatChile(weekEnd, "D MMM YYYY")}`,
  };
}

/** Estado del día seleccionado para chips de TopBar/CierrePanel. */
function computeStatus(
  data: DailyBalanceFormData,
  summary: BalanceSummary,
  finalized: boolean
): DayStatus {
  if (finalized) {
    return "finalized";
  }
  const hasData = data.tarjeta > 0 || data.transferencia > 0 || data.efectivo > 0;
  if (!hasData) {
    return "empty";
  }
  return summary.cuadra ? "draft" : "unbalanced";
}

export const setSelectedDate = (date: Date) => {
  dailyBalanceStore.setState((s) => ({ ...s, selectedDate: date }));
};

export const updateField = <K extends keyof DailyBalanceFormData>(
  field: K,
  value: DailyBalanceFormData[K]
) => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    formData: { ...s.formData, [field]: value },
  }));
};

export const setOriginalData = (
  data: DailyBalanceFormData,
  entry?: { finalized: boolean; id: number }
) => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    currentEntryId: entry?.id ?? null,
    entryFinalized: entry?.finalized ?? false,
    formData: data,
    originalData: data,
  }));
};

export const setWeekData = (data: WeekData) => {
  dailyBalanceStore.setState((s) => ({ ...s, weekData: data }));
};

export const setIsSaving = (saving: boolean) => {
  dailyBalanceStore.setState((s) => ({ ...s, isSaving: saving }));
};

export const markSaved = (entry: { finalized: boolean; id: number }) => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    currentEntryId: entry.id,
    entryFinalized: entry.finalized,
    lastSaved: new Date(),
    originalData: { ...s.formData },
  }));
};

export const resetForm = () => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    currentEntryId: null,
    entryFinalized: false,
    formData: { ...defaultFormData },
    originalData: { ...defaultFormData },
  }));
};

export function useDailyBalanceStore() {
  const state = useStore(dailyBalanceStore, (state) => state);

  const summary = useMemo(() => calculateSummary(state.formData), [state.formData]);

  const status = useMemo(
    () => computeStatus(state.formData, summary, state.entryFinalized),
    [state.formData, summary, state.entryFinalized]
  );
  const isDirty = useMemo(
    () => !areFormDataEqual(state.formData, state.originalData),
    [state.formData, state.originalData]
  );

  return {
    ...state,
    isDirty,
    markSaved,
    resetForm,
    setIsSaving,
    setOriginalData,
    setSelectedDate,
    setWeekData,
    status,
    summary,
    updateField,
  };
}
