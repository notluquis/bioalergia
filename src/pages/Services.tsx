import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/auth-context";
import { logger } from "../lib/logger";
import Alert from "../components/Alert";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Button from "../components/Button";
import ServiceList from "../features/services/components/ServiceList";
import ServiceDetail from "../features/services/components/ServiceDetail";
import ServiceForm from "../features/services/components/ServiceForm";
import {
  createService,
  fetchServiceDetail,
  fetchServices,
  registerServicePayment,
  regenerateServiceSchedules,
  unlinkServicePayment,
} from "../features/services/api";
import type {
  CreateServicePayload,
  ServiceDetailResponse,
  ServiceSchedule,
  ServiceSummary,
  RegenerateServicePayload,
} from "../features/services/types";

export default function ServicesPage() {
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

  const [paymentSchedule, setPaymentSchedule] = useState<ServiceSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    transactionId: "",
    paidAmount: "",
    paidDate: dayjs().format("YYYY-MM-DD"),
    note: "",
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!canView) return;
    setLoadingList(true);
    setGlobalError(null);
    try {
      const response = await fetchServices();
      setServices(response.services);
      if (!selectedId && response.services.length) {
        setSelectedId(response.services[0].public_id);
      } else if (selectedId) {
        const exists = response.services.some((service) => service.public_id === selectedId);
        if (!exists && response.services.length) {
          setSelectedId(response.services[0].public_id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la lista de servicios";
      setGlobalError(message);
      logger.error("[services] list:error", message);
    } finally {
      setLoadingList(false);
    }
  }, [canView, selectedId]);

  const loadDetail = useCallback(async (publicId: string) => {
    setLoadingDetail(true);
    setGlobalError(null);
    try {
      const response = await fetchServiceDetail(publicId);
      setDetail(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo obtener el detalle";
      setGlobalError(message);
      logger.error("[services] detail:error", message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadServices().catch((error) => logger.error("[services] list:effect", error));
  }, [loadServices]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId).catch((error) => logger.error("[services] detail:effect", error));
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const handleCreateService = async (payload: CreateServicePayload) => {
    setCreateError(null);
    try {
      const response = await createService(payload);
      await loadServices();
      setSelectedId(response.service.public_id);
      setDetail(response);
      setCreateOpen(false);
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
        setDetail({
          ...detail,
          schedules: detail.schedules.map((schedule) =>
            schedule.id === response.schedule.id ? response.schedule : schedule
          ),
        });
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
        setDetail({
          ...detail,
          schedules: detail.schedules.map((item) => (item.id === schedule.id ? response.schedule : item)),
        });
      }
      await loadServices();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo desvincular la transacción";
      setGlobalError(message);
      logger.error("[services] unlink:error", message);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Servicios recurrentes</h1>
        <Alert variant="error">No tienes permisos para ver los servicios registrados.</Alert>
      </section>
    );
  }

  const selectedService = detail?.service ?? null;
  const schedules = detail?.schedules ?? [];

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Servicios recurrentes</h1>
        <p className="text-sm text-slate-600/90">
          Controla pagos mensuales de servicios y asócialos directamente a las transacciones registradas.
        </p>
      </header>

      {globalError && <Alert variant="error">{globalError}</Alert>}
      {loadingList && <p className="text-xs text-slate-400">Actualizando listado de servicios...</p>}

      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <div className="min-h-[70vh]">
          <ServiceList
            services={services}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreateRequest={() => {
              setCreateOpen(true);
              setCreateError(null);
            }}
            canManage={canManage}
          />
        </div>
        <div className="min-h-[70vh]">
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

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo servicio">
        <ServiceForm
          onSubmit={async (payload) => {
            await handleCreateService(payload);
          }}
          onCancel={() => setCreateOpen(false)}
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentSchedule(null)}
                disabled={processingPayment}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={processingPayment}>
                {processingPayment ? "Guardando..." : "Guardar pago"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
