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
      // @ts-expect-error - Route tree may not be updated yet
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
          // @ts-expect-error
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
                <div>
                  <label
                    htmlFor="reason"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Motivo de Consulta <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="reason"
                    className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Escriba el motivo principal de la atención..."
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-danger text-sm mt-1">{field.state.meta.errors.join(", ")}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="diagnosis">
              {(field) => (
                <div>
                  <label
                    htmlFor="diagnosis"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Diagnóstico
                  </label>
                  <textarea
                    id="diagnosis"
                    className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={2}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Diagnóstico presuntivo o confirmado..."
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="treatment">
              {(field) => (
                <div>
                  <label
                    htmlFor="treatment"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Tratamiento Indicado
                  </label>
                  <textarea
                    id="treatment"
                    className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={3}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Medicamentos, dosis, indicaciones generales..."
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="notes">
              {(field) => (
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Notas Privadas
                  </label>
                  <textarea
                    id="notes"
                    className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={2}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Observaciones adicionales no visibles en certificados..."
                  />
                </div>
              )}
            </form.Field>

            <div className="flex justify-end gap-3 pt-4 border-t border-default-100">
              <Button
                type="button"
                variant="ghost"
                // @ts-expect-error
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
