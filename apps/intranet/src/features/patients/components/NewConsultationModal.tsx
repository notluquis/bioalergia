import { Button, Form } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { z } from "zod";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { TanStackTextAreaField } from "@/components/forms/TanStackFieldControls";
import { AppModal } from "@/components/ui/AppModal";
import { createPatientConsultation } from "@/features/patients/api";
import { patientKeys } from "@/features/patients/queries";
import { formatChile } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const consultationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  reason: z.string().min(1, "Motivo de consulta es requerido"),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional(),
});

type ConsultationForm = z.infer<typeof consultationSchema>;

interface NewConsultationModalProps {
  patientId: number | string;
  isOpen: boolean;
  onClose: () => void;
}

export function NewConsultationModal({
  patientId,
  isOpen,
  onClose,
}: Readonly<NewConsultationModalProps>) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: ConsultationForm) =>
      createPatientConsultation({
        patientId: Number(patientId),
        ...data,
      }),
    onSuccess: () => {
      toast.success("Consulta registrada exitosamente");
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(String(patientId)) });
      onClose();
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
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Consulta"
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onPress={onClose} isDisabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="new-consultation-form"
            isPending={mutation.isPending}
            className="gap-2"
          >
            <Save size={18} />
            Guardar Consulta
          </Button>
        </>
      }
    >
      <Form
        id="new-consultation-form"
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
        </div>
      </Form>
    </AppModal>
  );
}
