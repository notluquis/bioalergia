import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
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

  const mutation = useMutation({
    mutationFn: personalFinanceApi.createCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalFinanceKeys.all });
      toast.success("Crédito creado exitosamente");
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Error al crear crédito");
      console.error(error);
    },
  });

  const form = useForm({
    defaultValues: {
      currency: "CLP" as const,
      totalInstallments: 1,
      bankName: "",
      creditNumber: "",
      description: "",
      totalAmount: 0,
      startDate: new Date(),
    } as CreateCreditInput,
    validators: {
      onChange: createCreditSchema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="mr-2 size-4" />
        Nuevo Crédito
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Crear Nuevo Crédito" className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="bankName">
            {(field) => (
              <div>
                <Input
                  label="Banco / Institución"
                  placeholder="Ej: BCI"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.join(", ")}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="creditNumber">
            {(field) => (
              <div>
                <Input
                  label="Número / Identificador"
                  placeholder="Ej: 123456"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.join(", ")}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div>
                <Input
                  label="Descripción"
                  placeholder="Ej: Crédito Hipotecario"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.join(", ")}
                />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="totalAmount">
              {(field) => (
                <div>
                  <Input
                    type="number"
                    label="Monto Total"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="currency">
              {(field) => (
                <div>
                  <Input
                    as="select"
                    label="Moneda"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as "CLP" | "UF" | "USD")}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  >
                    <option value="CLP">CLP</option>
                    <option value="UF">UF</option>
                    <option value="USD">USD</option>
                  </Input>
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="totalInstallments">
              {(field) => (
                <div>
                  <Input
                    type="number"
                    label="Cuotas"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number.parseInt(e.target.value) || 1)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="startDate">
              {(field) => (
                <div>
                  <Input
                    type="date"
                    label="Fecha Inicio"
                    value={field.state.value ? new Date(field.state.value).toISOString().split("T")[0] : ""}
                    onChange={(e) => field.handleChange(new Date(e.target.value))}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                </div>
              )}
            </form.Field>
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
