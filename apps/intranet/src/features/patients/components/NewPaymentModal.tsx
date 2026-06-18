import { Button, FieldError, Form, Label, NumberField } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { z } from "zod";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import {
  TanStackInputField,
  TanStackSelectField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { AppModal } from "@/components/ui/AppModal";
import { createPatientPayment, fetchPatientBudgets } from "@/features/patients/api";
import { patientKeys } from "@/features/patients/queries";
import { zDateString } from "@/lib/api-validate";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const paymentSchema = z.object({
  budgetId: z.string().optional(),
  amount: z.number().positive("Monto debe ser mayor a 0"),
  paymentDate: zDateString,
  paymentMethod: z.enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

interface NewPaymentModalProps {
  patientId: number | string;
  isOpen: boolean;
  onClose: () => void;
}

export function NewPaymentModal({ patientId, isOpen, onClose }: Readonly<NewPaymentModalProps>) {
  const queryClient = useQueryClient();

  const { data: budgets } = useQuery({
    queryKey: ["patient-budgets", patientId],
    queryFn: async () => {
      return await fetchPatientBudgets(Number(patientId));
    },
    // El modal se monta siempre (isOpen controla visibilidad); solo fetchear
    // cuando está abierto preserva el comportamiento del route anterior.
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      return await createPatientPayment({
        patientId: Number(patientId),
        amount: data.amount,
        budgetId: data.budgetId ? Number(data.budgetId) : undefined,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      toast.success("Pago registrado exitosamente");
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(String(patientId)) });
      onClose();
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo registrar el pago"}`
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
      paymentDate: formatChile(new Date(), "YYYY-MM-DD"),
      paymentMethod: "Transferencia",
      reference: "",
      notes: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Pago"
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onPress={onClose} isDisabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="new-payment-form"
            isPending={mutation.isPending}
            className="gap-2"
          >
            <Save size={18} />
            Registrar Pago
          </Button>
        </>
      }
    >
      <Form
        id="new-payment-form"
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-6"
        validationBehavior="aria"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="paymentDate">
            {(field) => (
              <AppDatePicker
                label="Fecha de Pago"
                isInvalid={field.state.meta.errors.length > 0}
                onBlur={field.handleBlur}
                onChange={(value) => {
                  field.handleChange(value);
                }}
                value={field.state.value}
                errorMessage={
                  field.state.meta.errors.length > 0
                    ? field.state.meta.errors.join(", ")
                    : undefined
                }
              />
            )}
          </form.Field>

          <form.Field name="amount">
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
                onBlur={field.handleBlur}
                onChange={(value) => field.handleChange(value ?? 0)}
                value={field.state.value}
              >
                <Label>Monto Pagado</Label>
                <NumberField.Group className="grid-cols-1">
                  <NumberField.Input />
                </NumberField.Group>
                {field.state.meta.errors.length > 0 ? (
                  <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                ) : null}
              </NumberField>
            )}
          </form.Field>

          <form.Field name="paymentMethod">
            {(field) => (
              <TanStackSelectField
                field={field}
                label="Método de Pago"
                options={[
                  { label: "Transferencia", value: "Transferencia" },
                  { label: "Efectivo", value: "Efectivo" },
                  { label: "Tarjeta", value: "Tarjeta" },
                  { label: "Otro/Varios", value: "Otro" },
                ]}
                required
              />
            )}
          </form.Field>

          <form.Field name="budgetId">
            {(field) => (
              <TanStackSelectField
                emptyOption={{ label: "Sin presupuesto", value: "" }}
                field={field}
                label="Vincular a Presupuesto (Opcional)"
                options={(budgets ?? []).map((b) => ({
                  label: `${b.title} (${new Intl.NumberFormat("es-CL", { currency: "CLP", style: "currency" }).format(Number(b.finalAmount))})`,
                  value: String(b.id),
                }))}
              />
            )}
          </form.Field>

          <div className="sm:col-span-2">
            <form.Field name="reference">
              {(field) => (
                <TanStackInputField
                  emptyAsUndefined
                  field={field}
                  label="Referencia / N° Operación"
                  placeholder="Ej: Transferencia 123456"
                />
              )}
            </form.Field>
          </div>

          <div className="sm:col-span-2">
            <form.Field name="notes">
              {(field) => (
                <TanStackTextAreaField
                  emptyAsUndefined
                  field={field}
                  label="Observaciones"
                  placeholder="Detalles adicionales del pago..."
                  rows={2}
                />
              )}
            </form.Field>
          </div>
        </div>
      </Form>
    </AppModal>
  );
}
