import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import { type ReactNode, useEffect, useRef } from "react";

import { useAuth } from "@/context/AuthContext";
import { fetchTransactions } from "@/features/finance/api";
import type { Transaction } from "@/features/finance/types";
import { logger } from "@/lib/logger";

import {
  createService,
  fetchServiceDetail,
  regenerateServiceSchedules,
  registerServicePayment,
  unlinkServicePayment,
} from "../api";
import { serviceKeys, serviceQueries } from "../queries";
import { servicesActions, servicesStore } from "../store";
import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceListResponse,
  ServicePaymentPayload,
  ServiceSchedule,
  ServiceTemplate,
  SummaryTotals,
} from "../types";

const EMPTY_SERVICES: any[] = [];

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

// Deprecated Provider - kept for compatibility but does nothing now
export function ServicesProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useServicesOverview() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Service");
  const canView = can("read", "Service");

  // Global Store State
  const selectedId = useStore(servicesStore, (state) => state.selectedId);
  const filters = useStore(servicesStore, (state) => state.filters);
  const createOpen = useStore(servicesStore, (state) => state.createOpen);
  const selectedTemplate = useStore(servicesStore, (state) => state.selectedTemplate);
  const paymentSchedule = useStore(servicesStore, (state) => state.paymentSchedule);
  const paymentForm = useStore(servicesStore, (state) => state.paymentForm);

  // We actually need some local state for request IDs and transient errors not in store yet
  const selectedIdRef = useRef<string | null>(null);

  // 1. Fetch List
  const { data: servicesData, isLoading: loadingList, error: listError } = useQuery(serviceQueries.list(canView));

  const services = servicesData?.services ?? EMPTY_SERVICES;
  const serviceIds = services.map((s) => s.public_id).join(",");

  // 2. Fetch All Details (Aggregated)
  const {
    data: allDetailsData,
    isLoading: aggregatedLoading,
    error: aggregatedErrorObj,
  } = useQuery({
    queryKey: [...serviceKeys.detailsAggregated(serviceIds), services.length],
    queryFn: async () => {
      // ... same fn
      if (services.length === 0) return {};
      const results = await Promise.allSettled(services.map((service) => fetchServiceDetail(service.public_id)));

      const detailsMap: Record<string, ServiceDetailResponse> = {};
      const failures: Array<{ id: string; reason: unknown }> = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          detailsMap[result.value.service.public_id] = result.value;
        } else {
          const serviceId = services[index]?.public_id ?? "unknown";
          failures.push({ id: serviceId, reason: result.reason });
          logger.error("[services] aggregated:error", { serviceId, error: result.reason });
        }
      });

      if (failures.length > 0) {
        console.warn(`Failed to load details for ${failures.length} services`);
      }
      return detailsMap;
    },
    enabled: services.length > 0 && canView,
    staleTime: 5 * 60 * 1000,
  });

  const allDetails = allDetailsData ?? {};
  const aggregatedError = extractErrorMessage(aggregatedErrorObj);

  // Sync selectedIdRef
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const detail = selectedId && allDetails[selectedId] ? allDetails[selectedId] : null;

  // Mutations
  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: (response) => {
      queryClient.setQueryData(serviceKeys.lists(), (old: ServiceListResponse | undefined) => {
        if (!old) return { status: "ok", services: [response.service] };
        return { ...old, services: [...old.services, response.service] };
      });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.details() });

      servicesActions.setSelectedId(response.service.public_id);
      servicesActions.closeCreateModal();
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RegenerateServicePayload }) => {
      return regenerateServiceSchedules(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (payload: { scheduleId: number; body: ServicePaymentPayload }) => {
      return registerServicePayment(payload.scheduleId, payload.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
      servicesActions.closePaymentModal();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkServicePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
    },
  });

  // Handlers
  const handleCreateService = async (payload: CreateServicePayload) => {
    await createMutation.mutateAsync(payload);
  };

  const handleRegenerate = async (overrides: RegenerateServicePayload) => {
    if (!detail) return;
    await regenerateMutation.mutateAsync({ id: detail.service.public_id, payload: overrides });
  };

  // Filter Logic
  const filteredServices = (() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesStatus = filters.statuses.size === 0 || filters.statuses.has(service.status);
      const matchesType = filters.types.size === 0 || filters.types.has(service.service_type);
      const matchesSearch =
        !searchTerm ||
        `${service.name ?? ""} ${service.detail ?? ""} ${service.counterpart_name ?? ""}`
          .toLowerCase()
          .includes(searchTerm);
      return matchesStatus && matchesType && matchesSearch;
    });
  })();

  // Summaries
  const summaryTotals: SummaryTotals = (() => {
    if (filteredServices.length === 0) {
      return { totalExpected: 0, totalPaid: 0, pendingCount: 0, overdueCount: 0, activeCount: 0 };
    }
    return filteredServices.reduce(
      (acc, service) => {
        acc.totalExpected += service.total_expected;
        acc.totalPaid += service.total_paid;
        acc.pendingCount += service.pending_count;
        acc.overdueCount += service.overdue_count;
        if (service.status === "ACTIVE") acc.activeCount += 1;
        return acc;
      },
      { totalExpected: 0, totalPaid: 0, pendingCount: 0, overdueCount: 0, activeCount: 0 }
    );
  })();

  const collectionRate = summaryTotals.totalExpected > 0 ? summaryTotals.totalPaid / summaryTotals.totalExpected : 0;

  const unifiedAgendaItems = Object.values(allDetails).flatMap((item) =>
    item.schedules.map((schedule) => ({ service: item.service, schedule }))
  );

  // Payment Suggestions (Restored)
  const { data: suggestedTransactions = [], isFetching: suggestedLoading } = useQuery({
    queryKey: [
      "payment-suggestions",
      paymentSchedule?.id,
      paymentSchedule?.expected_amount,
      paymentSchedule?.due_date,
      paymentSchedule,
    ],
    queryFn: async () => {
      if (!paymentSchedule) return [];
      const tolerance = Math.max(100, Math.round(paymentSchedule.expected_amount * 0.01));
      const dueDate = paymentSchedule.due_date ? dayjs(paymentSchedule.due_date) : dayjs();
      const from = dueDate.clone().subtract(45, "day").format("YYYY-MM-DD");
      const to = dueDate.clone().add(45, "day").format("YYYY-MM-DD");

      const payload = await fetchTransactions({
        filters: {
          from,
          to,
          description: "",
          origin: "",
          destination: "",
          sourceId: "",
          bankAccountNumber: "",
          direction: "OUT",
          includeAmounts: true,
          externalReference: "",
          transactionType: "",
          status: "",
        },
        page: 1,
        pageSize: 50,
      });

      return payload.data
        .filter(
          (tx) =>
            typeof tx.transactionAmount === "number" &&
            Math.abs((tx.transactionAmount ?? 0) - paymentSchedule.expected_amount) <= tolerance
        )
        .slice(0, 8);
    },
    enabled: !!paymentSchedule,
  });

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSchedule) return;
    const transactionId = Number(paymentForm.transactionId);
    if (!Number.isFinite(transactionId) || transactionId <= 0) return;

    await paymentMutation.mutateAsync({
      scheduleId: paymentSchedule.id,
      body: {
        transactionId,
        paidAmount: Number(paymentForm.paidAmount),
        paidDate: paymentForm.paidDate,
        note: paymentForm.note || undefined,
      },
    });
  };

  return {
    canManage,
    services,
    filteredServices,
    summaryTotals,
    collectionRate,
    unifiedAgendaItems,
    globalError: extractErrorMessage(listError),
    loadingList,
    loadingDetail: aggregatedLoading || regenerateMutation.isPending,
    aggregatedLoading,
    aggregatedError,
    selectedService: detail?.service ?? null,
    schedules: detail?.schedules ?? [],

    // Store State Mapped
    selectedId,
    setSelectedId: servicesActions.setSelectedId,
    createOpen,
    createError: createMutation.error ? extractErrorMessage(createMutation.error) : null,
    openCreateModal: servicesActions.openCreateModal,
    closeCreateModal: servicesActions.closeCreateModal,
    selectedTemplate,
    setSelectedTemplate: (t: ServiceTemplate | null) => servicesStore.setState((s) => ({ ...s, selectedTemplate: t })),

    paymentSchedule,
    paymentForm,
    handlePaymentFieldChange: (key: any, value: any) => servicesActions.updatePaymentForm({ [key]: value }),
    paymentError: paymentMutation.error ? extractErrorMessage(paymentMutation.error) : null,
    processingPayment: paymentMutation.isPending,

    suggestedTransactions,
    suggestedLoading,
    suggestedError: null,
    applySuggestedTransaction: (tx: Transaction) => {
      if (!tx.transactionAmount) return;
      servicesActions.updatePaymentForm({
        transactionId: String(tx.id),
        paidAmount: String(tx.transactionAmount),
        paidDate: tx.transactionDate ? dayjs(tx.transactionDate).format("YYYY-MM-DD") : paymentForm.paidDate,
      });
    },

    filters,
    setFilters: servicesActions.setFilters,

    handleCreateService,
    handleRegenerate,
    openPaymentModal: servicesActions.openPaymentModal,
    closePaymentModal: servicesActions.closePaymentModal,
    handlePaymentSubmit,
    handleUnlink: async (schedule: ServiceSchedule) => {
      await unlinkMutation.mutateAsync(schedule.id);
    },
    applyTemplate: servicesActions.openCreateModal,
    handleFilterChange: (next: any) => servicesActions.setFilters(next),
    handleAgendaRegisterPayment: (id: string, s: ServiceSchedule) => {
      servicesActions.setSelectedId(id);
      servicesActions.openPaymentModal(s);
    },
    handleAgendaUnlinkPayment: async (id: string, s: ServiceSchedule) => {
      servicesActions.setSelectedId(id);
      await unlinkMutation.mutateAsync(s.id);
    },
  };
}
