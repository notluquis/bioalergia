import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

import { personalFinanceApi } from "../api";
import { personalFinanceKeys } from "../queries";
import { type PayInstallmentInput, payInstallmentSchema, type PersonalCreditInstallment } from "../types";

interface PayInstallmentModalProps {
  creditId: number;
  installment: PersonalCreditInstallment;
}

export function PayInstallmentModal({ creditId, installment }: PayInstallmentModalProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: PayInstallmentInput) =>
      personalFinanceApi.payInstallment(creditId, installment.installmentNumber, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalFinanceKeys.credit(creditId) });
      toast.success("Cuota pagada exitosamente");
      setOpen(false);
    },
    onError: (error) => {
      toast.error("Error al pagar cuota");
      console.error(error);
    },
  });

  const form = useForm({
    defaultValues: {
      amount: Number(installment.amount),
      paymentDate: new Date(),
    } as PayInstallmentInput,
    validators: {
      onChange: payInstallmentSchema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Pagar
      </Button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Pagar Cuota #${installment.installmentNumber}`}
        className="max-w-md"
      >
        <div className="mb-4 text-sm text-gray-500">
          Registrar pago de la cuota vencida el {new Date(installment.dueDate).toLocaleDateString()}.
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="amount">
            {(field) => (
              <div>
                <Input
                  type="number"
                  label="Monto Pagado"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number.parseFloat(e.target.value))}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="paymentDate">
            {(field) => (
              <div>
                <Input
                  type="date"
                  label="Fecha de Pago"
                  required
                  value={field.state.value ? field.state.value.toISOString().split("T")[0] : ""}
                  onChange={(e) => field.handleChange(new Date(e.target.value))}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
                )}
              </div>
            )}
          </form.Field>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              {mutation.isPending ? "Pagando..." : "Confirmar Pago"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
