import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { fetchTransactions } from "@/features/finance/api";
import type { Transaction } from "@/features/finance/types";
import { today } from "@/lib/dates";
import { logger } from "@/lib/logger";

import {
  createService,
  fetchServiceDetail,
  fetchServices,
  regenerateServiceSchedules,
  registerServicePayment,
  unlinkServicePayment,
} from "../api";
import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceListResponse,
  ServicePaymentPayload,
  ServiceSchedule,
  ServicesFilterState,
  ServiceSummary,
  ServiceTemplate,
  SummaryTotals,
} from "../types";

const EMPTY_SERVICES: ServiceSummary[] = [];

const CACHE_KEY_LIST = "services-list";
const CACHE_KEY_DETAILS = "services-details-all";

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

function useServicesController() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Service");
  const canView = can("read", "Service");

  // UI State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplate | null>(null);

  const [paymentSchedule, setPaymentSchedule] = useState<ServiceSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    transactionId: "",
    paidAmount: "",
    paidDate: today(),
    note: "",
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuggestionsRequestId, setPaymentSuggestionsRequestId] = useState(0);

  const [filters, setFilters] = useState<ServicesFilterState>({
    search: "",
    statuses: new Set(),
    types: new Set(),
  });

  // 1. Fetch List
  const {
    data: servicesData,
    isLoading: loadingList,
    error: listError,
  } = useQuery({
    queryKey: [CACHE_KEY_LIST],
    queryFn: fetchServices,
    enabled: canView,
  });

  const services = servicesData?.services ?? EMPTY_SERVICES;

  // Memoize service IDs for the query key to avoid frequent updates if services are unchanged
  const serviceIds = services.map((s) => s.public_id).join(",");

  // 2. Fetch All Details (Aggregated)
  // We keep this pattern because the original code relied on having all details for the "Unified Agenda"
  const {
    data: allDetailsData,
    isLoading: aggregatedLoading,
    error: aggregatedErrorObj,
  } = useQuery({
    queryKey: [CACHE_KEY_DETAILS, serviceIds, services.length],
    queryFn: async () => {
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

      // We only log/warn here as the UI will handle partial display
      if (failures.length > 0) {
        console.warn(`Failed to load details for ${failures.length} services`);
      }
      return detailsMap;
    },
    enabled: services.length > 0 && canView,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for details
  });

  const allDetails = allDetailsData ?? {};
  const aggregatedError = extractErrorMessage(aggregatedErrorObj);

  // Sync selectedIdRef
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Auto-select logic
  useEffect(() => {
    if (services.length === 0) {
      // If no services, clear selection
      if (selectedId) setSelectedId(null);
      return;
    }
    // If nothing selected, or selection not in list
    if ((!selectedId || !services.some((s) => s.public_id === selectedId)) && services.length > 0) {
      setSelectedId(services[0]?.public_id ?? null);
    }
  }, [services, selectedId]);

  const detail = selectedId && allDetails[selectedId] ? allDetails[selectedId] : null;

  // Mutations
  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: (response) => {
      queryClient.setQueryData([CACHE_KEY_LIST], (old: ServiceListResponse | undefined) => {
        if (!old) return { status: "ok", services: [response.service] };
        return { ...old, services: [...old.services, response.service] };
      });
      // Also update details cache
      queryClient.setQueryData(
        [CACHE_KEY_DETAILS, serviceIds + "," + response.service.public_id, services.length + 1],
        (old: Record<string, ServiceDetailResponse> | undefined) => {
          return { ...old, [response.service.public_id]: response };
        }
      );
      // Invalidate to be safe
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_LIST] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_DETAILS] });

      setSelectedId(response.service.public_id);
      setCreateOpen(false);
      setSelectedTemplate(null);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "No se pudo crear el servicio";
      setCreateError(message);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RegenerateServicePayload }) => {
      return regenerateServiceSchedules(id, payload);
    },
    onSuccess: (response) => {
      // Optimistic update local detail in cache if valid key exists
      queryClient.setQueryData(
        [CACHE_KEY_DETAILS, serviceIds, services.length],
        (old: Record<string, ServiceDetailResponse> | undefined) => {
          if (!old) return { [response.service.public_id]: response };
          return { ...old, [response.service.public_id]: response };
        }
      );
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_DETAILS] });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (payload: { scheduleId: number; body: ServicePaymentPayload }) => {
      return registerServicePayment(payload.scheduleId, payload.body);
    },
    onSuccess: (response) => {
      // We need to find which service this schedule belonged to, to update it.
      // It's likely the selected service (detail).
      if (!detail) {
        queryClient.invalidateQueries({ queryKey: [CACHE_KEY_DETAILS] });
        queryClient.invalidateQueries({ queryKey: [CACHE_KEY_LIST] });
        return;
      }

      const updatedDetail: ServiceDetailResponse = {
        ...detail,
        schedules: detail.schedules.map((s) => (s.id === response.schedule.id ? response.schedule : s)),
        service: {
          ...detail.service,
          // We might want to update totals here logically or just refetch
        },
      };

      // Optimistic update of the specific detail
      queryClient.setQueryData(
        [CACHE_KEY_DETAILS, serviceIds, services.length],
        (old: Record<string, ServiceDetailResponse> | undefined) => {
          if (!old) return old;
          return { ...old, [detail.service.public_id]: updatedDetail };
        }
      );

      // Always invalidate to get fresh totals/status from backend
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_LIST] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_DETAILS] });

      setPaymentSchedule(null);
    },
    onError: (err) => {
      setPaymentError(err instanceof Error ? err.message : "Error al registrar pago");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkServicePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_LIST] });
      queryClient.invalidateQueries({ queryKey: [CACHE_KEY_DETAILS] });
    },
  });

  // Handlers
  const handleCreateService = async (payload: CreateServicePayload) => {
    setCreateError(null);
    await createMutation.mutateAsync(payload);
  };

  const handleRegenerate = async (overrides: RegenerateServicePayload) => {
    if (!detail) return;
    await regenerateMutation.mutateAsync({ id: detail.service.public_id, payload: overrides });
  };

  // Payment Suggestions (Autocomplete)
  const {
    data: suggestedTransactions = [],
    isFetching: suggestedLoading,
    error: suggestedErrorObj,
  } = useQuery({
    queryKey: [
      "payment-suggestions",
      paymentSchedule?.id,
      paymentSuggestionsRequestId,
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
    enabled: !!paymentSchedule && paymentSuggestionsRequestId > 0,
  });

  const suggestedError = extractErrorMessage(suggestedErrorObj);

  const openPaymentModal = (schedule: ServiceSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      transactionId: schedule.transaction?.id ? String(schedule.transaction.id) : "",
      paidAmount: schedule.paid_amount == null ? String(schedule.effective_amount) : String(schedule.paid_amount),
      paidDate: schedule.paid_date ?? today(),
      note: schedule.note ?? "",
    });
    setPaymentError(null);
    setPaymentSuggestionsRequestId((prev) => prev + 1);
  };

  const closePaymentModal = () => {
    setPaymentSchedule(null);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSchedule) return;

    const transactionId = Number(paymentForm.transactionId);
    const paidAmount = Number(paymentForm.paidAmount);

    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      setPaymentError("ID de transacción inválido");
      return;
    }

    await paymentMutation.mutateAsync({
      scheduleId: paymentSchedule.id,
      body: {
        transactionId,
        paidAmount,
        paidDate: paymentForm.paidDate,
        note: paymentForm.note || undefined,
      },
    });
  };

  const handleUnlink = async (schedule: ServiceSchedule) => {
    await unlinkMutation.mutateAsync(schedule.id);
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

  // Other props
  const handlePaymentFieldChange = (key: keyof typeof paymentForm, value: string) => {
    setPaymentForm((prev) => ({ ...prev, [key]: value }));
  };

  const applySuggestedTransaction = (tx: Transaction) => {
    if (!tx.transactionAmount) return;
    setPaymentForm((prev) => ({
      ...prev,
      transactionId: String(tx.id),
      paidAmount: String(tx.transactionAmount),
      paidDate: tx.transactionDate ? dayjs(tx.transactionDate).format("YYYY-MM-DD") : prev.paidDate,
    }));
  };

  const applyTemplate = (template: ServiceTemplate) => {
    setSelectedTemplate(template);
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleFilterChange = (next: ServicesFilterState) => {
    setFilters({
      search: next.search,
      statuses: new Set(next.statuses),
      types: new Set(next.types),
    });
  };

  const openCreateModal = () => {
    setCreateOpen(true);
    setCreateError(null);
  };
  const closeCreateModal = () => {
    setCreateOpen(false);
    setSelectedTemplate(null);
  };

  const handleAgendaRegisterPayment = async (serviceId: string, schedule: ServiceSchedule) => {
    setSelectedId(serviceId);
    openPaymentModal(schedule);
  };

  const handleAgendaUnlinkPayment = async (serviceId: string, schedule: ServiceSchedule) => {
    setSelectedId(serviceId);
    await handleUnlink(schedule);
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
    loadingDetail: aggregatedLoading || regenerateMutation.isPending, // approximate
    aggregatedLoading,
    aggregatedError,
    selectedService: detail?.service ?? null,
    schedules: detail?.schedules ?? [],
    selectedId,
    setSelectedId,
    createOpen,
    createError,
    openCreateModal,
    closeCreateModal,
    selectedTemplate,
    setSelectedTemplate,
    paymentSchedule,
    paymentForm,
    handlePaymentFieldChange,
    paymentError,
    processingPayment: paymentMutation.isPending,
    suggestedTransactions,
    suggestedLoading,
    suggestedError,
    applySuggestedTransaction,
    filters,
    setFilters,
    handleCreateService,
    handleRegenerate,
    openPaymentModal,
    closePaymentModal,
    handlePaymentSubmit,
    handleUnlink,
    applyTemplate,
    handleFilterChange,
    handleAgendaRegisterPayment,
    handleAgendaUnlinkPayment,
  };
}

type ServicesContextValue = ReturnType<typeof useServicesController>;

const ServicesContext = createContext<ServicesContextValue | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const value = useServicesController();
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServicesOverview() {
  const ctx = useContext(ServicesContext);
  if (!ctx) {
    throw new Error("useServicesOverview debe usarse dentro de un ServicesProvider");
  }
  return ctx;
}
