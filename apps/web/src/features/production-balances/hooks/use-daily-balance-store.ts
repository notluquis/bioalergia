import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import dayjs from "dayjs";
import { useMemo } from "react";

import type { BalanceSummary, DailyBalanceFormData, DayCell, DayStatus, WeekData } from "../types";

import { calculateSummary, getDayAbbrev } from "../utils";

// Default empty form values
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
  // Current Entry ID (if exists in DB)
  currentEntryId: null | number;

  // Form data for current day
  formData: DailyBalanceFormData;

  // State flags
  isLoading: boolean;

  isSaving: boolean;

  lastSaved: Date | null;

  // Original data (to detect changes)
  originalData: DailyBalanceFormData;
  // Current selected date
  selectedDate: string;
  // Week data for navigation
  weekData: null | WeekData;
}

// 1. Base Store
export const dailyBalanceStore = new Store<DailyBalanceState>({
  currentEntryId: null,
  formData: { ...defaultFormData },
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  originalData: { ...defaultFormData },
  selectedDate: dayjs().format("YYYY-MM-DD"),
  weekData: null,
});

import "dayjs/locale/es";

// Set locale globally to ensure weeks start on Monday
dayjs.locale("es");

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
      isSelected: dateStr === centerDate,
      isToday: dateStr === dayjs().format("YYYY-MM-DD"),
      status: total > 0 ? "balanced" : "empty",
      total,
    });
  }

  return {
    days,
    weekLabel: `${startOfWeek.format("D")} – ${endOfWeek.format("D MMM YYYY")}`,
  };
}

// 2. Helper Logic
function computeStatus(data: DailyBalanceFormData, summary: BalanceSummary): DayStatus {
  const hasData = data.tarjeta > 0 || data.transferencia > 0 || data.efectivo > 0;
  if (!hasData) return "empty";
  if (summary.cuadra) return "balanced";
  return "unbalanced";
}

// 3. Standalone Actions
export const setSelectedDate = (date: string) => {
  dailyBalanceStore.setState((s) => ({ ...s, selectedDate: date }));
};

export const updateField = <K extends keyof DailyBalanceFormData>(
  field: K,
  value: DailyBalanceFormData[K],
) => {
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
    currentEntryId: id ?? null,
    formData: data,
    originalData: data,
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
    currentEntryId: newId ?? s.currentEntryId,
    lastSaved: new Date(),
    originalData: { ...s.formData },
  }));
};

export const resetForm = () => {
  dailyBalanceStore.setState((s) => ({
    ...s,
    currentEntryId: null,
    formData: { ...defaultFormData },
    isDirty: false,
    originalData: { ...defaultFormData },
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
    [state.formData, state.originalData],
  );

  return {
    ...state,
    isDirty,
    markSaved,
    resetForm,
    setFormData,
    setIsLoading,
    setIsSaving,
    setOriginalData,
    // Actions
    setSelectedDate,
    setWeekData,
    status,
    summary,
    updateField,
  };
}
