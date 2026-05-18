import { Button, Card, FieldError, Form, Label, NumberField } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { createPatientBudget } from "@/features/patients/api";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

export const Route = createFileRoute("/_authed/patients/$id/new-budget")({
  staticData: {
    permission: { action: "create", subject: "Budget" },
    title: "Nuevo Presupuesto",
    hideFromNav: true,
  },
  component: NewBudgetPage,
});

const budgetItemSchema = z.object({
  clientId: z.string().optional(),
  description: z.string().min(1, "Descripción requerida"),
  quantity: z.number().min(1, "Cantidad debe ser al menos 1"), // UI + Zod validation
  unitPrice: z.number().min(0, "Precio unitario debe ser mayor o igual a 0"), // UI + Zod validation
});

const budgetSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  discount: z.number().min(0, "Descuento debe ser mayor o igual a 0"), // UI + Zod validation
  notes: z.string().optional(),
  items: z.array(budgetItemSchema).min(1, "Debe agregar al menos un ítem"),
});

type BudgetForm = z.infer<typeof budgetSchema>;

const createBudgetItem = () => ({
  clientId: globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random()}`,
  description: "",
  quantity: 1,
  unitPrice: 0,
});

function NewBudgetPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: BudgetForm) => {
      return await createPatientBudget({
        patientId: Number(id),
        title: data.title,
        discount: data.discount,
        notes: data.notes,
        items: data.items.map(({ clientId: _clientId, ...item }) => item),
      });
    },
    onSuccess: () => {
      toast.success("Presupuesto creado exitosamente");
      void queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void navigate({ to: "/patients/$id", params: { id: String(id) } });
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo crear el presupuesto"}`
      );
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      discount: 0,
      notes: "",
      items: [createBudgetItem()],
    } as BudgetForm,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6">
        <Button
          variant="outline"
          onPress={() => {
            void navigate({ to: "/patients/$id", params: { id: String(id) } });
          }}
          className="gap-2"
        >
          <ChevronLeft size={20} />
          Volver
        </Button>
      </div>

      <Form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-6"
        validationBehavior="aria"
      >
        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="title">
              {(field) => (
                <TanStackInputField
                  field={field}
                  label="Título del Presupuesto"
                  placeholder="Ej: Tratamiento Ortodoncia"
                />
              )}
            </form.Field>

            <form.Field name="discount">
              {(field) => (
                <NumberField
                  variant="secondary"
                  formatOptions={{
                    currency: "CLP",
                    currencyDisplay: "symbol",
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0,
                    style: "currency",
                  }}
                  isInvalid={field.state.meta.errors.length > 0}
                  minValue={0}
                  onBlur={field.handleBlur}
                  onChange={(value) => field.handleChange(value ?? 0)}
                  value={field.state.value}
                >
                  <Label>Descuento Global</Label>
                  <NumberField.Group>
                    <NumberField.Input />
                  </NumberField.Group>
                  {field.state.meta.errors.length > 0 ? (
                    <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                  ) : null}
                </NumberField>
              )}
            </form.Field>
          </div>

          <form.Field name="notes">
            {(field) => (
              <TanStackTextAreaField
                emptyAsUndefined
                field={field}
                label="Notas / Observaciones"
                placeholder="Información adicional para el paciente..."
                rows={2}
              />
            )}
          </form.Field>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Ítems del Presupuesto</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onPress={() => form.pushFieldValue("items", createBudgetItem())}
            >
              <Plus size={16} />
              Agregar Ítem
            </Button>
          </div>

          <div className="space-y-4">
            <form.Field name="items" mode="array">
              {(field) => (
                <div className="space-y-4">
                  {field.state.value.map((item, index) => (
                    <div
                      key={item.clientId ?? `item-${index}`}
                      className="grid grid-cols-12 items-end gap-3 border-default-100 border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <form.Field name={`items[${index}].description`}>
                          {(subField) => (
                            <TanStackInputField
                              field={subField}
                              label="Descripción"
                              placeholder="Servicio o producto"
                            />
                          )}
                        </form.Field>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <form.Field name={`items[${index}].quantity`}>
                          {(subField) => (
                            <NumberField
                              variant="secondary"
                              isInvalid={subField.state.meta.errors.length > 0}
                              minValue={1}
                              onChange={(value) => subField.handleChange(value ?? 1)}
                              value={subField.state.value}
                            >
                              <Label>Cant.</Label>
                              <NumberField.Group>
                                <NumberField.Input />
                              </NumberField.Group>
                              {subField.state.meta.errors.length > 0 ? (
                                <FieldError>{subField.state.meta.errors.join(", ")}</FieldError>
                              ) : null}
                            </NumberField>
                          )}
                        </form.Field>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <form.Field name={`items[${index}].unitPrice`}>
                          {(subField) => (
                            <NumberField
                              variant="secondary"
                              formatOptions={{
                                currency: "CLP",
                                currencyDisplay: "symbol",
                                maximumFractionDigits: 0,
                                minimumFractionDigits: 0,
                                style: "currency",
                              }}
                              isInvalid={subField.state.meta.errors.length > 0}
                              minValue={0}
                              onBlur={subField.handleBlur}
                              onChange={(value) => subField.handleChange(value ?? 0)}
                              value={subField.state.value}
                            >
                              <Label>Precio Unit.</Label>
                              <NumberField.Group>
                                <NumberField.Input />
                              </NumberField.Group>
                              {subField.state.meta.errors.length > 0 ? (
                                <FieldError>{subField.state.meta.errors.join(", ")}</FieldError>
                              ) : null}
                            </NumberField>
                          )}
                        </form.Field>
                      </div>
                      <div className="col-span-2 flex justify-center pb-2 sm:col-span-1">
                        <Button
                          variant="outline"
                          size="sm"
                          isIconOnly
                          className="text-danger"
                          isDisabled={field.state.value.length === 1}
                          onPress={() => {
                            void form.removeFieldValue("items", index);
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form.Field>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onPress={() => {
              void navigate({ to: "/patients/$id", params: { id: String(id) } });
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" isPending={mutation.isPending} className="gap-2">
            <Save size={18} />
            Crear Presupuesto
          </Button>
        </div>
      </Form>
    </div>
  );
}
