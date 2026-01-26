import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import {
  createLoan,
  regenerateSchedules,
  registerLoanPayment,
  unlinkLoanPayment,
} from "@/features/finance/loans/api";
import LoanDetailSection from "@/features/finance/loans/components/LoanDetailSection";
import LoanForm from "@/features/finance/loans/components/LoanForm";
import LoanList from "@/features/finance/loans/components/LoanList";
import { loanKeys } from "@/features/finance/loans/queries";
import type {
  CreateLoanPayload,
  LoanPaymentPayload,
  LoanSchedule,
  RegenerateSchedulePayload,
} from "@/features/finance/loans/types";
import { today } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";

export default function LoansPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Loan");
  const canView = can("read", "Loan");

  const [selectedId, setSelectedId] = useState<null | string>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<null | string>(null);

  const [paymentSchedule, setPaymentSchedule] = useState<LoanSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paidAmount: "",
    paidDate: today(),
    transactionId: "",
  });
  const [paymentError, setPaymentError] = useState<null | string>(null);

  // Suspense Query (data is preloaded by Router)
  const { data: loansResponse } = useSuspenseQuery(loanKeys.lists());

  const loans = useMemo(() => loansResponse.loans, [loansResponse.loans]);

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

  // REST API mutations
  const createMutation = useMutation({
    mutationFn: createLoan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
    },
  });

  const registerPaymentMutation = useMutation({
    mutationFn: ({ payload, scheduleId }: { payload: LoanPaymentPayload; scheduleId: number }) =>
      registerLoanPayment(scheduleId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
      if (selectedId) {
        void queryClient.invalidateQueries({ queryKey: loanKeys.detail(selectedId).queryKey });
      }
    },
  });

  const unlinkPaymentMutation = useMutation({
    mutationFn: unlinkLoanPayment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
      if (selectedId) {
        void queryClient.invalidateQueries({ queryKey: loanKeys.detail(selectedId).queryKey });
      }
    },
  });

  const handleCreateLoan = async (payload: CreateLoanPayload) => {
    setCreateError(null);
    try {
      await createMutation.mutateAsync(payload);
      setCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Error al crear préstamo");
    }
  };

  const handleRegenerate = async (overrides: RegenerateSchedulePayload) => {
    if (!selectedId) return;
    try {
      await regenerateSchedules(selectedId, overrides);
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
      void queryClient.invalidateQueries({ queryKey: loanKeys.detail(selectedId).queryKey });
    } catch (error) {
      console.error("Regenerate failed:", error);
    }
  };

  const openPaymentModal = (schedule: LoanSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      paidAmount:
        schedule.paid_amount == null
          ? String(schedule.expected_amount)
          : String(schedule.paid_amount),
      paidDate: schedule.paid_date ?? today(),
      transactionId: schedule.transaction_id ? String(schedule.transaction_id) : "",
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
      await registerPaymentMutation.mutateAsync({
        payload: {
          paidAmount,
          paidDate: paymentForm.paidDate,
          transactionId,
        },
        scheduleId: paymentSchedule.id,
      });
      setPaymentSchedule(null);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Error al registrar pago");
    }
  };

  const handleUnlink = async (schedule: LoanSchedule) => {
    try {
      await unlinkPaymentMutation.mutateAsync(schedule.id);
    } catch (error) {
      console.error("Unlink failed:", error);
    }
  };

  if (!canView) {
    return (
      <section className={PAGE_CONTAINER}>
        <Alert variant="error">No tienes permisos para ver los préstamos registrados.</Alert>
      </section>
    );
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <div className="border-default-200 bg-background min-h-[70vh] rounded-2xl border p-6 shadow-sm">
          <LoanList
            canManage={canManage}
            loans={loans}
            onCreateRequest={() => {
              setCreateOpen(true);
              setCreateError(null);
            }}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        </div>
        <div className="border-default-200 bg-background min-h-[70vh] rounded-2xl border p-6 shadow-sm">
          {!selectedId && (
            <div className="flex h-full items-center justify-center text-center">
              <p className="text-default-500 text-sm">
                Selecciona un préstamo para ver los detalles
              </p>
            </div>
          )}
          {selectedId && (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <div className="bg-default-50 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent opacity-50" />
                </div>
              }
            >
              <LoanDetailSection
                canManage={canManage}
                loanId={selectedId}
                onRegenerate={handleRegenerate}
                onRegisterPayment={openPaymentModal}
                onUnlinkPayment={handleUnlink}
              />
            </Suspense>
          )}
        </div>
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        title="Nuevo préstamo"
      >
        <LoanForm
          onCancel={() => {
            setCreateOpen(false);
          }}
          onSubmit={async (payload) => {
            await handleCreateLoan(payload);
          }}
        />
        {createError && (
          <p className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">
            {createError}
          </p>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(paymentSchedule)}
        onClose={() => {
          setPaymentSchedule(null);
        }}
        title={
          paymentSchedule
            ? `Registrar pago cuota #${paymentSchedule.installment_number}`
            : "Registrar pago"
        }
      >
        {paymentSchedule && (
          <form className="space-y-4" onSubmit={handlePaymentSubmit}>
            <Input
              inputMode="numeric"
              label="ID transacción"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setPaymentForm((prev) => ({ ...prev, transactionId: event.target.value }));
              }}
              required
              type="number"
              value={paymentForm.transactionId}
            />
            <Input
              inputMode="decimal"
              label="Monto pagado"
              min={0}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setPaymentForm((prev) => ({ ...prev, paidAmount: event.target.value }));
              }}
              required
              step="0.01"
              type="number"
              value={paymentForm.paidAmount}
            />
            <Input
              label="Fecha de pago"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setPaymentForm((prev) => ({ ...prev, paidDate: event.target.value }));
              }}
              required
              type="date"
              value={paymentForm.paidDate}
            />
            {paymentError && (
              <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">
                {paymentError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setPaymentSchedule(null);
                }}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button disabled={registerPaymentMutation.isPending} type="submit">
                {registerPaymentMutation.isPending ? "Guardando..." : "Guardar pago"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
