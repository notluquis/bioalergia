import { Store } from "@tanstack/store";

export interface CalendarFilterState {
  calendarIds: string[];
  categories: string[];
  eventTypes: string[];
  from: string;
  maxDays: number;
  search: string;
  to: string;
}

const initialState: CalendarFilterState = {
  calendarIds: [],
  categories: [],
  eventTypes: [],
  from: "",
  maxDays: 31,
  search: "",
  to: "",
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
  calendarIds: state.calendarIds,
  categories: state.categories,
  eventTypes: state.eventTypes,
  from: state.from,
  maxDays: state.maxDays,
  search: state.search,
  to: state.to,
});
