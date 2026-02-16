import { Store } from "@tanstack/store";
import dayjs from "dayjs";

import type { ServiceSchedule, ServicesFilterState, ServiceTemplate } from "./types";

interface ServicesState {
  // Create Modal
  createOpen: boolean;

  // Edit Schedule Modal
  editScheduleOpen: boolean;
  editScheduleTarget: null | ServiceSchedule;

  // Filters
  filters: ServicesFilterState;

  paymentForm: {
    note: string;
    paidAmount: string;
    paidDate: Date;
    transactionId: string;
  };
  // Payment Modal
  paymentSchedule: null | ServiceSchedule;

  // Selection
  selectedId: null | string;
  selectedTemplate: null | ServiceTemplate;

  // Skip Schedule Modal
  skipScheduleOpen: boolean;
  skipScheduleTarget: null | ServiceSchedule;
}

export const initialServicesState: ServicesState = {
  createOpen: false,
  editScheduleOpen: false,
  editScheduleTarget: null,
  filters: {
    search: "",
    statuses: new Set(),
    types: new Set(),
  },
  paymentForm: {
    note: "",
    paidAmount: "",
    paidDate: dayjs().toDate(),
    transactionId: "",
  },
  paymentSchedule: null,
  selectedId: null,
  selectedTemplate: null,
  skipScheduleOpen: false,
  skipScheduleTarget: null,
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

  closeEditScheduleModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      editScheduleOpen: false,
      editScheduleTarget: null,
    }));
  },

  closePaymentModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      paymentForm: initialServicesState.paymentForm,
      paymentSchedule: null,
    }));
  },

  closeSkipScheduleModal: () => {
    servicesStore.setState((state) => ({
      ...state,
      skipScheduleOpen: false,
      skipScheduleTarget: null,
    }));
  },

  openCreateModal: (template: null | ServiceTemplate = null) => {
    servicesStore.setState((state) => ({
      ...state,
      createOpen: true,
      selectedTemplate: template,
    }));
  },

  openEditScheduleModal: (schedule: ServiceSchedule) => {
    servicesStore.setState((state) => ({
      ...state,
      editScheduleOpen: true,
      editScheduleTarget: schedule,
    }));
  },

  openPaymentModal: (schedule: ServiceSchedule) => {
    servicesStore.setState((state) => ({
      ...state,
      paymentForm: {
        note: schedule.note ?? "",
        paidAmount:
          schedule.paidAmount == null
            ? String(schedule.effectiveAmount)
            : String(schedule.paidAmount),
        paidDate: schedule.paidDate ?? dayjs().toDate(),
        transactionId: schedule.transaction?.id ? String(schedule.transaction.id) : "",
      },
      paymentSchedule: schedule,
    }));
  },

  openSkipScheduleModal: (schedule: ServiceSchedule) => {
    servicesStore.setState((state) => ({
      ...state,
      skipScheduleOpen: true,
      skipScheduleTarget: schedule,
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
