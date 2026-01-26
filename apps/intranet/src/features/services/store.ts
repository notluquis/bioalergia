import { Store } from "@tanstack/store";

import { today } from "@/lib/dates";

import type { ServiceSchedule, ServicesFilterState, ServiceTemplate } from "./types";

interface ServicesState {
  // Create Modal
  createOpen: boolean;

  // Filters
  filters: ServicesFilterState;

  paymentForm: {
    note: string;
    paidAmount: string;
    paidDate: string;
    transactionId: string;
  };
  // Payment Modal
  paymentSchedule: null | ServiceSchedule;

  // Selection
  selectedId: null | string;
  selectedTemplate: null | ServiceTemplate;
}

export const initialServicesState: ServicesState = {
  createOpen: false,
  filters: {
    search: "",
    statuses: new Set(),
    types: new Set(),
  },
  paymentForm: {
    note: "",
    paidAmount: "",
    paidDate: today(),
    transactionId: "",
  },
  paymentSchedule: null,
  selectedId: null,
  selectedTemplate: null,
};

export const servicesStore = new Store<ServicesState>(initialServicesState);

// Actions
export const servicesActions = {
  closeCreateModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      createOpen: false,
      selectedTemplate: null,
    }));
  },

  closePaymentModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      paymentForm: initialServicesState.paymentForm,
      paymentSchedule: null,
    }));
  },

  openCreateModal: (template: null | ServiceTemplate = null) => {
    servicesStore.setState((state) => ({
      ...state,
      createOpen: true,
      selectedTemplate: template,
    }));
  },

  openPaymentModal: (schedule: ServiceSchedule) => {
    servicesStore.setState((state) => ({
      ...state,
      paymentForm: {
        note: schedule.note ?? "",
        paidAmount:
          schedule.paid_amount == null
            ? String(schedule.effective_amount)
            : String(schedule.paid_amount),
        paidDate: schedule.paid_date ?? today(),
        transactionId: schedule.transaction?.id ? String(schedule.transaction.id) : "",
      },
      paymentSchedule: schedule,
    }));
  },

  resetFilters: () => {
    servicesStore.setState((state) => ({
      ...state,
      filters: initialServicesState.filters,
    }));
  },

  setFilters: (filters: Partial<ServicesFilterState>) => {
    servicesStore.setState((state) => ({
      ...state,
      filters: { ...state.filters, ...filters },
    }));
  },

  setSelectedId: (id: null | string) => {
    servicesStore.setState((state) => ({ ...state, selectedId: id }));
  },

  updatePaymentForm: (updates: Partial<ServicesState["paymentForm"]>) => {
    servicesStore.setState((state) => ({
      ...state,
      paymentForm: { ...state.paymentForm, ...updates },
    }));
  },
};
