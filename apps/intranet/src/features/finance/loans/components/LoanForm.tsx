import { formatChile } from "@/lib/dates";
import {
  Alert,
  Button,
  Checkbox,
  FieldError,
  Form,
  Input as HeroInput,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useStore } from "@tanstack/react-form";
import { Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import {
  createCounterpart,
  type CounterpartUpsertPayload,
  fetchCounterparts,
} from "@/features/counterparts/api";
import { CounterpartForm } from "@/features/counterparts/components/CounterpartForm";
import { counterpartKeys } from "@/features/counterparts/queries";
import { zDateString } from "@/lib/api-validate";
import { formatErrors } from "@/lib/form-errors";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { CreateLoanPayload, CreateStructuredLoanPayload } from "../types";

const loanFormSchema = z.object({
  borrowerName: z.string().trim().min(1, "El beneficiario es requerido"),
  borrowerType: z.enum(["PERSON", "COMPANY"]),
  counterpartId: z.number().int().positive().nullable(),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "IRREGULAR"]),
  generateSchedule: z.boolean(),
  interestRate: z.number(), // Range validation (0-100%) delegated to NumberField component
  interestType: z.enum(["SIMPLE", "COMPOUND"]),
  notes: z.string().optional(),
  principalAmount: z.number().positive("El monto principal debe ser mayor a 0"),
  startDate: zDateString,
  title: z.string().trim().min(1, "El título es requerido"),
  totalInstallments: z.number().int().min(1, "Debe tener al menos 1 cuota"),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  readonly onCancel: () => void;
  readonly onSubmit: (payload: CreateLoanPayload) => Promise<void>;
  readonly onSubmitStructured?: (payload: CreateStructuredLoanPayload) => Promise<void>;
}

type LoanFormMode = "classic" | "structured";
type StructuredScheduleMode = "equal" | "manual";
type PaymentKind = "ADJUSTMENT" | "DISCOUNT" | "PAYMENT";

type SourceDraft = {
  feeAmount: number;
  fixedInterestRate: number;
  id: string;
  label: string;
  principalAmount: number;
  sourceType: "BANK_CREDIT" | "CREDIT_CARD" | "OTHER" | "PERSON_LOAN" | "TRANSFER";
};

type PaymentDraft = {
  amount: number;
  id: string;
  kind: PaymentKind;
  note: string;
  paidDate: string;
  transactionId: string;
};

type ManualInstallmentDraft = {
  dueDate: string;
  expectedAmount: number;
  expectedInterest: number;
  id: string;
  note: string;
  payments: PaymentDraft[];
};

const createSourceDraft = (): SourceDraft => ({
  feeAmount: 0,
  fixedInterestRate: 0,
  id: crypto.randomUUID(),
  label: "",
  principalAmount: 0,
  sourceType: "PERSON_LOAN",
});

const createPaymentDraft = (paidDate = formatChile(new Date(), "YYYY-MM-DD")): PaymentDraft => ({
  amount: 0,
  id: crypto.randomUUID(),
  kind: "PAYMENT",
  note: "",
  paidDate,
  transactionId: "",
});

const createManualInstallmentDraft = (
  dueDate = formatChile(new Date(), "YYYY-MM-DD"),
  expectedAmount = 0
): ManualInstallmentDraft => ({
  dueDate,
  expectedAmount,
  expectedInterest: 0,
  id: crypto.randomUUID(),
  note: "",
  payments: [],
});

