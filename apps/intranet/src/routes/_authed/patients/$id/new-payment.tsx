import {
  Button,
  Calendar,
  Card,
  DateField,
  DatePicker,
  FieldError,
  Form,
  Label,
  NumberField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChevronLeft, Save } from "lucide-react";
import { z } from "zod";
import {
  TanStackInputField,
  TanStackSelectField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { createPatientPayment, fetchPatientBudgets } from "@/features/patients/api";
import { zDateString } from "@/lib/api-validate";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

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

function NewPaymentPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: budgets } = useQuery({
    queryKey: ["patient-budgets", id],
    queryFn: async () => {
      return await fetchPatientBudgets(Number(id));
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      return await createPatientPayment({
        patientId: Number(id),
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
      void queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void navigate({ to: "/patients/$id", params: { id: String(id) } });
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

      <Card className="p-6">
        <Form
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
                <DatePicker
                  isInvalid={field.state.meta.errors.length > 0}
                  onBlur={field.handleBlur}
                  onChange={(value) => {
                    field.handleChange(value?.toString() ?? "");
                  }}
                  value={field.state.value ? parseDate(field.state.value) : undefined}
                >
                  <Label>Fecha de Pago</Label>
                  <DateField.Group>
                    <DateField.InputContainer>
                      <DateField.Input>
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                    </DateField.InputContainer>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                  )}
                  <DatePicker.Popover>
                    <Calendar aria-label="Fecha de pago">
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => <Calendar.YearPickerCell year={year} />}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
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

          <div className="flex justify-end gap-3 border-default-100 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onPress={() => {
                void navigate({ to: "/patients/$id", params: { id: String(id) } });
              }}
              isDisabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" isPending={mutation.isPending} className="gap-2">
              <Save size={18} />
              Registrar Pago
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
