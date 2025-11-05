import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { logger } from "../lib/logger";
import Alert from "../components/Alert";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Button from "../components/Button";
import LoanList from "../features/loans/components/LoanList";
import LoanDetail from "../features/loans/components/LoanDetail";
import LoanForm from "../features/loans/components/LoanForm";
import {
  createLoan,
  fetchLoanDetail,
  fetchLoans,
  registerLoanPayment,
  regenerateSchedules,
  unlinkLoanPayment,
} from "../features/loans/api";
import type {
  CreateLoanPayload,
  LoanSchedule,
  LoanSummary,
  LoanDetailResponse,
  RegenerateSchedulePayload,
} from "../features/loans/types";

export default function LoansPage() {
  const { hasRole } = useAuth();
  const canManage = useMemo(() => hasRole("GOD", "ADMIN"), [hasRole]);
  const canView = useMemo(() => hasRole("GOD", "ADMIN", "ANALYST", "VIEWER"), [hasRole]);

  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LoanDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [paymentSchedule, setPaymentSchedule] = useState<LoanSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    transactionId: "",
    paidAmount: "",
    paidDate: dayjs().format("YYYY-MM-DD"),
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    if (!canView) return;
    setLoadingList(true);
    setGlobalError(null);
    try {
      const response = await fetchLoans();
      setLoans(response.loans);
      if (!selectedId && response.loans.length) {
        const firstLoan = response.loans[0];
        if (firstLoan) setSelectedId(firstLoan.public_id);
      } else if (selectedId) {
        const stillExists = response.loans.some((loan) => loan.public_id === selectedId);
        if (!stillExists && response.loans.length) {
          const firstLoan = response.loans[0];
          if (firstLoan) setSelectedId(firstLoan.public_id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar la lista de préstamos";
      setGlobalError(message);
      logger.error("[loans] list:error", message);
    } finally {
      setLoadingList(false);
    }
  }, [canView, selectedId]);

  const loadDetail = useCallback(async (publicId: string) => {
    setLoadingDetail(true);
    setGlobalError(null);
    try {
      const response = await fetchLoanDetail(publicId);
      setDetail(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo obtener el detalle";
      setGlobalError(message);
      logger.error("[loans] detail:error", message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadLoans().catch((error) => logger.error("[loans] list:effect", error));
  }, [loadLoans]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId).catch((error) => logger.error("[loans] detail:effect", error));
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const handleCreateLoan = async (payload: CreateLoanPayload) => {
    setCreateError(null);
    try {
      const response = await createLoan(payload);
      await loadLoans();
      setSelectedId(response.loan.public_id);
      setDetail(response);
      setCreateOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el préstamo";
      setCreateError(message);
      logger.error("[loans] create:error", message);
      throw error;
    }
  };

  const handleRegenerate = async (overrides: RegenerateSchedulePayload) => {
    if (!detail) return;
    setLoadingDetail(true);
    try {
      const response = await regenerateSchedules(detail.loan.public_id, overrides);
      setDetail(response);
      await loadLoans();
    } finally {
      setLoadingDetail(false);
    }
  };

  const openPaymentModal = (schedule: LoanSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      transactionId: schedule.transaction_id ? String(schedule.transaction_id) : "",
      paidAmount: schedule.paid_amount != null ? String(schedule.paid_amount) : String(schedule.expected_amount),
      paidDate: schedule.paid_date ?? dayjs().format("YYYY-MM-DD"),
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
      const response = await registerLoanPayment(paymentSchedule.id!, {
        transactionId,
        paidAmount,
        paidDate: paymentForm.paidDate,
      });
      if (detail) {
        setDetail({
          ...detail,
          schedules: detail.schedules.map((schedule) =>
            schedule.id! === response.schedule.id ? response.schedule : schedule
          ),
        });
      }
      await loadLoans();
      setPaymentSchedule(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar el pago";
      setPaymentError(message);
      logger.error("[loans] payment:error", message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleUnlink = async (schedule: LoanSchedule) => {
    try {
      const response = await unlinkLoanPayment(schedule.id);
      if (detail) {
        setDetail({
          ...detail,
          schedules: detail.schedules.map((item) => (item.id === schedule.id ? response.schedule : item)),
        });
      }
      await loadLoans();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo desvincular la transacción";
      setGlobalError(message);
      logger.error("[loans] unlink:error", message);
    }
  };

  const selectedLoan = detail?.loan ?? null;
  const schedules = detail?.schedules ?? [];
  const summary = detail?.summary ?? null;

  if (!canView) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-primary">Préstamos y créditos</h1>
        <Alert variant="error">No tienes permisos para ver los préstamos registrados.</Alert>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-primary">Préstamos y créditos</h1>
        <p className="text-sm text-base-content/90">
          Gestiona préstamos internos, cronogramas de pago y vincula cada cuota con las transacciones reales.
        </p>
      </header>

      {globalError && <Alert variant="error">{globalError}</Alert>}

      {loadingList && <p className="text-xs text-base-content/50">Actualizando listado de préstamos...</p>}

      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <div className="min-h-[70vh]">
          <LoanList
            loans={loans}
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
          <LoanDetail
            loan={selectedLoan}
            schedules={schedules}
            summary={summary}
            loading={loadingDetail}
            canManage={canManage}
            onRegenerate={handleRegenerate}
            onRegisterPayment={openPaymentModal}
            onUnlinkPayment={handleUnlink}
          />
        </div>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo préstamo">
        <LoanForm
          onSubmit={async (payload) => {
            await handleCreateLoan(payload);
          }}
          onCancel={() => setCreateOpen(false)}
        />
        {createError && <p className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{createError}</p>}
      </Modal>

      <Modal
        isOpen={Boolean(paymentSchedule)}
        onClose={() => setPaymentSchedule(null)}
        title={paymentSchedule ? `Registrar pago cuota #${paymentSchedule.installment_number}` : "Registrar pago"}
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