type LoanInputProps = {
  as?: "input" | "textarea";
  error?: string;
  isInvalid?: boolean;
  label: string;
  onChange?: (value: string) => void;
  value?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value">;

function LoanInputField({
  as = "input",
  error,
  isInvalid = false,
  label,
  onChange,
  value,
  ...props
}: LoanInputProps) {
  return (
    <TextField isInvalid={isInvalid} onChange={onChange} value={value}>
      <Label>{label}</Label>
      {as === "textarea" ? (
        <TextArea
          {...(props as Omit<
            React.TextareaHTMLAttributes<HTMLTextAreaElement>,
            "onChange" | "value"
          >)}
          variant="secondary"
        />
      ) : (
        <HeroInput
          {...(props as Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">)}
          variant="secondary"
        />
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
}

function LoanMoneyField({
  label,
  minValue = 0,
  onChange,
  value,
}: {
  label: string;
  minValue?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <NumberField minValue={minValue} onChange={(next) => onChange(next ?? 0)} value={value}>
      <Label>{label}</Label>
      <NumberField.Group className="grid-cols-1">
        <NumberField.Input />
      </NumberField.Group>
    </NumberField>
  );
}

function addDays(dateString: string, days: number) {
  return Temporal.PlainDate.from(dateString).add({ days }).toString();
}

function getStepDays(frequency: LoanFormData["frequency"]) {
  if (frequency === "BIWEEKLY") {
    return 14;
  }
  if (frequency === "MONTHLY") {
    return 30;
  }
  return 7;
}

export function LoanForm({ onCancel, onSubmit, onSubmitStructured }: LoanFormProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<LoanFormMode>("classic");
  const [structuredScheduleMode, setStructuredScheduleMode] =
    useState<StructuredScheduleMode>("equal");
  const [isCounterpartModalOpen, setIsCounterpartModalOpen] = useState(false);
  const [counterpartError, setCounterpartError] = useState<null | string>(null);
  const [sources, setSources] = useState<SourceDraft[]>([createSourceDraft()]);
  const [manualInstallments, setManualInstallments] = useState<ManualInstallmentDraft[]>([
    createManualInstallmentDraft(),
  ]);
  const { data: counterparts = [], isLoading: isLoadingCounterparts } = useQuery({
    queryFn: fetchCounterparts,
    queryKey: counterpartKeys.lists(),
  });

  const sourceTotals = useMemo(
    () =>
      sources.map((source) => {
        const interest = Math.round(source.principalAmount * (source.fixedInterestRate / 100));
        const total = source.principalAmount + interest + source.feeAmount;
        return { interest, total };
      }),
    [sources]
  );
  const structuredTotal = sourceTotals.reduce((sum, item) => sum + item.total, 0);

  const form = useForm({
    defaultValues: {
      borrowerName: "",
      borrowerType: "PERSON" as const,
      counterpartId: null,
      frequency: "WEEKLY" as const,
      generateSchedule: true,
      interestRate: 0,
      interestType: "SIMPLE" as const,
      notes: "",
      principalAmount: 1,
      startDate: formatChile(new Date(), "YYYY-MM-DD"),
      title: "",
      totalInstallments: 10,
    } as LoanFormData,
    onSubmit: async ({ value }) => {
      if (mode === "structured" && onSubmitStructured) {
        const usableSources = sources.filter(
          (source) => source.label.trim() && source.principalAmount > 0
        );
        const usableManualInstallments = manualInstallments.filter(
          (installment) => installment.dueDate && installment.expectedAmount > 0
        );
        await onSubmitStructured({
          borrowerName: value.borrowerName,
          borrowerType: value.borrowerType,
          counterpartId: value.counterpartId,
          ...(structuredScheduleMode === "equal"
            ? {
                equalSchedule: {
                  firstDueDate: value.startDate,
                  frequency: value.frequency,
                  installments: value.totalInstallments,
                },
              }
            : {
                manualInstallments: usableManualInstallments.map((installment) => {
                  // Clamp interés a la cuota para mantener el invariante
                  // expectedPrincipal + expectedInterest === expectedAmount.
                  const expectedInterest = Math.min(
                    installment.expectedInterest,
                    installment.expectedAmount
                  );
                  return {
                    dueDate: installment.dueDate,
                    expectedAmount: installment.expectedAmount,
                    expectedInterest,
                    expectedPrincipal: installment.expectedAmount - expectedInterest,
                    note: installment.note || undefined,
                    payments: installment.payments
                      .filter((payment) => payment.amount > 0 && payment.paidDate)
                      .map((payment) => {
                        const transactionId = Number(payment.transactionId);
                        return {
                          amount: payment.amount,
                          kind: payment.kind,
                          note: payment.note || undefined,
                          paidDate: payment.paidDate,
                          ...(Number.isFinite(transactionId) && transactionId > 0
                            ? { transactionId }
                            : {}),
                        };
                      }),
                  };
                }),
              }),
          notes: value.notes,
          sources: usableSources.map((source) => ({
            feeAmount: source.feeAmount,
            fixedInterestRate: source.fixedInterestRate,
            label: source.label,
            principalAmount: source.principalAmount,
            sourceType: source.sourceType,
          })),
          startDate: value.startDate,
          title: value.title,
        });
        return;
      }

      await onSubmit(value as CreateLoanPayload);
    },
    validators: {
      onBlur: loanFormSchema,
    },
  });
  const createCounterpartMutation = useMutation({
    mutationFn: createCounterpart,
    onSuccess: async (result) => {
      const { counterpart } = result;
      await queryClient.invalidateQueries({ queryKey: counterpartKeys.lists() });
      form.setFieldValue("counterpartId", counterpart.id);
      form.setFieldValue("borrowerName", counterpart.bankAccountHolder);
      setCounterpartError(null);
      setIsCounterpartModalOpen(false);
    },
  });

  const hasErrors = useStore(form.store, (state) =>
    Object.values(state.fieldMeta).some((meta) => meta.errors.length > 0)
  );
  const formValues = useStore(form.store, (state) => state.values);
  const selectedCounterpart = counterparts.find((item) => item.id === formValues.counterpartId);
  const manualExpectedTotal = manualInstallments.reduce(
    (sum, installment) => sum + installment.expectedAmount,
    0
  );
  const manualPaidTotal = manualInstallments.reduce(
    (sum, installment) =>
      sum + installment.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
    0
  );
  const manualDelta = manualExpectedTotal - structuredTotal;
  const hasStructuredSources = sources.some(
    (source) => source.label.trim() && source.principalAmount > 0
  );
  const hasManualInstallments = manualInstallments.some(
    (installment) => installment.dueDate && installment.expectedAmount > 0
  );
  const canSubmitStructured =
    mode !== "structured" ||
    (hasStructuredSources &&
      (structuredScheduleMode === "equal" || (hasManualInstallments && manualExpectedTotal > 0)));

  const updateSource = (id: string, patch: Partial<SourceDraft>) => {
    setSources((current) =>
      current.map((source) => (source.id === id ? { ...source, ...patch } : source))
    );
  };

  const updateInstallment = (id: string, patch: Partial<ManualInstallmentDraft>) => {
    setManualInstallments((current) =>
      current.map((installment) =>
        installment.id === id ? { ...installment, ...patch } : installment
      )
    );
  };

  const updatePayment = (
    installmentId: string,
    paymentId: string,
    patch: Partial<PaymentDraft>
  ) => {
    setManualInstallments((current) =>
      current.map((installment) =>
        installment.id === installmentId
          ? {
              ...installment,
              payments: installment.payments.map((payment) =>
                payment.id === paymentId ? { ...payment, ...patch } : payment
              ),
            }
          : installment
      )
    );
  };

  const generateManualInstallments = () => {
    const count = Math.max(1, formValues.totalInstallments || 1);
    const baseAmount = Math.floor(structuredTotal / count);
    const stepDays = getStepDays(formValues.frequency);
    let remaining = structuredTotal;
    const nextInstallments = Array.from({ length: count }, (_, index) => {
      const amount = index === count - 1 ? remaining : baseAmount;
      remaining -= amount;
      return createManualInstallmentDraft(addDays(formValues.startDate, index * stepDays), amount);
    });
    setManualInstallments(nextInstallments);
  };

  return (
    <>
      <Form
        className="space-y-4"
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        validationBehavior="aria"
      >
        {onSubmitStructured && (
          <Tabs
            aria-label="Tipo de préstamo"
            onSelectionChange={(key) =>
              setMode(String(key) === "structured" ? "structured" : "classic")
            }
            selectedKey={mode}
          >
            <Tabs.ListContainer>
              <Tabs.List
                aria-label="Tipo de creación"
                className="rounded-lg border border-default-200/60 bg-background/70 p-1"
              >
                <Tabs.Tab id="classic">
                  Clásico
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="structured">
                  Por fuentes
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        )}

        <div className={GRID_2_COL_MD}>
          <form.Field name="title">
            {(field) => (
              <LoanInputField
                error={formatErrors(field.state.meta.errors) || undefined}
                isInvalid={field.state.meta.errors.length > 0}
                label="Título"
                minLength={1}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                required
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="counterpartId">
            {(field) => (
              <div className="space-y-2">
                <Select
                  isDisabled={isLoadingCounterparts}
                  isInvalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(key) => {
                    const nextKey = String(key);
                    const nextId = nextKey === "none" ? null : Number(nextKey);
                    field.handleChange(
                      typeof nextId === "number" && Number.isFinite(nextId) ? nextId : null
                    );
                    const nextCounterpart = counterparts.find((item) => item.id === nextId);
                    if (nextCounterpart) {
                      form.setFieldValue("borrowerName", nextCounterpart.bankAccountHolder);
                    }
                  }}
                  value={field.state.value == null ? "none" : String(field.state.value)}
                >
                  <Label>Beneficiario (contraparte)</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="none" key="none" textValue="Sin contraparte">
                        Sin contraparte
                      </ListBox.Item>
                      {counterparts.map((counterpart) => (
                        <ListBox.Item
                          id={String(counterpart.id)}
                          key={counterpart.id}
                          textValue={`${counterpart.bankAccountHolder} ${counterpart.identificationNumber}`}
                        >
                          <div className="flex flex-col">
                            <span>{counterpart.bankAccountHolder}</span>
                            <span className="text-default-500 text-xs">
                              {counterpart.identificationNumber}
                            </span>
                          </div>
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                  )}
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onPress={() => {
                      setCounterpartError(null);
                      setIsCounterpartModalOpen(true);
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Crear contraparte
                  </Button>
                  {selectedCounterpart && (
                    <span className="text-default-500 text-xs">
                      RUT {selectedCounterpart.identificationNumber}
                    </span>
                  )}
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="borrowerName">
            {(field) => (
              <LoanInputField
                error={formatErrors(field.state.meta.errors) || undefined}
                isInvalid={field.state.meta.errors.length > 0}
                label="Beneficiario"
                minLength={1}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                required
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="borrowerType">
            {(field) => (
              <div>
                <Select
                  isInvalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(key) => {
                    field.handleChange(key as "COMPANY" | "PERSON");
                  }}
                  value={field.state.value}
                >
                  <Label>Tipo de Deudor</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="PERSON" key="PERSON">
                        Persona
                      </ListBox.Item>
                      <ListBox.Item id="COMPANY" key="COMPANY">
                        Empresa
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                  )}
                </Select>
              </div>
            )}
          </form.Field>

          {mode === "classic" && (
            <>
              <form.Field name="principalAmount">
                {(field) => (
                  <NumberField
                    isInvalid={field.state.meta.errors.length > 0}
                    minValue={0.01}
                    onBlur={field.handleBlur}
                    onChange={(value) => {
                      field.handleChange(value ?? 0);
                    }}
                    step={0.01}
                    value={field.state.value || 0}
                  >
                    <Label>Monto Principal</Label>
                    <HeroInput variant="secondary" />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                    )}
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="interestRate">
                {(field) => (
                  <NumberField
                    isInvalid={field.state.meta.errors.length > 0}
                    minValue={0}
                    maxValue={100}
                    step={0.01}
                    value={field.state.value || 0}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                  >
                    <Label>Tasa de Interés Anual (%)</Label>
                    <HeroInput variant="secondary" />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                    )}
                  </NumberField>
                )}
              </form.Field>
            </>
          )}

          {mode === "classic" && (
            <form.Field name="interestType">
              {(field) => (
                <div>
                  <Select
                    isInvalid={field.state.meta.errors.length > 0}
                    onBlur={field.handleBlur}
                    onChange={(key) => {
                      field.handleChange(key as "COMPOUND" | "SIMPLE");
                    }}
                    value={field.state.value}
                  >
                    <Label>Tipo de Interés</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="SIMPLE" key="SIMPLE">
                          Simple
                        </ListBox.Item>
                        <ListBox.Item id="COMPOUND" key="COMPOUND">
                          Compuesto
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                    )}
                  </Select>
                </div>
              )}
            </form.Field>
          )}

          <form.Field name="frequency">
            {(field) => (
              <div>
                <Select
                  isInvalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(key) => {
                    field.handleChange(key as "BIWEEKLY" | "IRREGULAR" | "MONTHLY" | "WEEKLY");
                  }}
                  value={field.state.value}
                >
                  <Label>Frecuencia de Pago</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="WEEKLY" key="WEEKLY">
                        Semanal
                      </ListBox.Item>
                      <ListBox.Item id="BIWEEKLY" key="BIWEEKLY">
                        Quincenal
                      </ListBox.Item>
                      <ListBox.Item id="MONTHLY" key="MONTHLY">
                        Mensual
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                  )}
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="totalInstallments">
            {(field) => (
              <NumberField
                isInvalid={field.state.meta.errors.length > 0}
                maxValue={360}
                minValue={1}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value ?? 1);
                }}
                step={1}
                value={field.state.value || 1}
              >
                <Label>Número de Términos</Label>
                <HeroInput variant="secondary" />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                )}
              </NumberField>
            )}
          </form.Field>

          <form.Field name="startDate">
            {(field) => (
              <AppDatePicker
                label="Fecha de Inicio"
                isInvalid={field.state.meta.errors.length > 0}
                isRequired
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value);
                }}
                value={field.state.value}
                errorMessage={
                  field.state.meta.errors.length > 0
                    ? formatErrors(field.state.meta.errors)
                    : undefined
                }
              />
            )}
          </form.Field>

          {mode === "classic" && (
            <form.Field name="generateSchedule">
              {(field) => (
                <div>
                  <Checkbox isSelected={field.state.value} onChange={field.handleChange}>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <Label>Generar cronograma automáticamente</Label>
                    </Checkbox.Content>
                  </Checkbox>

                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
                  )}
                </div>
              )}
            </form.Field>
          )}
        </div>

        {mode === "structured" && (
          <section className="space-y-3 rounded-lg border border-default-200 bg-default-50 p-4">
            <header className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Fuentes del préstamo</h3>
                <p className="text-default-500 text-xs">
                  Total generado ${structuredTotal.toLocaleString("es-CL")}
                </p>
              </div>
              <Button
                onPress={() => setSources((current) => [...current, createSourceDraft()])}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Plus aria-hidden="true" className="size-4" />
                Agregar fuente
              </Button>
            </header>
            <div className="space-y-3">
              {sources.map((source, index) => (
                <div
                  className="grid gap-3 rounded-md border border-default-200 bg-background p-3 md:grid-cols-[1.2fr,0.8fr,0.8fr,0.8fr,0.8fr,auto]"
                  key={source.id}
                >
                  <TextField
                    onChange={(value) =>
                      updateSource(source.id, {
                        label: value,
                      })
                    }
                    value={source.label}
                  >
                    <Label>Origen</Label>
                    <HeroInput
                      placeholder="Tarjeta Santander, efectivo, Valeria..."
                      variant="secondary"
                    />
                  </TextField>
                  <Select
                    onChange={(key) =>
                      updateSource(source.id, {
                        sourceType: key as SourceDraft["sourceType"],
                      })
                    }
                    value={source.sourceType}
                  >
                    <Label>Tipo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="PERSON_LOAN">Persona</ListBox.Item>
                        <ListBox.Item id="CREDIT_CARD">Tarjeta</ListBox.Item>
                        <ListBox.Item id="BANK_CREDIT">Banco</ListBox.Item>
                        <ListBox.Item id="TRANSFER">Transferencia</ListBox.Item>
                        <ListBox.Item id="OTHER">Otro</ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <NumberField
                    minValue={0}
                    onChange={(value) =>
                      updateSource(source.id, {
                        principalAmount: value ?? 0,
                      })
                    }
                    value={source.principalAmount}
                  >
                    <Label>Capital</Label>
                    <HeroInput variant="secondary" />
                  </NumberField>
                  <NumberField
                    minValue={0}
                    onChange={(value) =>
                      updateSource(source.id, {
                        fixedInterestRate: value ?? 0,
                      })
                    }
                    value={source.fixedInterestRate}
                  >
                    <Label>Interés fijo %</Label>
                    <HeroInput variant="secondary" />
                  </NumberField>
                  <NumberField
                    minValue={0}
                    onChange={(value) =>
                      updateSource(source.id, {
                        feeAmount: value ?? 0,
                      })
                    }
                    value={source.feeAmount}
                  >
                    <Label>Comisión</Label>
                    <HeroInput variant="secondary" />
                  </NumberField>
                  <div className="flex min-w-28 flex-col justify-end gap-2">
                    <span className="text-default-500 text-xs">
                      ${sourceTotals[index]?.total.toLocaleString("es-CL") ?? 0}
                    </span>
                    <Button
                      isDisabled={sources.length === 1}
                      onPress={() =>
                        setSources((current) => current.filter((item) => item.id !== source.id))
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Quitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {mode === "structured" && (
          <section className="space-y-3 rounded-lg border border-default-200 bg-default-50 p-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Cronograma</h3>
                <p className="text-default-500 text-xs">
                  Esperado ${manualExpectedTotal.toLocaleString("es-CL")} · Pagado $
                  {manualPaidTotal.toLocaleString("es-CL")}
                </p>
              </div>
              <Tabs
                aria-label="Modo de cronograma"
                onSelectionChange={(key) =>
                  setStructuredScheduleMode(String(key) === "manual" ? "manual" : "equal")
                }
                selectedKey={structuredScheduleMode}
              >
                <Tabs.ListContainer>
                  <Tabs.List
                    aria-label="Modo"
                    className="rounded-lg border border-default-200/60 bg-background/70 p-1"
                  >
                    <Tabs.Tab id="equal">
                      Cuotas iguales
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="manual">
                      Manual
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            </header>

            {structuredScheduleMode === "equal" ? (
              <div className="grid gap-3 rounded-md border border-default-200 bg-background p-3 sm:grid-cols-3">
                <div>
                  <Label className="text-default-500 text-xs">Total</Label>
                  <p className="font-semibold text-foreground">
                    ${structuredTotal.toLocaleString("es-CL")}
                  </p>
                </div>
                <div>
                  <Label className="text-default-500 text-xs">Cuotas</Label>
                  <p className="font-semibold text-foreground">{formValues.totalInstallments}</p>
                </div>
                <div>
                  <Label className="text-default-500 text-xs">Primera cuota</Label>
                  <p className="font-semibold text-foreground">
                    {formatChile(formValues.startDate, "DD MMM YYYY")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span
                      className={
                        manualDelta === 0
                          ? "font-semibold text-success"
                          : "font-semibold text-warning"
                      }
                    >
                      Diferencia ${manualDelta.toLocaleString("es-CL")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onPress={generateManualInstallments}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Generar cuotas
                    </Button>
                    <Button
                      onPress={() =>
                        setManualInstallments((current) => [
                          ...current,
                          createManualInstallmentDraft(
                            current.at(-1)?.dueDate
                              ? addDays(current.at(-1)?.dueDate ?? formValues.startDate, 7)
                              : formValues.startDate
                          ),
                        ])
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Agregar cuota
                    </Button>
                  </div>
                </div>

                {manualInstallments.map((installment, installmentIndex) => {
                  const paidTotal = installment.payments.reduce(
                    (sum, payment) => sum + payment.amount,
                    0
                  );
                  return (
                    <div
                      className="space-y-3 rounded-md border border-default-200 bg-background p-3"
                      key={installment.id}
                    >
                      <div className="grid gap-3 md:grid-cols-[0.4fr,0.9fr,0.8fr,0.8fr,0.7fr,1fr,auto]">
                        <div className="flex items-end">
                          <span className="rounded-md bg-default-100 px-2 py-1 font-semibold text-default-600 text-xs">
                            #{installmentIndex + 1}
                          </span>
                        </div>
                        <AppDatePicker
                          label="Vencimiento"
                          onChange={(value) =>
                            updateInstallment(installment.id, { dueDate: value })
                          }
                          value={installment.dueDate}
                        />
                        <LoanMoneyField
                          label="Cuota"
                          onChange={(value) =>
                            updateInstallment(installment.id, { expectedAmount: value })
                          }
                          value={installment.expectedAmount}
                        />
                        <LoanMoneyField
                          label="Interés"
                          onChange={(value) =>
                            updateInstallment(installment.id, { expectedInterest: value })
                          }
                          value={installment.expectedInterest}
                        />
                        <div className="flex flex-col justify-end">
                          <Label className="text-default-500 text-xs">Capital</Label>
                          <p className="font-semibold text-foreground text-sm">
                            $
                            {Math.max(
                              0,
                              installment.expectedAmount - installment.expectedInterest
                            ).toLocaleString("es-CL")}
                          </p>
                        </div>
                        <TextField
                          onChange={(value) => updateInstallment(installment.id, { note: value })}
                          value={installment.note}
                        >
                          <Label>Nota cuota</Label>
                          <HeroInput variant="secondary" />
                        </TextField>
                        <div className="flex items-end">
                          <Button
                            isDisabled={manualInstallments.length === 1}
                            onPress={() =>
                              setManualInstallments((current) =>
                                current.filter((item) => item.id !== installment.id)
                              )
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                            Quitar
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-default-200 border-t pt-3">
                        <span className="text-default-500 text-xs">
                          Pagos ${paidTotal.toLocaleString("es-CL")}
                        </span>
                        <Button
                          onPress={() =>
                            setManualInstallments((current) =>
                              current.map((item) =>
                                item.id === installment.id
                                  ? {
                                      ...item,
                                      payments: [
                                        ...item.payments,
                                        createPaymentDraft(item.dueDate),
                                      ],
                                    }
                                  : item
                              )
                            )
                          }
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <Plus aria-hidden="true" className="size-4" />
                          Agregar pago
                        </Button>
                      </div>

                      {installment.payments.length > 0 && (
                        <div className="space-y-2">
                          {installment.payments.map((payment) => (
                            <div
                              className="grid gap-2 rounded-md bg-default-50 p-2 md:grid-cols-[0.8fr,0.8fr,0.8fr,0.8fr,1fr,auto]"
                              key={payment.id}
                            >
                              <Select
                                onChange={(key) =>
                                  updatePayment(installment.id, payment.id, {
                                    kind: String(key) as PaymentKind,
                                  })
                                }
                                value={payment.kind}
                              >
                                <Label>Tipo</Label>
                                <Select.Trigger>
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox>
                                    <ListBox.Item id="PAYMENT">Pago</ListBox.Item>
                                    <ListBox.Item id="DISCOUNT">Descuento</ListBox.Item>
                                    <ListBox.Item id="ADJUSTMENT">Ajuste</ListBox.Item>
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                              <AppDatePicker
                                label="Fecha pago"
                                onChange={(value) =>
                                  updatePayment(installment.id, payment.id, { paidDate: value })
                                }
                                value={payment.paidDate}
                              />
                              <LoanMoneyField
                                label="Monto"
                                onChange={(value) =>
                                  updatePayment(installment.id, payment.id, { amount: value })
                                }
                                value={payment.amount}
                              />
                              <TextField
                                onChange={(value) =>
                                  updatePayment(installment.id, payment.id, {
                                    transactionId: value,
                                  })
                                }
                                value={payment.transactionId}
                              >
                                <Label>ID transacción</Label>
                                <HeroInput inputMode="numeric" variant="secondary" />
                              </TextField>
                              <TextField
                                onChange={(value) =>
                                  updatePayment(installment.id, payment.id, { note: value })
                                }
                                value={payment.note}
                              >
                                <Label>Nota pago</Label>
                                <HeroInput variant="secondary" />
                              </TextField>
                              <div className="flex items-end">
                                <Button
                                  onPress={() =>
                                    setManualInstallments((current) =>
                                      current.map((item) =>
                                        item.id === installment.id
                                          ? {
                                              ...item,
                                              payments: item.payments.filter(
                                                (itemPayment) => itemPayment.id !== payment.id
                                              ),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  <Trash2 aria-hidden="true" className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <form.Field name="notes">
          {(field) => (
            <LoanInputField
              as="textarea"
              error={formatErrors(field.state.meta.errors) || undefined}
              isInvalid={field.state.meta.errors.length > 0}
              label="Descripción"
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              rows={3}
              value={field.state.value ?? ""}
            />
          )}
        </form.Field>

        {hasErrors && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Description>
                Por favor corrige los errores en el formulario antes de continuar.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <div className="flex justify-end gap-3">
          <Button
            isDisabled={form.state.isSubmitting}
            onPress={onCancel}
            type="button"
            variant="secondary"
          >
            Cancelar
          </Button>
          <Button
            isDisabled={form.state.isSubmitting || !form.state.canSubmit || !canSubmitStructured}
            type="submit"
          >
            {form.state.isSubmitting ? "Creando..." : "Crear préstamo"}
          </Button>
        </div>
      </Form>

      <Modal>
        <Modal.Backdrop
          isOpen={isCounterpartModalOpen}
          onOpenChange={(open) => {
            setIsCounterpartModalOpen(open);
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>Nueva contraparte</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                <CounterpartForm
                  defaultCategory="LENDER"
                  error={counterpartError}
                  onSave={async (payload: CounterpartUpsertPayload) => {
                    try {
                      await createCounterpartMutation.mutateAsync(payload);
                    } catch (error) {
                      setCounterpartError(
                        error instanceof Error ? error.message : "No se pudo crear la contraparte"
                      );
                    }
                  }}
                  saving={createCounterpartMutation.isPending}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
