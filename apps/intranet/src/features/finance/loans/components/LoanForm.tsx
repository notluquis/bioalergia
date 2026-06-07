import { formatChile } from "@/lib/dates";
import {
  Alert,
  Button,
  Calendar,
  Checkbox,
  DateField,
  DatePicker,
  FieldError,
  Form,
  Input as HeroInput,
  Label,
  ListBox,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm, useStore } from "@tanstack/react-form";
import type React from "react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { zDateString } from "@/lib/api-validate";
import { formatErrors } from "@/lib/form-errors";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { CreateLoanPayload, CreateStructuredLoanPayload } from "../types";

const loanFormSchema = z.object({
  borrowerName: z.string().trim().min(1, "El beneficiario es requerido"),
  borrowerType: z.enum(["PERSON", "COMPANY"]),
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

type SourceDraft = {
  feeAmount: number;
  fixedInterestRate: number;
  id: string;
  label: string;
  principalAmount: number;
  sourceType: "BANK_CREDIT" | "CREDIT_CARD" | "OTHER" | "PERSON_LOAN" | "TRANSFER";
};

const createSourceDraft = (): SourceDraft => ({
  feeAmount: 0,
  fixedInterestRate: 0,
  id: crypto.randomUUID(),
  label: "",
  principalAmount: 0,
  sourceType: "PERSON_LOAN",
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

export function LoanForm({ onCancel, onSubmit, onSubmitStructured }: LoanFormProps) {
  const [mode, setMode] = useState<LoanFormMode>("classic");
  const [sources, setSources] = useState<SourceDraft[]>([createSourceDraft()]);

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
        await onSubmitStructured({
          borrowerName: value.borrowerName,
          borrowerType: value.borrowerType,
          equalSchedule: {
            firstDueDate: value.startDate,
            frequency: value.frequency,
            installments: value.totalInstallments,
          },
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

  const hasErrors = useStore(form.store, (state) =>
    Object.values(state.fieldMeta).some((meta) => meta.errors.length > 0)
  );

  return (
    <Form
      className="space-y-4"
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      validationBehavior="aria"
    >
      {onSubmitStructured && (
        <div className="flex flex-wrap gap-2">
          <Button
            onPress={() => setMode("classic")}
            type="button"
            variant={mode === "classic" ? "primary" : "secondary"}
          >
            Clásico
          </Button>
          <Button
            onPress={() => setMode("structured")}
            type="button"
            variant={mode === "structured" ? "primary" : "secondary"}
          >
            Por fuentes
          </Button>
        </div>
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
                    <ListBox.Item id="IRREGULAR" key="IRREGULAR">
                      Irregular (cuotas variables)
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
            <DatePicker
              isInvalid={field.state.meta.errors.length > 0}
              isRequired
              onBlur={field.handleBlur}
              onChange={(value) => {
                field.handleChange(value?.toString() ?? "");
              }}
              value={field.state.value ? parseDate(field.state.value) : undefined}
            >
              <Label>Fecha de Inicio</Label>
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
              {field.state.meta.errors.length > 0 && (
                <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
              )}
              <DatePicker.Popover>
                <Calendar aria-label="Fecha de inicio">
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
                    setSources((current) =>
                      current.map((item) =>
                        item.id === source.id ? { ...item, label: value } : item
                      )
                    )
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
                    setSources((current) =>
                      current.map((item) =>
                        item.id === source.id
                          ? { ...item, sourceType: key as SourceDraft["sourceType"] }
                          : item
                      )
                    )
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
                    setSources((current) =>
                      current.map((item) =>
                        item.id === source.id ? { ...item, principalAmount: value ?? 0 } : item
                      )
                    )
                  }
                  value={source.principalAmount}
                >
                  <Label>Capital</Label>
                  <HeroInput variant="secondary" />
                </NumberField>
                <NumberField
                  minValue={0}
                  onChange={(value) =>
                    setSources((current) =>
                      current.map((item) =>
                        item.id === source.id ? { ...item, fixedInterestRate: value ?? 0 } : item
                      )
                    )
                  }
                  value={source.fixedInterestRate}
                >
                  <Label>Interés fijo %</Label>
                  <HeroInput variant="secondary" />
                </NumberField>
                <NumberField
                  minValue={0}
                  onChange={(value) =>
                    setSources((current) =>
                      current.map((item) =>
                        item.id === source.id ? { ...item, feeAmount: value ?? 0 } : item
                      )
                    )
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
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
        <Button isDisabled={form.state.isSubmitting || !form.state.canSubmit} type="submit">
          {form.state.isSubmitting ? "Creando..." : "Crear préstamo"}
        </Button>
      </div>
    </Form>
  );
}
