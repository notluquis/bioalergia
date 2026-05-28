import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  FieldError,
  Label,
  NumberField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Check } from "lucide-react";
import { useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { toast } from "@/lib/toast-interceptor";

import { personalFinanceApi } from "../api";
import { personalFinanceKeys } from "../queries";
import {
  type PayInstallmentInput,
  type PersonalCreditInstallment,
  payInstallmentSchema,
} from "../types";

interface PayInstallmentModalProps {
  readonly creditId: number;
  readonly installment: PersonalCreditInstallment;
  /** Credit currency (CLP/UF/USD) — drives amount field formatting. */
  readonly currency: string;
  readonly iconOnly?: boolean;
}

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

export function PayInstallmentModal({
  creditId,
  installment,
  currency,
  iconOnly = false,
}: PayInstallmentModalProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: PayInstallmentInput) =>
      personalFinanceApi.payInstallment(creditId, installment.installmentNumber, data),
    onError: (error) => {
      toast.error("Error al pagar cuota");
      console.error(error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personalFinanceKeys.credit(creditId) });
      toast.success("Cuota pagada exitosamente");
      setOpen(false);
    },
  });

  const form = useForm({
    defaultValues: {
      amount: Number(installment.amount),
      paymentDate: dayjs().format("YYYY-MM-DD"),
    } as PayInstallmentInput,
    onSubmit: ({ value }) => {
      mutation.mutate(value);
    },
    validators: {
      onChange: payInstallmentSchema,
    },
  });

  return (
    <>
      <Button
        onPress={() => {
          setOpen(true);
        }}
        size="sm"
        variant="outline"
        className={iconOnly ? "size-8 p-0 flex items-center justify-center" : ""}
      >
        {iconOnly ? <Check className="size-4" /> : "Pagar"}
      </Button>

      <AppModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
        }}
        title={`Pagar Cuota #${installment.installmentNumber}`}
        size="md"
        footer={
          <>
            <Button
              isDisabled={mutation.isPending}
              onPress={() => {
                setOpen(false);
              }}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button isPending={mutation.isPending} type="submit" form="pay-installment-form">
              {mutation.isPending ? "Pagando..." : "Confirmar Pago"}
            </Button>
          </>
        }
      >
        <div className="mb-4 text-muted text-sm">
          Registrar pago de la cuota vencida el{" "}
          {dayjs(installment.dueDate, "YYYY-MM-DD").format("DD/MM/YYYY")}.
        </div>

        <form
          id="pay-installment-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="amount">
            {(field) => (
              <NumberField
                isInvalid={field.state.meta.errors.length > 0}
                isRequired
                formatOptions={amountFormatOptions(currency)}
                minValue={0.01}
                onBlur={field.handleBlur}
                onChange={(value) => field.handleChange(value ?? 0)}
                value={field.state.value}
              >
                <Label>Monto Pagado</Label>
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.map(String).join(", ")}</FieldError>
                )}
              </NumberField>
            )}
          </form.Field>

          <form.Field name="paymentDate">
            {(field) => (
              <DatePicker
                isRequired
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value?.toString() ?? "");
                }}
                value={field.state.value ? parseDate(field.state.value) : undefined}
              >
                <Label>Fecha de Pago</Label>
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

                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.map(String).join(", ")}</FieldError>
                )}
              </DatePicker>
            )}
          </form.Field>
        </form>
      </AppModal>
    </>
  );
}
