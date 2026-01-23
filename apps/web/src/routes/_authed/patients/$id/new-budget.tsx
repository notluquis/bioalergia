import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { apiClient } from "@/lib/api-client";
import { PAGE_CONTAINER } from "@/lib/styles";

export const Route = createFileRoute("/_authed/patients/$id/new-budget")({
  staticData: {
    permission: { action: "create", subject: "Budget" },
    title: "Nuevo Presupuesto",
    hideFromNav: true,
  },
  component: NewBudgetPage,
});

const budgetItemSchema = z.object({
  description: z.string().min(1, "Descripción requerida"),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

const budgetSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  discount: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(budgetItemSchema).min(1, "Debe agregar al menos un ítem"),
});

type BudgetForm = z.infer<typeof budgetSchema>;

function NewBudgetPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: BudgetForm) => {
      return await apiClient.post(`/api/patients/${id}/budgets`, data);
    },
    onSuccess: () => {
      toast.success("Presupuesto creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      navigate({ to: "/patients/$id", params: { id: String(id) } });
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo crear el presupuesto"}`,
      );
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      discount: 0,
      notes: "",
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    } as BudgetForm,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <div className={PAGE_CONTAINER}>
      <header className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
          className="gap-2"
        >
          <ChevronLeft size={20} />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Presupuesto</h1>
          <p className="text-default-500 text-sm">Cruce de servicios y valores estimados</p>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="title">
              {(field) => (
                <Input
                  label="Título del Presupuesto"
                  placeholder="Ej: Tratamiento Ortodoncia"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>

            <form.Field name="discount">
              {(field) => (
                <MoneyInput
                  label="Descuento Global"
                  value={field.state.value}
                  onValueChange={(v: number | null) => field.handleChange(v || 0)}
                  error={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>
          </div>

          <form.Field name="notes">
            {(field) => (
              <label className="space-y-1 block">
                <span className="text-sm font-medium text-default-600">Notas / Observaciones</span>
                <textarea
                  className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Información adicional para el paciente..."
                />
              </label>
            )}
          </form.Field>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Ítems del Presupuesto</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() =>
                form.pushFieldValue("items", { description: "", quantity: 1, unitPrice: 0 })
              }
            >
              <Plus size={16} />
              Agregar Ítem
            </Button>
          </div>

          <div className="space-y-4">
            <form.Field name="items" mode="array">
              {(field) => (
                <div className="space-y-4">
                  {field.state.value.map((_, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-3 items-end border-b border-default-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <form.Field name={`items[${index}].description`}>
                          {(subField) => (
                            <Input
                              label="Descripción"
                              placeholder="Servicio o producto"
                              value={subField.state.value}
                              onChange={(e) => subField.handleChange(e.target.value)}
                              error={subField.state.meta.errors.join(", ")}
                            />
                          )}
                        </form.Field>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <form.Field name={`items[${index}].quantity`}>
                          {(subField) => (
                            <Input
                              type="number"
                              label="Cant."
                              value={subField.state.value}
                              onChange={(e) => subField.handleChange(Number(e.target.value))}
                            />
                          )}
                        </form.Field>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <form.Field name={`items[${index}].unitPrice`}>
                          {(subField) => (
                            <MoneyInput
                              label="Precio Unit."
                              value={subField.state.value}
                              onValueChange={(v: number | null) => subField.handleChange(v || 0)}
                            />
                          )}
                        </form.Field>
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-center pb-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          className="text-danger"
                          isDisabled={field.state.value.length === 1}
                          onClick={() => form.removeFieldValue("items", index)}
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
            variant="ghost"
            onClick={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending} className="gap-2">
            <Save size={18} />
            Crear Presupuesto
          </Button>
        </div>
      </form>
    </div>
  );
}
