import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";
import { PAGE_CONTAINER } from "@/lib/styles";

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
    mutationFn: async (data: ConsultationForm) => {
      return await apiClient.post(`/api/patients/${id}/consultations`, data);
    },
    onSuccess: () => {
      toast.success("Consulta registrada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      navigate({ to: "/patients/$id", params: { id: String(id) } });
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
          onClick={() => navigate({ to: "/patients/$id", params: { id: String(id) } })}
          className="gap-2"
        >
          <ChevronLeft size={20} />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nueva Consulta Médica</h1>
          <p className="text-default-500 text-sm">Registro de atención clínica</p>
        </div>
      </header>

      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="date">
                {(field) => (
                  <Input
                    type="date"
                    label="Fecha de Atención"
                    id="consultationDate"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                )}
              </form.Field>
            </div>

            <form.Field name="reason">
              {(field) => (
                <Input
                  as="textarea"
                  label="Motivo de consulta"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Escriba el motivo principal de la atención..."
                  required
                  rows={3}
                  value={field.state.value}
                  error={field.state.meta.errors.join(", ")}
                />
              )}
            </form.Field>

            <form.Field name="diagnosis">
              {(field) => (
                <Input
                  as="textarea"
                  label="Diagnóstico"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Diagnóstico presuntivo o confirmado..."
                  rows={2}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Field name="treatment">
              {(field) => (
                <Input
                  as="textarea"
                  label="Tratamiento indicado"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Medicamentos, dosis, indicaciones generales..."
                  rows={3}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Field name="notes">
              {(field) => (
                <Input
                  as="textarea"
                  label="Notas privadas"
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Observaciones adicionales no visibles en certificados..."
                  rows={2}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <div className="flex justify-end gap-3 pt-4 border-t border-default-100">
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
                Guardar Consulta
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
