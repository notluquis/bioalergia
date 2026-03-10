import {
  Button,
  Calendar,
  Card,
  DateField,
  DatePicker,
  FieldError,
  Form,
  Label,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChevronLeft, Save } from "lucide-react";
import { z } from "zod";
import { TanStackTextAreaField } from "@/components/forms/TanStackFieldControls";
import { createPatientConsultation } from "@/features/patients/api";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

export const Route = createFileRoute("/_authed/patients/$id/new-consultation")({
  staticData: {
    permission: { action: "create", subject: "Consultation" },
    title: "Nueva Consulta",
    hideFromNav: true,
  },
  component: NewConsultationPage,
});

const consultationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  reason: z.string().min(1, "Motivo de consulta es requerido"),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional(),
});

type ConsultationForm = z.infer<typeof consultationSchema>;

function NewConsultationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: ConsultationForm) =>
      createPatientConsultation({
        patientId: Number(id),
        ...data,
      }),
    onSuccess: () => {
      toast.success("Consulta registrada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void navigate({ to: "/patients/$id", params: { id: String(id) } });
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo registrar la consulta"}`,
      );
    },
  });

  const form = useForm({
    defaultValues: {
      date: dayjs().format("YYYY-MM-DD"),
      reason: "",
      diagnosis: "",
      treatment: "",
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
          onPress={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
          className="gap-2"
        >
          <ChevronLeft size={20} />
          Volver
        </Button>
        <div>
          <h1 className="font-bold text-2xl text-foreground">Nueva Consulta Médica</h1>
          <p className="text-default-500 text-sm">Registro de atención clínica</p>
        </div>
      </header>

      <Card className="p-6">
        <Form
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          validationBehavior="aria"
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="date">
                {(field) => (
                  <DatePicker
                    isInvalid={field.state.meta.errors.length > 0}
                    onBlur={field.handleBlur}
                    onChange={(value) => {
                      field.handleChange(value?.toString() ?? "");
                    }}
                    value={field.state.value ? parseDate(field.state.value) : undefined}
                  >
                    <Label>Fecha de Atención</Label>
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
                      <Calendar aria-label="Fecha de atención">
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
            </div>

            <form.Field name="reason">
              {(field) => (
                <TanStackTextAreaField
                  field={field}
                  label="Motivo de consulta"
                  placeholder="Escriba el motivo principal de la atención..."
                  required
                  rows={3}
                />
              )}
            </form.Field>

            <form.Field name="diagnosis">
              {(field) => (
                <TanStackTextAreaField
                  field={field}
                  label="Diagnóstico"
                  placeholder="Diagnóstico presuntivo o confirmado..."
                  emptyAsUndefined
                  rows={2}
                />
              )}
            </form.Field>

            <form.Field name="treatment">
              {(field) => (
                <TanStackTextAreaField
                  field={field}
                  label="Tratamiento indicado"
                  placeholder="Medicamentos, dosis, indicaciones generales..."
                  emptyAsUndefined
                  rows={3}
                />
              )}
            </form.Field>

            <form.Field name="notes">
              {(field) => (
                <TanStackTextAreaField
                  field={field}
                  label="Notas privadas"
                  placeholder="Observaciones adicionales no visibles en certificados..."
                  emptyAsUndefined
                  rows={2}
                />
              )}
            </form.Field>

            <div className="flex justify-end gap-3 border-default-100 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onPress={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
                isDisabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" isPending={mutation.isPending} className="gap-2">
                <Save size={18} />
                Guardar Consulta
              </Button>
            </div>
          </div>
        </Form>
      </Card>
    </div>
  );
}
