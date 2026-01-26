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
    onError: (error) => {
      toast.error("Error al crear crédito");
      console.error(error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: personalFinanceKeys.all });
      toast.success("Crédito creado exitosamente");
      setOpen(false);
      form.reset();
    },
  });

  const form = useForm({
    defaultValues: {
      bankName: "",
      creditNumber: "",
      currency: "CLP" as const,
      description: "",
      startDate: new Date(),
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
        onClick={() => {
          setOpen(true);
        }}
      >
        <PlusIcon className="mr-2 size-4" />
        Nuevo Crédito
      </Button>

      <Modal
        className="max-w-xl"
        isOpen={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Crear Nuevo Crédito"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="bankName">
            {(field) => (
              <div>
                <Input
                  error={field.state.meta.errors.join(", ")}
                  label="Banco / Institución"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="Ej: BCI"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="creditNumber">
            {(field) => (
              <div>
                <Input
                  error={field.state.meta.errors.join(", ")}
                  label="Número / Identificador"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="Ej: 123456"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div>
                <Input
                  error={field.state.meta.errors.join(", ")}
                  label="Descripción"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="Ej: Crédito Hipotecario"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="totalAmount">
              {(field) => (
                <div>
                  <Input
                    error={field.state.meta.errors.join(", ")}
                    label="Monto Total"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(Number.parseFloat(e.target.value) || 0);
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="currency">
              {(field) => (
                <div>
                  <Input
                    as="select"
                    error={field.state.meta.errors.join(", ")}
                    label="Moneda"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value as "CLP" | "UF" | "USD");
                    }}
                    value={field.state.value}
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
                    error={field.state.meta.errors.join(", ")}
                    label="Cuotas"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(Number.parseInt(e.target.value, 10) || 1);
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="startDate">
              {(field) => (
                <div>
                  <Input
                    error={field.state.meta.errors.join(", ")}
                    label="Fecha Inicio"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(new Date(e.target.value));
                    }}
                    type="date"
                    value={
                      field.state.value
                        ? new Date(field.state.value).toISOString().split("T")[0]
                        : ""
                    }
                  />
                </div>
              )}
            </form.Field>
          </div>

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
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
