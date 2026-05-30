import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  FieldError,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { toast } from "@/lib/toast-interceptor";

import { personalFinanceApi } from "../api";
import { personalFinanceKeys } from "../queries";
import { type CreateCreditInput, createCreditSchema } from "../types";

/**
 * UF is not an ISO 4217 code, so `Intl.NumberFormat({ style: "currency" })`
 * throws on it. Mirror `lib/utils.ts::formatCurrency`: UF → decimal w/ 2
 * fraction digits, everything else → currency (CLP shows 0 decimals).
 */
function amountFormatOptions(currency: string): Intl.NumberFormatOptions {
  if (currency === "UF") {
    return { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 };
  }
  const fractionDigits = currency === "CLP" ? 0 : 2;
  return {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  };
}

export function CreateCreditForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: personalFinanceApi.createCredit,
    onError: (error) => {
      toast.error("Error al crear crédito");
      console.error(error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personalFinanceKeys.all });
      toast.success("Crédito creado exitosamente");
      form.reset();
      setOpen(false);
    },
  });

  const form = useForm({
    defaultValues: {
      bankName: "",
      creditNumber: "",
      currency: "CLP" as const,
      description: "",
      startDate: dayjs().format("YYYY-MM-DD"),
      totalAmount: 0,
      totalInstallments: 1,
    } as CreateCreditInput,
    onSubmit: ({ value }) => {
      // Validate with Zod schema before submitting
      const result = createCreditSchema.safeParse(value);
      if (!result.success) {
        toast.error(result.error.issues[0]?.message ?? "Error de validación");
        return;
      }
      mutation.mutate(value);
    },
  });

  return (
    <>
      <Button
        onPress={() => {
          setOpen(true);
        }}
      >
        <PlusIcon className="size-4" />
        Nuevo Crédito
      </Button>

      <AppModal
        isOpen={open}
        onClose={() => {
          if (mutation.isPending) return;
          setOpen(false);
        }}
        title="Crear Nuevo Crédito"
        size="md"
        footer={
          <>
            <Button
              isDisabled={mutation.isPending}
              onPress={() => {
                setOpen(false);
              }}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button form="create-credit-form" isDisabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </>
        }
      >
        <form
          id="create-credit-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="bankName">
            {(field) => (
              <TextField
                isRequired
                name="bankName"
                onChange={field.handleChange}
                value={field.state.value}
              >
                <Label>Banco / Institución</Label>
                <Input onBlur={field.handleBlur} placeholder="Ej: BCI" />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                )}
              </TextField>
            )}
          </form.Field>

          <form.Field name="creditNumber">
            {(field) => (
              <TextField
                isRequired
                name="creditNumber"
                onChange={field.handleChange}
                value={field.state.value}
              >
                <Label>Número / Identificador</Label>
                <Input onBlur={field.handleBlur} placeholder="Ej: 123456" />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                )}
              </TextField>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <TextField
                isRequired
                name="description"
                onChange={field.handleChange}
                value={field.state.value}
              >
                <Label>Descripción</Label>
                <Input onBlur={field.handleBlur} placeholder="Ej: Crédito Hipotecario" />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                )}
              </TextField>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Subscribe selector={(state) => state.values.currency}>
              {(currency) => (
                <form.Field name="totalAmount">
                  {(field) => (
                    <NumberField
                      isRequired
                      formatOptions={amountFormatOptions(currency)}
                      isInvalid={field.state.meta.errors.length > 0}
                      minValue={0.01}
                      onBlur={field.handleBlur}
                      onChange={(value) => field.handleChange(value ?? 0)}
                      value={field.state.value}
                    >
                      <Label>Monto Total</Label>
                      <NumberField.Group className="grid-cols-1">
                        <NumberField.Input />
                      </NumberField.Group>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                      )}
                    </NumberField>
                  )}
                </form.Field>
              )}
            </form.Subscribe>

            <form.Field name="currency">
              {(field) => (
                <Select
                  className="w-full"
                  placeholder="Selecciona moneda"
                  value={field.state.value || null}
                  onChange={(key) => {
                    field.handleChange(key as "CLP" | "UF" | "USD");
                  }}
                  onBlur={field.handleBlur}
                >
                  <Label>Moneda</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="CLP" textValue="CLP">
                        CLP
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="UF" textValue="UF">
                        UF
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="USD" textValue="USD">
                        USD
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                  )}
                </Select>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="totalInstallments">
              {(field) => (
                <NumberField
                  isRequired
                  isInvalid={field.state.meta.errors.length > 0}
                  minValue={1}
                  onBlur={field.handleBlur}
                  onChange={(value) => field.handleChange(value ?? 1)}
                  value={field.state.value}
                >
                  <Label>Cuotas</Label>
                  <NumberField.Group className="grid-cols-1">
                    <NumberField.Input />
                  </NumberField.Group>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                  )}
                </NumberField>
              )}
            </form.Field>

            <form.Field name="startDate">
              {(field) => (
                <DatePicker
                  isRequired
                  name="startDate"
                  onBlur={field.handleBlur}
                  onChange={(value) => {
                    field.handleChange(value?.toString() ?? "");
                  }}
                  value={field.state.value ? parseDate(field.state.value) : undefined}
                >
                  <Label>Fecha Inicio</Label>
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
                    <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                  )}
                  {/* max-w-none: HeroUI 3.1 clamps the popover to trigger width
                      (max-w-(--trigger-width)), so the fixed 252px calendar
                      overflows a narrow grid-cell field on mobile. Let it size
                      to the calendar; React Aria shifts it on-screen. Systemic
                      fix for all date pickers tracked separately. */}
                  <DatePicker.Popover className="max-w-none">
                    <Calendar aria-label="Fecha inicio">
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
                        <Calendar.GridBody>
                          {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
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
          </div>
        </form>
      </AppModal>
    </>
  );
}
