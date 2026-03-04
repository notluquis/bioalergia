import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Check } from "lucide-react";
import { useState } from "react";
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
  readonly iconOnly?: boolean;
}

export function PayInstallmentModal({
  creditId,
  installment,
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

      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setOpen(false);
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>{`Pagar Cuota #${installment.installmentNumber}`}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                <div className="mb-4 text-gray-500 text-sm">
                  Registrar pago de la cuota vencida el{" "}
                  {dayjs(installment.dueDate, "YYYY-MM-DD").format("DD/MM/YYYY")}.
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void form.handleSubmit();
                  }}
                >
                  <form.Field name="amount">
                    {(field) => (
                      <div>
                        <TextField
                          isInvalid={field.state.meta.errors.length > 0}
                          isRequired
                          type="number"
                        >
                          <Label>Monto Pagado</Label>
                          <Input
                            onBlur={field.handleBlur}
                            onChange={(e) => {
                              field.handleChange(Number.parseFloat(e.target.value));
                            }}
                            value={String(field.state.value)}
                          />
                          {field.state.meta.errors.length > 0 && (
                            <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                          )}
                        </TextField>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="paymentDate">
                    {(field) => (
                      <div>
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
                        </DatePicker>

                        {field.state.meta.errors.length > 0 && (
                          <p className="mt-1 text-danger text-xs">
                            {field.state.meta.errors.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>

                  <div className="mt-6 flex justify-end gap-3">
                    <Button
                      isDisabled={mutation.isPending}
                      onPress={() => {
                        setOpen(false);
                      }}
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                    <Button isPending={mutation.isPending} type="submit">
                      {mutation.isPending ? "Pagando..." : "Confirmar Pago"}
                    </Button>
                  </div>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
