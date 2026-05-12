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
import dayjs from "dayjs";
import type React from "react";
import { z } from "zod";
import { zDateString } from "@/lib/api-validate";
import { formatErrors } from "@/lib/form-errors";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { CreateLoanPayload } from "../types";

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
}

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

export function LoanForm({ onCancel, onSubmit }: LoanFormProps) {
  const form = useForm({
    defaultValues: {
      borrowerName: "",
      borrowerType: "PERSON" as const,
      frequency: "WEEKLY" as const,
      generateSchedule: true,
      interestRate: 0,
      interestType: "SIMPLE" as const,
      notes: "",
      principalAmount: 0,
      startDate: dayjs().format("YYYY-MM-DD"),
      title: "",
      totalInstallments: 10,
    } as LoanFormData,
    onSubmit: async ({ value }) => {
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
      </div>

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
