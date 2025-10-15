import dayjs from "dayjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import CollapsibleSection from "../../components/CollapsibleSection";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/auth-context";
import { logger } from "../../lib/logger";
import ServiceDetail from "../../features/services/components/ServiceDetail";
import ServiceForm from "../../features/services/components/ServiceForm";
import ServiceList from "../../features/services/components/ServiceList";
import ServicesFilterPanel, {
  type ServicesFilterState,
} from "../../features/services/components/ServicesFilterPanel";
import ServiceTemplateGallery, {
  type ServiceTemplate,
} from "../../features/services/components/ServiceTemplateGallery";
import ServicesUnifiedAgenda from "../../features/services/components/ServicesUnifiedAgenda";
import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceDetailResponse,
  ServiceSchedule,
  ServiceSummary,
} from "../../features/services/types";
import {
  createService,
  fetchServiceDetail,
  fetchServices,
  regenerateServiceSchedules,
  registerServicePayment,
  unlinkServicePayment,
} from "../../features/services/api";

const formatCurrency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const formatNumber = new Intl.NumberFormat("es-CL");

export default function ServicesOverviewContent() {
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

  useEffect(() => {
    loadServices().catch((error) => logger.error("[services] list:effect", error));
  }, [loadServices]);

  useEffect(() => {
    if (!services.length) {
      setAllDetails({});
      return;
    }
    let cancelled = false;
    setAggregatedLoading(true);
    setAggregatedError(null);
    Promise.all(
      services.map((service) =>
        fetchServiceDetail(service.public_id)
          .then((detailResponse) => ({ id: service.public_id, detail: detailResponse }))
          .catch((error) => {
            logger.error("[services] aggregated:error", error);
            throw error;
          })
      )
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, ServiceDetailResponse> = {};
        results.forEach(({ id, detail: detailResponse }) => {
          next[id] = detailResponse;
        });
        setAllDetails(next);
        if (!selectedIdRef.current && results.length) {
          selectedIdRef.current = results[0].id;
          setSelectedId(results[0].id);
          setDetail(results[0].detail);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "No se pudo cargar el detalle global";
        setAggregatedError(message);
      })
      .finally(() => {
        if (!cancelled) setAggregatedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [services]);

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

  const handleCreateService = async (payload: CreateServicePayload) => {
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
  };

  const handleRegenerate = async (overrides: RegenerateServicePayload) => {
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
  };

  const openPaymentModal = (schedule: ServiceSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      transactionId: schedule.transaction_id ? String(schedule.transaction_id) : "",
      paidAmount: schedule.paid_amount != null ? String(schedule.paid_amount) : String(schedule.effective_amount),
      paidDate: schedule.paid_date ?? dayjs().format("YYYY-MM-DD"),
      note: schedule.note ?? "",
    });
    setPaymentError(null);
  };

  const handlePaymentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
  };

  const handleUnlink = async (schedule: ServiceSchedule) => {
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
  };

  const filteredServices = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesStatus = filters.statuses.size === 0 || filters.statuses.has(service.status);
      const matchesType = filters.types.size === 0 || filters.types.has(service.service_type);
      const matchesSearch =
        !searchTerm ||
        `${service.name} ${service.detail ?? ""} ${service.counterpart_name ?? ""}`
          .toLowerCase()
          .includes(searchTerm);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [services, filters]);

  useEffect(() => {
    if (!filteredServices.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredServices.some((service) => service.public_id === selectedId)) {
      setSelectedId(filteredServices[0].public_id);
    }
  }, [filteredServices, selectedId]);

  const summaryTotals = useMemo(() => {
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

  const collectionRate =
    summaryTotals.totalExpected > 0 ? summaryTotals.totalPaid / summaryTotals.totalExpected : 0;

  const unifiedAgendaItems = useMemo(
    () =>
      Object.values(allDetails).flatMap((item) =>
        item.schedules.map((schedule) => ({ service: item.service, schedule }))
      ),
    [allDetails]
  );

  const handleApplyTemplate = (template: ServiceTemplate) => {
    setSelectedTemplate(template);
    setCreateOpen(true);
    setCreateError(null);
  };

  const handleFilterChange = (next: ServicesFilterState) => {
    setFilters({
      search: next.search,
      statuses: new Set(next.statuses),
      types: new Set(next.types),
    });
  };

  const handleAgendaRegisterPayment = async (serviceId: string, schedule: ServiceSchedule) => {
    setSelectedId(serviceId);
    if (!allDetails[serviceId]) {
      await loadDetail(serviceId);
    } else {
      setDetail(allDetails[serviceId]);
    }
    openPaymentModal(schedule);
  };

  const handleAgendaUnlinkPayment = async (serviceId: string, schedule: ServiceSchedule) => {
    setSelectedId(serviceId);
    if (!allDetails[serviceId]) {
      await loadDetail(serviceId);
    } else {
      setDetail(allDetails[serviceId]);
    }
    await handleUnlink(schedule);
  };

  if (!canView) {
    return <Alert variant="error">No tienes permisos para ver los servicios registrados.</Alert>;
  }

  const selectedService = detail?.service ?? null;
  const schedules = detail?.schedules ?? [];

  return (
    <section className="flex flex-col gap-6">
      {globalError && <Alert variant="error">{globalError}</Alert>}

      <CollapsibleSection title="Resumen general" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Servicios activos"
            value={`${formatNumber.format(summaryTotals.activeCount)} / ${formatNumber.format(filteredServices.length)}`}
            helper={`Vista filtrada: ${filteredServices.length} de ${services.length}`}
          />
          <MetricCard
            title="Monto esperado"
            value={formatCurrency.format(summaryTotals.totalExpected)}
            helper="Periodo actual"
          />
          <MetricCard
            title="Pagos conciliados"
            value={formatCurrency.format(summaryTotals.totalPaid)}
            helper={`Cobertura ${collectionRate ? `${Math.round(collectionRate * 100)}%` : "0%"}`}
          />
          <MetricCard
            title="Pendientes / vencidos"
            value={`${formatNumber.format(summaryTotals.pendingCount)} / ${formatNumber.format(summaryTotals.overdueCount)}`}
            helper="Cuotas con seguimiento"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Filtros" defaultOpen={false}>
        <ServicesFilterPanel services={services} filters={filters} onChange={handleFilterChange} />
      </CollapsibleSection>

      <CollapsibleSection title="Plantillas" defaultOpen={false}>
        <ServiceTemplateGallery onApply={handleApplyTemplate} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Servicios registrados"
        defaultOpen={false}
        description="Selecciona un servicio para ver su cronograma y acciones disponibles"
      >
        {loadingList && <p className="text-xs text-slate-400">Actualizando listado de servicios...</p>}
        <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <div className="h-full">
            <ServiceList
              services={filteredServices}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreateRequest={() => {
                setCreateOpen(true);
                setCreateError(null);
              }}
              canManage={canManage}
            />
          </div>
          <div className="h-full">
            <ServiceDetail
              service={selectedService}
              schedules={schedules}
              loading={loadingDetail}
              canManage={canManage}
              onRegenerate={handleRegenerate}
              onRegisterPayment={openPaymentModal}
              onUnlinkPayment={handleUnlink}
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Agenda unificada"
        defaultOpen={false}
        description="Pagos programados consolidados por día"
      >
        <ServicesUnifiedAgenda
          items={unifiedAgendaItems}
          loading={aggregatedLoading}
          error={aggregatedError}
          canManage={canManage}
          onRegisterPayment={handleAgendaRegisterPayment}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
      </CollapsibleSection>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo servicio">
        <ServiceForm
          onSubmit={async (payload) => {
            await handleCreateService(payload);
          }}
          onCancel={() => {
            setCreateOpen(false);
            setSelectedTemplate(null);
          }}
          initialValues={selectedTemplate?.payload}
          submitLabel="Crear servicio"
        />
        {createError && <p className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{createError}</p>}
      </Modal>

      <Modal
        isOpen={Boolean(paymentSchedule)}
        onClose={() => setPaymentSchedule(null)}
        title={
          paymentSchedule
            ? `Registrar pago ${dayjs(paymentSchedule.period_start).format("MMM YYYY")}`
            : "Registrar pago"
        }
      >
        {paymentSchedule && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <Input
              label="ID transacción"
              type="number"
              value={paymentForm.transactionId}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPaymentForm((prev) => ({ ...prev, transactionId: event.target.value }))
              }
              required
            />
            <Input
              label="Monto pagado"
              type="number"
              value={paymentForm.paidAmount}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPaymentForm((prev) => ({ ...prev, paidAmount: event.target.value }))
              }
              min={0}
              step="0.01"
              required
            />
            <Input
              label="Fecha de pago"
              type="date"
              value={paymentForm.paidDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPaymentForm((prev) => ({ ...prev, paidDate: event.target.value }))
              }
              required
            />
            <Input
              label="Nota"
              type="textarea"
              rows={2}
              value={paymentForm.note}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setPaymentForm((prev) => ({ ...prev, note: event.target.value }))
              }
            />
            {paymentError && <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{paymentError}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPaymentSchedule(null)} disabled={processingPayment}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processingPayment}>
                {processingPayment ? "Registrando..." : "Registrar pago"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  helper?: string;
};

function MetricCard({ title, value, helper }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-white/45 bg-white/70 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </article>
  );
}
