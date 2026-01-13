import { Store } from "@tanstack/store";

import { today } from "@/lib/dates";

import type { ServiceSchedule, ServicesFilterState, ServiceTemplate } from "./types";

interface ServicesState {
  // Selection
  selectedId: string | null;

  // Filters
  filters: ServicesFilterState;

  // Create Modal
  createOpen: boolean;
  selectedTemplate: ServiceTemplate | null;

  // Payment Modal
  paymentSchedule: ServiceSchedule | null;
  paymentForm: {
    transactionId: string;
    paidAmount: string;
    paidDate: string;
    note: string;
  };
}

export const initialServicesState: ServicesState = {
  selectedId: null,
  filters: {
    search: "",
    statuses: new Set(),
    types: new Set(),
  },
  createOpen: false,
  selectedTemplate: null,
  paymentSchedule: null,
  paymentForm: {
    transactionId: "",
    paidAmount: "",
    paidDate: today(),
    note: "",
  },
};

export const servicesStore = new Store<ServicesState>(initialServicesState);

// Actions
export const servicesActions = {
  setSelectedId: (id: string | null) => {
    servicesStore.setState((state) => ({ ...state, selectedId: id }));
  },

  setFilters: (filters: Partial<ServicesFilterState>) => {
    servicesStore.setState((state) => ({
      ...state,
      filters: { ...state.filters, ...filters },
    }));
  },

  resetFilters: () => {
    servicesStore.setState((state) => ({
      ...state,
      filters: initialServicesState.filters,
    }));
  },

  openCreateModal: (template: ServiceTemplate | null = null) => {
    servicesStore.setState((state) => ({
      ...state,
      createOpen: true,
      selectedTemplate: template,
    }));
  },

  closeCreateModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      createOpen: false,
      selectedTemplate: null,
    }));
  },

  openPaymentModal: (schedule: ServiceSchedule) => {
    servicesStore.setState((state) => ({
      ...state,
      paymentSchedule: schedule,
      paymentForm: {
        transactionId: schedule.transaction?.id ? String(schedule.transaction.id) : "",
        paidAmount: schedule.paid_amount == null ? String(schedule.effective_amount) : String(schedule.paid_amount),
        paidDate: schedule.paid_date ?? today(),
        note: schedule.note ?? "",
      },
    }));
  },

  closePaymentModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      paymentSchedule: null,
      paymentForm: initialServicesState.paymentForm,
    }));
  },

  updatePaymentForm: (updates: Partial<ServicesState["paymentForm"]>) => {
    servicesStore.setState((state) => ({
      ...state,
      paymentForm: { ...state.paymentForm, ...updates },
    }));
  },
};
