import { Button, FieldError, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { PlusIcon } from "lucide-react";
import { toast } from "@/lib/toast-interceptor";

import { personalFinanceApi } from "../api";
import { personalFinanceKeys } from "../queries";
import { type CreateCreditInput, createCreditSchema } from "../types";

export function CreateCreditForm() {
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
    <Modal>
      <Button>
        <PlusIcon className="size-4" />
        Nuevo Crédito
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Crear Nuevo Crédito</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
              >
                <form.Field name="bankName">
                  {(field) => (
                    <TextField isRequired name="bankName">
                      <Label>Banco / Institución</Label>
                      <Input
                        placeholder="Ej: BCI"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                      )}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="creditNumber">
                  {(field) => (
                    <TextField isRequired name="creditNumber">
                      <Label>Número / Identificador</Label>
                      <Input
                        placeholder="Ej: 123456"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                      )}
                    </TextField>
                  )}
                </form.Field>

                <form.Field name="description">
                  {(field) => (
                    <TextField isRequired name="description">
                      <Label>Descripción</Label>
                      <Input
                        placeholder="Ej: Crédito Hipotecario"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                      )}
                    </TextField>
                  )}
                </form.Field>

                <div className="grid grid-cols-2 gap-4">
                  <form.Field name="totalAmount">
                    {(field) => (
                      <TextField isRequired name="totalAmount">
                        <Label>Monto Total</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={field.state.value.toString()}
                          onChange={(e) =>
                            field.handleChange(Number.parseFloat(e.target.value) || 0)
                          }
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                        )}
                      </TextField>
                    )}
                  </form.Field>

                  <form.Field name="currency">
                    {(field) => (
                      <Select
                        className="w-full"
                        placeholder="Selecciona moneda"
                        selectedKey={field.state.value}
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
                      <TextField isRequired name="totalInstallments">
                        <Label>Cuotas</Label>
                        <Input
                          type="number"
                          placeholder="1"
                          min="1"
                          value={field.state.value.toString()}
                          onChange={(e) =>
                            field.handleChange(Number.parseInt(e.target.value, 10) || 1)
                          }
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                        )}
                      </TextField>
                    )}
                  </form.Field>

                  <form.Field name="startDate">
                    {(field) => (
                      <TextField isRequired name="startDate">
                        <Label>Fecha Inicio</Label>
                        <Input
                          type="date"
                          value={field.state.value || ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                        )}
                      </TextField>
                    )}
                  </form.Field>
                </div>

                <div className="mt-4 flex justify-end gap-3">
                  <Button slot="close" variant="secondary">
                    Cancelar
                  </Button>
                  <Button type="submit" isDisabled={mutation.isPending}>
                    {mutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
