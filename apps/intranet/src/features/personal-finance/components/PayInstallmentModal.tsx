import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

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
}

export function PayInstallmentModal({ creditId, installment }: PayInstallmentModalProps) {
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
      paymentDate: new Date(),
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
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        variant="outline"
      >
        Pagar
      </Button>

      <Modal
        className="max-w-md"
        isOpen={open}
        onClose={() => {
          setOpen(false);
        }}
        title={`Pagar Cuota #${installment.installmentNumber}`}
      >
        <div className="mb-4 text-sm text-gray-500">
          Registrar pago de la cuota vencida el {new Date(installment.dueDate).toLocaleDateString()}
          .
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
                <Input
                  label="Monto Pagado"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(Number.parseFloat(e.target.value));
                  }}
                  required
                  type="number"
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="paymentDate">
            {(field) => (
              <div>
                <Input
                  label="Fecha de Pago"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(new Date(e.target.value));
                  }}
                  required
                  type="date"
                  value={field.state.value ? field.state.value.toISOString().split("T")[0] : ""}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-danger mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                setOpen(false);
              }}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button isLoading={mutation.isPending} type="submit">
              {mutation.isPending ? "Pagando..." : "Confirmar Pago"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
