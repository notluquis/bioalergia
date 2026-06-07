import { formatChile } from "@/lib/dates";
import {
  Alert,
  Button,
  Calendar,
  DateField,
  DatePicker,
  Form,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { fetchCounterparts } from "@/features/counterparts/api";
import { counterpartKeys } from "@/features/counterparts/queries";
import {
  createLoan,
  createStructuredLoan,
  deleteLoan,
  regenerateSchedules,
  registerLoanPayment,
  unlinkLoanPayment,
  updateLoan,
} from "@/features/finance/loans/api";
import { LoanDetailSection } from "@/features/finance/loans/components/LoanDetailSection";
import { LoanForm } from "@/features/finance/loans/components/LoanForm";
import { LoanList } from "@/features/finance/loans/components/LoanList";
import { loanKeys } from "@/features/finance/loans/queries";
import type {
  CreateLoanPayload,
  CreateStructuredLoanPayload,
  LoanPaymentPayload,
  LoanSchedule,
  LoanSummary,
  RegenerateSchedulePayload,
  UpdateLoanPayload,
} from "@/features/finance/loans/types";
import { PAGE_CONTAINER } from "@/lib/styles";

type LoanEditForm = {
  borrowerName: string;
  borrowerType: "COMPANY" | "PERSON";
  counterpartId: null | number;
  frequency: "BIWEEKLY" | "IRREGULAR" | "MONTHLY" | "WEEKLY";
  interestRate: number;
  interestType: "COMPOUND" | "SIMPLE";
  notes: string;
  principalAmount: number;
  startDate: string;
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  title: string;
  totalInstallments: number;
};

export function LoansPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canDelete = can("delete", "Loan");
  const canManage = can("update", "Loan");
  const canView = can("read", "Loan");

  const [selectedId, setSelectedId] = useState<null | string>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<null | string>(null);
  const [editLoan, setEditLoan] = useState<LoanSummary | null>(null);
  const [editError, setEditError] = useState<null | string>(null);
  const [editForm, setEditForm] = useState<LoanEditForm>({
    borrowerName: "",
    borrowerType: "PERSON",
    counterpartId: null,
    frequency: "MONTHLY",
    interestRate: 0,
    interestType: "SIMPLE",
    notes: "",
    principalAmount: 1,
    startDate: formatChile(new Date(), "YYYY-MM-DD"),
    status: "ACTIVE",
    title: "",
    totalInstallments: 1,
  });

  const [paymentSchedule, setPaymentSchedule] = useState<LoanSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    paidAmount: number | undefined;
    paidDate: string;
    transactionId: string;
  }>({
    paidAmount: undefined,
    paidDate: formatChile(new Date(), "YYYY-MM-DD"),
    transactionId: "",
  });
  const [paymentError, setPaymentError] = useState<null | string>(null);

  // Suspense Query (data is preloaded by Router)
  const { data: loansResponse } = useSuspenseQuery(loanKeys.lists());
  const { data: counterparts = [], isLoading: isLoadingCounterparts } = useQuery({
    queryFn: fetchCounterparts,
    queryKey: counterpartKeys.lists(),
  });

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

  const createStructuredMutation = useMutation({
    mutationFn: createStructuredLoan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ payload, publicId }: { payload: UpdateLoanPayload; publicId: string }) =>
      updateLoan(publicId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.all });
      void queryClient.invalidateQueries({
        queryKey: loanKeys.detail(variables.publicId).queryKey,
      });
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

  const handleCreateStructuredLoan = async (payload: CreateStructuredLoanPayload) => {
    setCreateError(null);
    try {
      await createStructuredMutation.mutateAsync(payload);
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

  const openEditModal = (loan: LoanSummary) => {
    setEditLoan(loan);
    setEditError(null);
    setEditForm({
      borrowerName: loan.borrower_name,
      borrowerType: loan.borrower_type,
      counterpartId: loan.counterpart_id,
      frequency: loan.frequency,
      interestRate: loan.interest_rate,
      interestType: loan.interest_type,
      notes: loan.notes ?? "",
      principalAmount: loan.principal_amount,
      startDate: loan.start_date,
      status: loan.status,
      title: loan.title,
      totalInstallments: loan.total_installments,
    });
  };

  const handleDeleteLoan = async (loan: LoanSummary) => {
    const ok = await confirmAction({
      confirmLabel: "Eliminar préstamo",
      description:
        "Se eliminará el préstamo completo junto con su cronograma, fuentes y pagos asociados.",
      title: `Eliminar ${loan.title}`,
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    await deleteMutation.mutateAsync(loan.public_id);
    if (selectedId === loan.public_id) {
      const nextLoan = loans.find((item) => item.public_id !== loan.public_id);
      setSelectedId(nextLoan?.public_id ?? null);
    }
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editLoan) {
      return;
    }
    setEditError(null);
    try {
      await updateMutation.mutateAsync({
        payload: {
          ...editForm,
          notes: editForm.notes || null,
        },
        publicId: editLoan.public_id,
      });
      setEditLoan(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Error al actualizar préstamo");
    }
  };

  const openPaymentModal = (schedule: LoanSchedule) => {
    setPaymentSchedule(schedule);
    setPaymentForm({
      paidAmount: schedule.paid_amount == null ? schedule.expected_amount : schedule.paid_amount,
      paidDate: schedule.paid_date ? schedule.paid_date : formatChile(new Date(), "YYYY-MM-DD"),
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
      <div className="grid gap-4 lg:min-h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(24rem,30rem)_minmax(0,1fr)]">
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
        <div className="min-h-[34rem] lg:min-h-0">
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
                canDelete={canDelete}
                canManage={canManage}
                loanId={selectedId}
                onDeleteRequest={(loan) => {
                  void handleDeleteLoan(loan);
                }}
                onEditRequest={openEditModal}
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
          onSubmitStructured={async (payload) => {
            await handleCreateStructuredLoan(payload);
          }}
        />

        {createError && (
          <p className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
            {createError}
          </p>
        )}
      </AppModal>

      <AppModal
        isOpen={Boolean(editLoan)}
        onClose={() => {
          setEditLoan(null);
        }}
        title={editLoan ? `Editar ${editLoan.title}` : "Editar préstamo"}
        size="lg"
        footer={
          <>
            <Button
              isDisabled={updateMutation.isPending}
              onPress={() => {
                setEditLoan(null);
              }}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button isDisabled={updateMutation.isPending} form="loan-edit-form" type="submit">
              {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </>
        }
      >
        {editLoan && (
          <Form
            className="grid gap-4 md:grid-cols-2"
            id="loan-edit-form"
            onSubmit={(event) => {
              void handleEditSubmit(event);
            }}
            validationBehavior="aria"
          >
            <TextField isRequired>
              <Label>Título</Label>
              <Input
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setEditForm((prev) => ({ ...prev, title: event.target.value }));
                }}
                value={editForm.title}
                variant="secondary"
              />
            </TextField>

            <TextField isRequired>
              <Label>Beneficiario</Label>
              <Input
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setEditForm((prev) => ({
                    ...prev,
                    borrowerName: event.target.value,
                    counterpartId: null,
                  }));
                }}
                value={editForm.borrowerName}
                variant="secondary"
              />
            </TextField>

            <Select
              isDisabled={isLoadingCounterparts}
              onChange={(key) => {
                const nextId = key === "none" ? null : Number(key);
                const nextCounterpart = counterparts.find((item) => item.id === nextId);
                setEditForm((prev) => ({
                  ...prev,
                  borrowerName: nextCounterpart?.bankAccountHolder ?? prev.borrowerName,
                  counterpartId: nextId,
                }));
              }}
              value={editForm.counterpartId ? String(editForm.counterpartId) : "none"}
            >
              <Label>Contraparte</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="none">Sin contraparte</ListBox.Item>
                  {counterparts.map((counterpart) => (
                    <ListBox.Item
                      id={String(counterpart.id)}
                      key={counterpart.id}
                      textValue={`${counterpart.bankAccountHolder} ${counterpart.identificationNumber}`}
                    >
                      <div className="flex flex-col">
                        <span>{counterpart.bankAccountHolder}</span>
                        <span className="text-default-500 text-xs">
                          {counterpart.identificationNumber || "Sin RUT"}
                        </span>
                      </div>
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              onChange={(key) => {
                setEditForm((prev) => ({
                  ...prev,
                  borrowerType: key as LoanEditForm["borrowerType"],
                }));
              }}
              value={editForm.borrowerType}
            >
              <Label>Tipo de deudor</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="PERSON">Persona</ListBox.Item>
                  <ListBox.Item id="COMPANY">Empresa</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              onChange={(key) => {
                setEditForm((prev) => ({
                  ...prev,
                  status: key as LoanEditForm["status"],
                }));
              }}
              value={editForm.status}
            >
              <Label>Estado</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ACTIVE">Activo</ListBox.Item>
                  <ListBox.Item id="COMPLETED">Liquidado</ListBox.Item>
                  <ListBox.Item id="DEFAULTED">En mora</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <NumberField
              minValue={0.01}
              onChange={(value) => {
                setEditForm((prev) => ({ ...prev, principalAmount: value ?? 0 }));
              }}
              value={editForm.principalAmount}
            >
              <Label>Capital</Label>
              <NumberField.Group className="grid-cols-1">
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>

            <NumberField
              minValue={1}
              onChange={(value) => {
                setEditForm((prev) => ({ ...prev, totalInstallments: value ?? 1 }));
              }}
              value={editForm.totalInstallments}
            >
              <Label>Total de cuotas</Label>
              <NumberField.Group className="grid-cols-1">
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>

            <NumberField
              minValue={0}
              onChange={(value) => {
                setEditForm((prev) => ({ ...prev, interestRate: value ?? 0 }));
              }}
              value={editForm.interestRate}
            >
              <Label>Tasa (%)</Label>
              <NumberField.Group className="grid-cols-1">
                <NumberField.Input />
              </NumberField.Group>
            </NumberField>

            <Select
              onChange={(key) => {
                setEditForm((prev) => ({
                  ...prev,
                  interestType: key as LoanEditForm["interestType"],
                }));
              }}
              value={editForm.interestType}
            >
              <Label>Tipo de interés</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="SIMPLE">Simple</ListBox.Item>
                  <ListBox.Item id="COMPOUND">Compuesto</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              onChange={(key) => {
                setEditForm((prev) => ({
                  ...prev,
                  frequency: key as LoanEditForm["frequency"],
                }));
              }}
              value={editForm.frequency}
            >
              <Label>Frecuencia</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="WEEKLY">Semanal</ListBox.Item>
                  <ListBox.Item id="BIWEEKLY">Quincenal</ListBox.Item>
                  <ListBox.Item id="MONTHLY">Mensual</ListBox.Item>
                  <ListBox.Item id="IRREGULAR">Irregular</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <DatePicker
              onChange={(value) => {
                setEditForm((prev) => ({ ...prev, startDate: value?.toString() ?? "" }));
              }}
              value={editForm.startDate ? parseDate(editForm.startDate) : undefined}
            >
              <Label>Fecha de inicio</Label>
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
                <Calendar aria-label="Fecha de inicio del préstamo">
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

            <TextField className="md:col-span-2">
              <Label>Notas</Label>
              <TextArea
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setEditForm((prev) => ({ ...prev, notes: event.target.value }));
                }}
                rows={3}
                value={editForm.notes ?? ""}
                variant="secondary"
              />
            </TextField>

            {editError && (
              <p className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm md:col-span-2">
                {editError}
              </p>
            )}
          </Form>
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
              <NumberField.Group className="grid-cols-1">
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
