import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

import { personalFinanceApi } from "../api";
import { personalFinanceKeys } from "../queries";
import { type CreateCreditInput, createCreditSchema } from "../types";

export function CreateCreditForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateCreditInput>({
    resolver: zodResolver(createCreditSchema) as any, // Cast to avoid strict undefined checks on optional fields
    defaultValues: {
      currency: "CLP",
      totalInstallments: 1,
      bankName: "",
      creditNumber: "",
      description: "",
      totalAmount: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: personalFinanceApi.createCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalFinanceKeys.all });
      toast.success("Crédito creado exitosamente");
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error("Error al crear crédito");
      console.error(error);
    },
  });

  const onSubmit = (data: CreateCreditInput) => {
    mutation.mutate(data);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="mr-2 size-4" />
        Nuevo Crédito
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Crear Nuevo Crédito" className="max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Banco / Institución"
            placeholder="Ej: BCI"
            error={errors.bankName?.message}
            {...register("bankName")}
          />

          <Input
            label="Número / Identificador"
            placeholder="Ej: 123456"
            error={errors.creditNumber?.message}
            {...register("creditNumber")}
          />

          <Input
            label="Descripción"
            placeholder="Ej: Crédito Hipotecario"
            error={errors.description?.message}
            {...register("description")}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Monto Total"
              error={errors.totalAmount?.message}
              {...register("totalAmount", { valueAsNumber: true })}
            />

            <Input as="select" label="Moneda" error={errors.currency?.message} {...register("currency")}>
              <option value="CLP">CLP</option>
              <option value="UF">UF</option>
              <option value="USD">USD</option>
            </Input>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Cuotas"
              error={errors.totalInstallments?.message}
              {...register("totalInstallments", { valueAsNumber: true })}
            />

            <Input
              type="date"
              label="Fecha Inicio"
              error={errors.startDate?.message && "La fecha es obligatoria"}
              {...register("startDate", { valueAsDate: true })}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
