import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PayInstallmentInput>({
    resolver: zodResolver(payInstallmentSchema),
    defaultValues: {
      amount: Number(installment.amount),
      paymentDate: new Date(),
    },
  });

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

  const onSubmit = (data: PayInstallmentInput) => {
    mutation.mutate(data);
  };

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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            type="number"
            label="Monto Pagado"
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />

          <Input
            type="date"
            label="Fecha de Pago"
            error={errors.paymentDate?.message}
            {...register("paymentDate", { valueAsDate: true })}
          />

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
