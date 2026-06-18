import { formatChile } from "@/lib/dates";
import { Button, Card, Form } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Save } from "lucide-react";
import { z } from "zod";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
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
      void queryClient.invalidateQueries({ queryKey: ["patient", id] });
      void navigate({ to: "/patients/$id", params: { id: String(id) } });
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo registrar la consulta"}`
      );
    },
  });

  const form = useForm({
    defaultValues: {
      date: formatChile(new Date(), "YYYY-MM-DD"),
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
          validationBehavior="aria"
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="date">
                {(field) => (
                  <AppDatePicker
                    label="Fecha de Atención"
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
                Guardar Consulta
              </Button>
            </div>
          </div>
        </Form>
      </Card>
    </div>
  );
}
