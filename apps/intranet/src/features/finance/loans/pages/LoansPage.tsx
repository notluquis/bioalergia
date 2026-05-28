import {
  Alert,
  Button,
  Calendar,
  DateField,
  DatePicker,
  Form,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { useAuth } from "@/context/AuthContext";
import {
  createLoan,
  regenerateSchedules,
  registerLoanPayment,
  unlinkLoanPayment,
} from "@/features/finance/loans/api";
import { LoanDetailSection } from "@/features/finance/loans/components/LoanDetailSection";
import { LoanForm } from "@/features/finance/loans/components/LoanForm";
import { LoanList } from "@/features/finance/loans/components/LoanList";
import { loanKeys } from "@/features/finance/loans/queries";
import type {
  CreateLoanPayload,
  LoanPaymentPayload,
  LoanSchedule,
  RegenerateSchedulePayload,
} from "@/features/finance/loans/types";
import { PAGE_CONTAINER } from "@/lib/styles";
export function LoansPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Loan");
  const canView = can("read", "Loan");

  const [selectedId, setSelectedId] = useState<null | string>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<null | string>(null);

  const [paymentSchedule, setPaymentSchedule] = useState<LoanSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    paidAmount: number | undefined;
    paidDate: string;
    transactionId: string;
  }>({
    paidAmount: undefined,
    paidDate: dayjs().format("YYYY-MM-DD"),
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
    if (!selectedId) {
      return;
    }
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
      paidAmount: schedule.paid_amount == null ? schedule.expected_amount : schedule.paid_amount,
      paidDate: schedule.paid_date ? schedule.paid_date : dayjs().format("YYYY-MM-DD"),
      transactionId: schedule.transaction_id ? String(schedule.transaction_id) : "",
    });
    setPaymentError(null);
  };

  const handlePaymentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentSchedule) {
      return;
    }

    const transactionId = Number(paymentForm.transactionId);
    const paidAmount = paymentForm.paidAmount ?? 0;
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
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>
              No tienes permisos para ver los préstamos registrados.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </section>
    );
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
        <div className="min-h-[70vh] rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
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
        <div className="min-h-[70vh] rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
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
                  <div className="rounded-full border-4 border-t-transparent bg-default-50 opacity-50 size-10" />
                </div>
              }
            >
              <LoanDetailSection
                canManage={canManage}
                loanId={selectedId}
                onRegenerate={handleRegenerate}
                onRegisterPayment={openPaymentModal}
                onUnlinkPayment={(...args) => {
                  void handleUnlink(...args);
                }}
              />
            </Suspense>
          )}
        </div>
      </div>

      <AppModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        title="Nuevo préstamo"
        size="lg"
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
          <p className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
            {createError}
          </p>
        )}
      </AppModal>

      <AppModal
        isOpen={Boolean(paymentSchedule)}
        onClose={() => {
          setPaymentSchedule(null);
        }}
        title={
          paymentSchedule
            ? `Registrar pago cuota #${paymentSchedule.installment_number}`
            : "Registrar pago"
        }
        size="lg"
        footer={
          <>
            <Button
              onPress={() => {
                setPaymentSchedule(null);
              }}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              isDisabled={registerPaymentMutation.isPending}
              type="submit"
              form="loan-payment-form"
            >
              {registerPaymentMutation.isPending ? "Guardando..." : "Guardar pago"}
            </Button>
          </>
        }
      >
        {paymentSchedule && (
          <Form
            id="loan-payment-form"
            className="space-y-4"
            onSubmit={(e) => {
              void handlePaymentSubmit(e);
            }}
            validationBehavior="aria"
          >
            <TextField isRequired>
              <Label>ID transacción</Label>
              <Input
                inputMode="numeric"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setPaymentForm((prev) => ({
                    ...prev,
                    transactionId: event.target.value,
                  }));
                }}
                type="number"
                value={paymentForm.transactionId}
                variant="secondary"
              />
            </TextField>

            <NumberField
              isRequired
              formatOptions={{
                currency: "CLP",
                currencyDisplay: "symbol",
                maximumFractionDigits: 0,
                minimumFractionDigits: 0,
                style: "currency",
              }}
              minValue={0}
              onChange={(value) => {
                setPaymentForm((prev) => ({ ...prev, paidAmount: value }));
              }}
              value={paymentForm.paidAmount}
            >
              <Label>Monto pagado</Label>
              <NumberField.Group>
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>

            <DatePicker
              isRequired
              onChange={(value) => {
                setPaymentForm((prev) => ({
                  ...prev,
                  paidDate: value?.toString() ?? "",
                }));
              }}
              value={paymentForm.paidDate ? parseDate(paymentForm.paidDate) : undefined}
            >
              <Label>Fecha de pago</Label>
              <DateField.Group>
                <DateField.InputContainer>
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                </DateField.InputContainer>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover>
                <Calendar aria-label="Fecha de pago">
                  <Calendar.Header>
                    <Calendar.YearPickerTrigger>
                      <Calendar.YearPickerTriggerHeading />
                      <Calendar.YearPickerTriggerIndicator />
                    </Calendar.YearPickerTrigger>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>

            {paymentError && (
              <p className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
                {paymentError}
              </p>
            )}
          </Form>
        )}
      </AppModal>
    </section>
  );
}
