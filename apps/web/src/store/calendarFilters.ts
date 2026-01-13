import { Store } from "@tanstack/store";

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

export const calendarFilterStore = new Store<CalendarFilterState>(initialState);

export const updateFilters = (partial: Partial<CalendarFilterState>) => {
  calendarFilterStore.setState((state) => ({ ...state, ...partial }));
};

export const resetFilters = () => {
  calendarFilterStore.setState((state) => ({ ...state, ...initialState }));
};

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
