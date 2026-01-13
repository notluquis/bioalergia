import dayjs from "dayjs";
import { create } from "zustand";

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

interface DailyBalanceState {
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
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;

  // Computed values
  summary: BalanceSummary;
  status: DayStatus;

  // Actions
  setSelectedDate: (date: string) => void;
  updateField: <K extends keyof DailyBalanceFormData>(field: K, value: DailyBalanceFormData[K]) => void;
  setFormData: (data: DailyBalanceFormData) => void;
  setOriginalData: (data: DailyBalanceFormData, id?: number) => void;
  setWeekData: (data: WeekData) => void;
  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  markSaved: (newId?: number) => void;
  resetForm: () => void;
}

export const useDailyBalanceStore = create<DailyBalanceState>((set, get) => ({
  // Initial state
  selectedDate: dayjs().format("YYYY-MM-DD"),
  currentEntryId: null,
  formData: { ...defaultFormData },
  originalData: { ...defaultFormData },
  weekData: null,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  summary: {
    totalMetodos: 0,
    totalServicios: 0,
    gastos: 0,
    diferencia: 0,
    cuadra: true,
  },
  status: "empty",

  // Actions
  setSelectedDate: (date) => set({ selectedDate: date }),

  updateField: (field, value) => {
    const currentData = get().formData;
    const newData = { ...currentData, [field]: value };
    const originalData = get().originalData;
    const isDirty = JSON.stringify(newData) !== JSON.stringify(originalData);
    const summary = calculateSummary(newData);
    const status = computeStatus(newData, summary);

    set({
      formData: newData,
      isDirty,
      summary,
      status,
    });
  },

  setFormData: (data) => {
    const summary = calculateSummary(data);
    const status = computeStatus(data, summary);
    set({
      formData: data,
      summary,
      status,
    });
  },

  setOriginalData: (data, id) => {
    const summary = calculateSummary(data);
    const status = computeStatus(data, summary);
    set({
      originalData: data,
      formData: data,
      currentEntryId: id ?? null,
      isDirty: false,
      summary,
      status,
    });
  },

  setWeekData: (data) => set({ weekData: data }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setIsSaving: (saving) => set({ isSaving: saving }),

  markSaved: (newId) => {
    const currentData = get().formData;
    set((state) => ({
      originalData: { ...currentData },
      isDirty: false,
      lastSaved: new Date(),
      currentEntryId: newId ?? state.currentEntryId,
    }));
  },

  resetForm: () =>
    set({
      formData: { ...defaultFormData },
      originalData: { ...defaultFormData },
      currentEntryId: null,
      isDirty: false,
      summary: {
        totalMetodos: 0,
        totalServicios: 0,
        gastos: 0,
        diferencia: 0,
        cuadra: true,
      },
      status: "empty",
    }),
}));

// Helper to compute status
function computeStatus(data: DailyBalanceFormData, summary: BalanceSummary): DayStatus {
  const hasData = data.tarjeta > 0 || data.transferencia > 0 || data.efectivo > 0;

  if (!hasData) return "empty";
  if (summary.cuadra) return "balanced";
  return "unbalanced";
}

// Helper to generate week data from a date
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
