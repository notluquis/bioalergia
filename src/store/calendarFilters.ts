import { create } from "zustand";

export type CalendarFilterState = {
  from: string;
  to: string;
  calendarIds: string[];
  eventTypes: string[];
  categories: string[];
  search: string;
  maxDays: number;
};

const initialState: CalendarFilterState = {
  from: "",
  to: "",
  calendarIds: [],
  eventTypes: [],
  categories: [],
  search: "",
  maxDays: 31,
};

type CalendarFilterActions = {
  setFilters: (partial: Partial<CalendarFilterState>) => void;
  resetFilters: () => void;
};

export const useCalendarFilterStore = create<CalendarFilterState & CalendarFilterActions>((set) => ({
  ...initialState,
  setFilters: (partial) => set((state) => ({ ...state, ...partial })),
  resetFilters: () => set({ ...initialState }),
}));

export const selectCalendarFilters = (state: CalendarFilterState) => state;

export const selectCalendarFiltersForQuery = (state: CalendarFilterState) => ({
  from: state.from,
  to: state.to,
  calendarIds: state.calendarIds,
  eventTypes: state.eventTypes,
  categories: state.categories,
  search: state.search,
  maxDays: state.maxDays,
});
