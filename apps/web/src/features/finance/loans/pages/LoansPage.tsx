import { useCreateLoan, useFindManyLoan, useUpdateLoanSchedule } from "@finanzas/db/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { fetchLoanDetail, regenerateSchedules } from "@/features/finance/loans/api";
import LoanDetail from "@/features/finance/loans/components/LoanDetail";
import LoanForm from "@/features/finance/loans/components/LoanForm";
import LoanList from "@/features/finance/loans/components/LoanList";
import type { CreateLoanPayload, LoanSchedule, RegenerateSchedulePayload } from "@/features/finance/loans/types";
import { today } from "@/lib/dates";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

export default function LoansPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Loan");
  const canView = can("read", "Loan");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [paymentSchedule, setPaymentSchedule] = useState<LoanSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    transactionId: "",
    paidAmount: "",
    paidDate: today(),
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // ZenStack hooks for loans list
  const {
    data: loansData,
    isLoading: loadingList,
    error: listError,
  } = useFindManyLoan({
    include: { schedules: true },
    orderBy: { createdAt: "desc" },
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const loans = ((loansData as any[]) ?? []).map((loan) => ({
    ...loan,
    public_id: loan.publicId,
  }));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Auto-selection
  useEffect(() => {
    if (loans.length > 0 && !selectedId) {
      setSelectedId(loans[0]?.public_id ?? null);
    } else if (loans.length === 0 && selectedId) {
      setSelectedId(null);
    } else if (selectedId && !loans.some((l) => l.public_id === selectedId) && loans.length > 0) {
      setSelectedId(loans[0]?.public_id ?? null);
    }
  }, [loans, selectedId]);

  // Fetch Detail (kept as manual due to complex aggregation)
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["loan-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      return fetchLoanDetail(selectedId);
    },
    enabled: !!selectedId && canView,
  });

  // ZenStack mutations
  // ZenStack mutations
  const createMutation = useCreateLoan();
  const updateScheduleMutation = useUpdateLoanSchedule();

  const handleCreateLoan = async (payload: CreateLoanPayload) => {
    setCreateError(null);
    try {
      await createMutation.mutateAsync({
        publicId: crypto.randomUUID().slice(0, 8),
        title: payload.title,
        borrowerName: payload.borrowerName,
        borrowerType: payload.borrowerType,
        principalAmount: payload.principalAmount,
        interestRate: payload.interestRate,
        interestType: payload.interestType,
        frequency: payload.frequency,
        totalInstallments: payload.totalInstallments,
        startDate: payload.startDate,
        notes: payload.notes,
      });
      queryClient.invalidateQueries({ queryKey: ["loan"] });
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error al crear préstamo");
    }
  };

  const handleRegenerate = async (overrides: RegenerateSchedulePayload) => {
    if (!selectedId) return;
    try {
      await regenerateSchedules(selectedId, overrides);
      queryClient.invalidateQueries({ queryKey: ["loan"] });
      queryClient.invalidateQueries({ queryKey: ["loan-detail", selectedId] });
    } catch (err) {
      console.error("Regenerate failed:", err);
    }
  };

  const openPaymentModal = (schedule: LoanSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      transactionId: schedule.transaction_id ? String(schedule.transaction_id) : "",
      paidAmount: schedule.paid_amount != null ? String(schedule.paid_amount) : String(schedule.expected_amount),
      paidDate: schedule.paid_date ?? today(),
    });
    setPaymentError(null);
  };

  const handlePaymentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentSchedule) return;

    const transactionId = Number(paymentForm.transactionId);
    const paidAmount = Number(paymentForm.paidAmount);
    if (!Number.isFinite(transactionId) || transactionId <= 0) {
      setPaymentError("ID de transacción inválido");
      return;
    }

    try {
      await updateScheduleMutation.mutateAsync({
        where: { id: paymentSchedule.id },
        data: {
          transactionId,
          paidAmount,
          paidDate: paymentForm.paidDate,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["loan"] });
      queryClient.invalidateQueries({ queryKey: ["loan-detail", selectedId] });
      setPaymentSchedule(null);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Error al registrar pago");
    }
  };

  const handleUnlink = async (schedule: LoanSchedule) => {
    try {
      await updateScheduleMutation.mutateAsync({
        where: { id: schedule.id },
        data: {
          transactionId: null,
          paidAmount: null,
          paidDate: null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["loan"] });
      queryClient.invalidateQueries({ queryKey: ["loan-detail", selectedId] });
    } catch (err) {
      console.error("Unlink failed:", err);
    }
  };

  const selectedLoan = detail?.loan ?? null;
  const globalError = listError ? (listError instanceof Error ? listError.message : String(listError)) : null;

  const schedules = detail?.schedules ?? [];
  const summary = detail?.summary ?? null;

  if (!canView) {
    return (
      <section className={PAGE_CONTAINER}>
        <div className="space-y-2">
          <h1 className={TITLE_LG}>Préstamos y créditos</h1>
        </div>
        <Alert variant="error">No tienes permisos para ver los préstamos registrados.</Alert>
      </section>
    );
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="space-y-2">
        <h1 className={TITLE_LG}>Préstamos y créditos</h1>
        <p className="text-base-content/70 text-sm">
          Gestiona préstamos internos, cronogramas de pago y vincula cada cuota con las transacciones reales.
        </p>
      </div>

      {globalError && <Alert variant="error">{globalError}</Alert>}

      {loadingList && <p className="text-base-content/50 text-xs">Actualizando listado de préstamos...</p>}

      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <div className="border-base-300 bg-base-100 min-h-[70vh] rounded-2xl border p-6 shadow-sm">
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
        <div className="border-base-300 bg-base-100 min-h-[70vh] rounded-2xl border p-6 shadow-sm">
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
              inputMode="numeric"
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
              inputMode="decimal"
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
              <Button type="button" variant="secondary" onClick={() => setPaymentSchedule(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateScheduleMutation.isPending}>
                {updateScheduleMutation.isPending ? "Guardando..." : "Guardar pago"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
