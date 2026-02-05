import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select, SelectItem } from "@/components/ui/Select";
import { PatientBudgetListSchema, PatientPaymentSchema } from "@/features/patients/schemas";
import { apiClient } from "@/lib/api-client";
import { zDateString } from "@/lib/api-validate";
import { PAGE_CONTAINER } from "@/lib/styles";

export const Route = createFileRoute("/_authed/patients/$id/new-payment")({
  staticData: {
    permission: { action: "create", subject: "PatientPayment" },
    title: "Registrar Pago",
    hideFromNav: true,
  },
  component: NewPaymentPage,
});

const paymentSchema = z.object({
  budgetId: z.string().optional(),
  amount: z.number().positive("Monto debe ser mayor a 0"),
  paymentDate: zDateString,
  paymentMethod: z.enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

interface Budget {
  id: number;
  title: string;
  finalAmount: number;
}

function NewPaymentPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: budgets } = useQuery({
    queryKey: ["patient-budgets", id],
    queryFn: async () => {
      return await apiClient.get<Budget[]>(`/api/patients/${id}/budgets`, {
        responseSchema: PatientBudgetListSchema,
      });
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      return await apiClient.post(
        `/api/patients/${id}/payments`,
        {
          ...data,
          budgetId: data.budgetId ? Number(data.budgetId) : undefined,
          paymentDate: data.paymentDate,
        },
        { responseSchema: PatientPaymentSchema },
      );
    },
    onSuccess: () => {
      toast.success("Pago registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void navigate({ to: "/patients/$id", params: { id: String(id) } });
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo registrar el pago"}`,
      );
    },
  });

  const form = useForm<
    PaymentForm,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    unknown
  >({
    defaultValues: {
      budgetId: "",
      amount: 0,
      paymentDate: dayjs().format("YYYY-MM-DD"),
      paymentMethod: "Transferencia",
      reference: "",
      notes: "",
    },
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
          <h1 className="font-bold text-2xl text-foreground">Registrar Pago de Paciente</h1>
          <p className="text-default-500 text-sm">Registro de ingresos financieros por servicios</p>
        </div>
      </header>

      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="paymentDate">
              {(field) => (
                <Input
                  type="date"
                  label="Fecha de Pago"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>

            <form.Field name="amount">
              {(field) => (
                <MoneyInput
                  label="Monto Pagado"
                  value={field.state.value}
                  onValueChange={(v: number | null) => field.handleChange(v || 0)}
                  error={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>

            <form.Field name="paymentMethod">
              {(field) => (
                <Select
                  label="Método de Pago"
                  selectedKey={field.state.value}
                  onSelectionChange={(key) => {
                    if (key) {
                      field.handleChange(key as PaymentForm["paymentMethod"]);
                    }
                  }}
                >
                  <SelectItem key="Transferencia" textValue="Transferencia">
                    Transferencia
                  </SelectItem>
                  <SelectItem key="Efectivo" textValue="Efectivo">
                    Efectivo
                  </SelectItem>
                  <SelectItem key="Tarjeta" textValue="Tarjeta">
                    Tarjeta
                  </SelectItem>
                  <SelectItem key="Otro" textValue="Otro">
                    Otro/Varios
                  </SelectItem>
                </Select>
              )}
            </form.Field>

            <form.Field name="budgetId">
              {(field) => (
                <Select
                  label="Vincular a Presupuesto (Opcional)"
                  placeholder="Seleccione un presupuesto"
                  selectedKey={field.state.value}
                  onSelectionChange={(key) => {
                    field.handleChange(key ? String(key) : "");
                  }}
                >
                  {(budgets || []).map((b) => (
                    <SelectItem key={String(b.id)} textValue={b.title}>
                      {b.title} (
                      {new Intl.NumberFormat("es-CL", {
                        style: "currency",
                        currency: "CLP",
                      }).format(b.finalAmount)}
                      )
                    </SelectItem>
                  ))}
                </Select>
              )}
            </form.Field>

            <div className="sm:col-span-2">
              <form.Field name="reference">
                {(field) => (
                  <Input
                    label="Referencia / N° Operación"
                    placeholder="Ej: Transferencia 123456"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
            </div>

            <div className="sm:col-span-2">
              <form.Field name="notes">
                {(field) => (
                  <Input
                    as="textarea"
                    label="Observaciones"
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Detalles adicionales del pago..."
                    rows={2}
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-default-100 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
              isDisabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={mutation.isPending} className="gap-2">
              <Save size={18} />
              Registrar Pago
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
