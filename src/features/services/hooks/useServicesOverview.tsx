import dayjs from "dayjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth } from "../../../context/auth-context";
import { logger } from "../../../lib/logger";
import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceSchedule,
  ServiceSummary,
} from "../types";
import {
  createService,
  fetchServiceDetail,
  fetchServices,
  regenerateServiceSchedules,
  registerServicePayment,
  unlinkServicePayment,
} from "../api";
import type { ServiceTemplate } from "../components/ServiceTemplateGallery";
import type { ServicesFilterState } from "../components/ServicesFilterPanel";

type SummaryTotals = {
  totalExpected: number;
  totalPaid: number;
  pendingCount: number;
  overdueCount: number;
  activeCount: number;
};

function useServicesController() {
  const { hasRole } = useAuth();
  const canManage = useMemo(() => hasRole("GOD", "ADMIN"), [hasRole]);
  const canView = useMemo(() => hasRole("GOD", "ADMIN", "ANALYST", "VIEWER"), [hasRole]);

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ServiceDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplate | null>(null);

  const [paymentSchedule, setPaymentSchedule] = useState<ServiceSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    transactionId: "",
    paidAmount: "",
    paidDate: dayjs().format("YYYY-MM-DD"),
    note: "",
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ServicesFilterState>({
    search: "",
    statuses: new Set(),
    types: new Set(),
  });

  const [allDetails, setAllDetails] = useState<Record<string, ServiceDetailResponse>>({});
  const [aggregatedLoading, setAggregatedLoading] = useState(false);
  const [aggregatedError, setAggregatedError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!canView) return;
    setLoadingList(true);
    setGlobalError(null);
    try {
      const response = await fetchServices();
      setServices(response.services);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la lista de servicios";
      setGlobalError(message);
      logger.error("[services] list:error", message);
    } finally {
      setLoadingList(false);
    }
  }, [canView]);

  const loadDetail = useCallback(async (publicId: string) => {
    setLoadingDetail(true);
    setGlobalError(null);
    try {
      const response = await fetchServiceDetail(publicId);
      setDetail(response);
      setAllDetails((prev) => ({ ...prev, [response.service.public_id]: response }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo obtener el detalle";
      setGlobalError(message);
      logger.error("[services] detail:error", message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Consolidated effect: load services list, then load all details with graceful degradation
  useEffect(() => {
    if (!canView) return;

    let cancelled = false;

    async function loadAll() {
      setLoadingList(true);
      setGlobalError(null);
      setAggregatedError(null);

      try {
        const response = await fetchServices();
        if (cancelled) return;

        setServices(response.services);

        if (response.services.length === 0) {
          setAllDetails({});
          selectedIdRef.current = null;
          setSelectedId(null);
          setDetail(null);
          return;
        }

        setAggregatedLoading(true);

        const detailResults = await Promise.allSettled(
          response.services.map((service) =>
            fetchServiceDetail(service.public_id).then((detailResponse) => ({
              id: service.public_id,
              detail: detailResponse,
            }))
          )
        );

        if (cancelled) return;

        const next: Record<string, ServiceDetailResponse> = {};
        const failures: Array<{ id: string; reason: unknown }> = [];

        detailResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[result.value.id] = result.value.detail;
            return;
          }

          const failedService = response.services[index];
          const serviceId = failedService?.public_id ?? `unknown-${index}`;
          failures.push({ id: serviceId, reason: result.reason });
          logger.error("[services] aggregated:error", {
            serviceId,
            error: result.reason,
          });
        });

        setAllDetails(next);

        if (failures.length) {
          setAggregatedError(
            failures.length === response.services.length
              ? "No se pudo cargar el detalle de los servicios. Intenta refrescar la vista."
              : `No se pudo cargar el detalle de ${failures.length} servicio(s).`
          );
        }

        const currentSelection = selectedIdRef.current;
        if (currentSelection) {
          const selectedDetail = next[currentSelection];
          if (selectedDetail) {
            setDetail(selectedDetail);
            return;
          }
        }

        const firstWithDetail = response.services.find((service) => next[service.public_id]);
        const fallbackService = firstWithDetail ?? response.services[0];

        if (fallbackService) {
          selectedIdRef.current = fallbackService.public_id;
          setSelectedId(fallbackService.public_id);
          const detailCandidate = next[fallbackService.public_id];
          if (detailCandidate) {
            setDetail(detailCandidate);
          } else if (!cancelled) {
            await loadDetail(fallbackService.public_id);
          }
        } else {
          selectedIdRef.current = null;
          setSelectedId(null);
          setDetail(null);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "No se pudo cargar la lista de servicios";
        setGlobalError(message);
        logger.error("[services] list:error", message);
      } finally {
        if (!cancelled) {
          setLoadingList(false);
          setAggregatedLoading(false);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [canView, loadDetail]);

  // Separate effect for selected detail (only runs when selection changes)
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    if (allDetails[selectedId]) {
      setDetail(allDetails[selectedId]);
    } else {
      loadDetail(selectedId).catch((error) => logger.error("[services] detail:effect", error));
    }
  }, [selectedId, allDetails, loadDetail]);

  const handleCreateService = useCallback(
    async (payload: CreateServicePayload) => {
      setCreateError(null);
      try {
        const response = await createService(payload);
        await loadServices();
        setAllDetails((prev) => ({ ...prev, [response.service.public_id]: response }));
        setSelectedId(response.service.public_id);
        setDetail(response);
        setCreateOpen(false);
        setSelectedTemplate(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo crear el servicio";
        setCreateError(message);
        logger.error("[services] create:error", message);
        throw error;
      }
    },
    [loadServices]
  );

  const handleRegenerate = useCallback(
    async (overrides: RegenerateServicePayload) => {
      if (!detail) return;
      setLoadingDetail(true);
      try {
        const response = await regenerateServiceSchedules(detail.service.public_id, overrides);
        setDetail(response);
        setAllDetails((prev) => ({ ...prev, [response.service.public_id]: response }));
        await loadServices();
      } finally {
        setLoadingDetail(false);
      }
    },
    [detail, loadServices]
  );

  const openPaymentModal = useCallback((schedule: ServiceSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      transactionId: schedule.transaction!.id ? String(schedule.transaction!.id) : "",
      paidAmount: schedule.paid_amount != null ? String(schedule.paid_amount) : String(schedule.effective_amount),
      paidDate: schedule.paid_date ?? dayjs().format("YYYY-MM-DD"),
      note: schedule.note ?? "",
    });
    setPaymentError(null);
  }, []);

  const handlePaymentFormChange = useCallback((key: keyof typeof paymentForm, value: string) => {
    setPaymentForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentSchedule(null);
  }, []);

  const handlePaymentSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!paymentSchedule) return;
      setProcessingPayment(true);
      setPaymentError(null);
      try {
        const transactionId = Number(paymentForm.transactionId);
        const paidAmount = Number(paymentForm.paidAmount);
        if (!Number.isFinite(transactionId) || transactionId <= 0) {
          throw new Error("Ingresa un ID de transacción válido");
        }
        if (!Number.isFinite(paidAmount) || paidAmount < 0) {
          throw new Error("Ingresa un monto válido");
        }
        const response = await registerServicePayment(paymentSchedule.id, {
          transactionId,
          paidAmount,
          paidDate: paymentForm.paidDate,
          note: paymentForm.note.trim() ? paymentForm.note.trim() : undefined,
        });
        if (detail) {
          const updatedDetail: ServiceDetailResponse = {
            ...detail,
            schedules: detail.schedules.map((schedule) =>
              schedule.id === response.schedule.id ? response.schedule : schedule
            ),
          };
          setDetail(updatedDetail);
          setAllDetails((prev) => ({ ...prev, [updatedDetail.service.public_id]: updatedDetail }));
        }
        await loadServices();
        setPaymentSchedule(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar el pago";
        setPaymentError(message);
        logger.error("[services] payment:error", message);
      } finally {
        setProcessingPayment(false);
      }
    },
    [detail, loadServices, paymentForm, paymentSchedule]
  );

  const handleUnlink = useCallback(
    async (schedule: ServiceSchedule) => {
      try {
        const response = await unlinkServicePayment(schedule.id);
        if (detail) {
          const updatedDetail: ServiceDetailResponse = {
            ...detail,
            schedules: detail.schedules.map((item) => (item.id === schedule.id ? response.schedule : item)),
          };
          setDetail(updatedDetail);
          setAllDetails((prev) => ({ ...prev, [updatedDetail.service.public_id]: updatedDetail }));
        }
        await loadServices();
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo desvincular la transacción";
        setGlobalError(message);
        logger.error("[services] unlink:error", message);
      }
    },
    [detail, loadServices]
  );

  const filteredServices = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesStatus = filters.statuses.size === 0 || filters.statuses.has(service.status);
      const matchesType = filters.types.size === 0 || filters.types.has(service.service_type);
      const matchesSearch =
        !searchTerm ||
        `${service.name} ${service.detail ?? ""} ${service.counterpart_name ?? ""}`.toLowerCase().includes(searchTerm);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [services, filters]);

  useEffect(() => {
    if (!filteredServices.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredServices.some((service) => service.public_id === selectedId)) {
      const firstService = filteredServices[0];
      if (firstService) setSelectedId(firstService.public_id);
    }
  }, [filteredServices]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryTotals: SummaryTotals = useMemo(() => {
    if (!filteredServices.length) {
      return {
        totalExpected: 0,
        totalPaid: 0,
        pendingCount: 0,
        overdueCount: 0,
        activeCount: 0,
      };
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
      {
        totalExpected: 0,
        totalPaid: 0,
        pendingCount: 0,
        overdueCount: 0,
        activeCount: 0,
      }
    );
  }, [filteredServices]);

  const collectionRate = summaryTotals.totalExpected > 0 ? summaryTotals.totalPaid / summaryTotals.totalExpected : 0;

  const unifiedAgendaItems = useMemo(
    () =>
      Object.values(allDetails).flatMap((item) =>
        item.schedules.map((schedule) => ({ service: item.service, schedule }))
      ),
    [allDetails]
  );

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
    setSelectedTemplate(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setCreateOpen(true);
    setCreateError(null);
  }, []);

  const applyTemplate = useCallback((template: ServiceTemplate) => {
    setSelectedTemplate(template);
    setCreateError(null);
    setCreateOpen(true);
  }, []);

  const handleFilterChange = useCallback((next: ServicesFilterState) => {
    setFilters({
      search: next.search,
      statuses: new Set(next.statuses),
      types: new Set(next.types),
    });
  }, []);

  const handleAgendaRegisterPayment = useCallback(
    async (serviceId: string, schedule: ServiceSchedule) => {
      setSelectedId(serviceId);
      selectedIdRef.current = serviceId;
      if (!allDetails[serviceId]) {
        await loadDetail(serviceId);
      } else {
        setDetail(allDetails[serviceId]);
      }
      openPaymentModal(schedule);
    },
    [allDetails, loadDetail, openPaymentModal]
  );

  const handleAgendaUnlinkPayment = useCallback(
    async (serviceId: string, schedule: ServiceSchedule) => {
      setSelectedId(serviceId);
      selectedIdRef.current = serviceId;
      if (!allDetails[serviceId]) {
        await loadDetail(serviceId);
      } else {
        setDetail(allDetails[serviceId]);
      }
      await handleUnlink(schedule);
    },
    [allDetails, loadDetail, handleUnlink]
  );

  const handlePaymentFieldChange = useCallback(
    (
      field: "transactionId" | "paidAmount" | "paidDate" | "note",
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      handlePaymentFormChange(field, event.target.value);
    },
    [handlePaymentFormChange]
  );
  return {
    canManage,
    services,
    filteredServices,
    summaryTotals,
    collectionRate,
    unifiedAgendaItems,
    globalError,
    loadingList,
    loadingDetail,
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
    processingPayment,
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
