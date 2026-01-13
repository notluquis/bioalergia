import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import dayjs from "dayjs";
import { useMemo } from "react";

import type { BalanceSummary, DailyBalanceFormData, DayCell, DayStatus, WeekData } from "../types";
import { calculateSummary, getDayAbbrev } from "../utils";

// Default empty form values
const defaultFormData: DailyBalanceFormData = {
  tarjeta: 0,
  transferencia: 0,
  efectivo: 0,
  gastos: 0,
  consultas: 0,
  controles: 0,
  tests: 0,
  vacunas: 0,
  licencias: 0,
  roxair: 0,
  otros: 0,
  nota: "",
};

export interface DailyBalanceState {
  // Current selected date
  selectedDate: string;

  // Current Entry ID (if exists in DB)
  currentEntryId: number | null;

  // Form data for current day
  formData: DailyBalanceFormData;

  // Original data (to detect changes)
  originalData: DailyBalanceFormData;

  // Week data for navigation
  weekData: WeekData | null;

  // State flags
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

// 1. Base Store
export const dailyBalanceStore = new Store<DailyBalanceState>({
  selectedDate: dayjs().format("YYYY-MM-DD"),
  currentEntryId: null,
  formData: { ...defaultFormData },
  originalData: { ...defaultFormData },
  weekData: null,
  isLoading: false,
  isSaving: false,
  lastSaved: null,
});

// 2. Helper Logic
function computeStatus(data: DailyBalanceFormData, summary: BalanceSummary): DayStatus {
  const hasData = data.tarjeta > 0 || data.transferencia > 0 || data.efectivo > 0;
  if (!hasData) return "empty";
  if (summary.cuadra) return "balanced";
  return "unbalanced";
}

export function generateWeekData(centerDate: string, entries: Record<string, number>): WeekData {
  const center = dayjs(centerDate);
  const startOfWeek = center.startOf("week"); // Sunday
  const endOfWeek = center.endOf("week");

  const days: DayCell[] = [];

  for (let i = 0; i < 7; i++) {
    const d = startOfWeek.add(i, "day");
    const dateStr = d.format("YYYY-MM-DD");
    const total = entries[dateStr] ?? 0;

    days.push({
      date: dateStr,
      dayName: getDayAbbrev(dateStr),
      dayNumber: d.date(),
      total,
      status: total > 0 ? "balanced" : "empty",
      isSelected: dateStr === centerDate,
      isToday: dateStr === dayjs().format("YYYY-MM-DD"),
    });
  }

  return {
    weekLabel: `${startOfWeek.format("D")} – ${endOfWeek.format("D MMM YYYY")}`,
    days,
  };
}

// 3. Standalone Actions
export const setSelectedDate = (date: string) => {
  dailyBalanceStore.setState((s) => ({ ...s, selectedDate: date }));
};

export const updateField = <K extends keyof DailyBalanceFormData>(field: K, value: DailyBalanceFormData[K]) => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    formData: { ...s.formData, [field]: value },
  }));
};

export const setFormData = (data: DailyBalanceFormData) => {
  dailyBalanceStore.setState((s) => ({ ...s, formData: data }));
};

export const setOriginalData = (data: DailyBalanceFormData, id?: number) => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    originalData: data,
    formData: data,
    currentEntryId: id ?? null,
  }));
};

export const setWeekData = (data: WeekData) => {
  dailyBalanceStore.setState((s) => ({ ...s, weekData: data }));
};

export const setIsLoading = (loading: boolean) => {
  dailyBalanceStore.setState((s) => ({ ...s, isLoading: loading }));
};

export const setIsSaving = (saving: boolean) => {
  dailyBalanceStore.setState((s) => ({ ...s, isSaving: saving }));
};

export const markSaved = (newId?: number) => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    originalData: { ...s.formData },
    lastSaved: new Date(),
    currentEntryId: newId ?? s.currentEntryId,
  }));
};

export const resetForm = () => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    formData: { ...defaultFormData },
    originalData: { ...defaultFormData },
    currentEntryId: null,
    isDirty: false,
    summary: { ...calculateSummary(defaultFormData) }, // Initial summary logic if needed in store? No, store is clean.
  }));
};

// 4. Adapter Hook (Backward Compatibility)
export function useDailyBalanceStore() {
  const state = useStore(dailyBalanceStore);

  const summary = useMemo(() => calculateSummary(state.formData), [state.formData]);

  const status = useMemo(() => computeStatus(state.formData, summary), [state.formData, summary]);
  const isDirty = useMemo(
    () => JSON.stringify(state.formData) !== JSON.stringify(state.originalData),
    [state.formData, state.originalData]
  );

  return {
    ...state,
    summary,
    status,
    isDirty,
    // Actions
    setSelectedDate,
    updateField,
    setFormData,
    setOriginalData,
    setWeekData,
    setIsLoading,
    setIsSaving,
    markSaved,
    resetForm,
  };
}
