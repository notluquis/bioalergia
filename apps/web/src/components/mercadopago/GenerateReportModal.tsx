import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { MpReportType, MPService } from "@/services/mercadopago";

const schema = z
  .object({
    begin_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().min(1, "Fecha de fin requerida"),
  })
  .refine((data) => new Date(data.begin_date) <= new Date(data.end_date), {
    message: "La fecha de inicio debe ser anterior a la de fin",
    path: ["end_date"],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  reportType: MpReportType;
}

export default function GenerateReportModal({ open, onClose, reportType }: Props) {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      MPService.createReportBulk(data.begin_date, data.end_date, reportType, (current, total) =>
        setProgress({ current, total })
      ),
    onSuccess: (reports) => {
      const count = reports.length;
      showSuccess(count === 1 ? "Solicitud de reporte enviada" : `${count} reportes solicitados exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
      form.reset();
      setProgress(null);
      onClose();
    },
    onError: (e: Error) => {
      showError(`Error: ${e.message}`);
      setProgress(null);
    },
  });

  const form = useForm({
    defaultValues: {
      begin_date: "",
      end_date: "",
    } as FormData,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  });

  return (
    <Modal
      title={`Generar Reporte: ${reportType === "release" ? "Liberación" : "Conciliación"}`}
      isOpen={open}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <p className="text-base-content/70 text-sm">
          Selecciona el rango de fechas para generar el reporte de{" "}
          {reportType === "release" ? "liberación de fondos" : "conciliación"}. Si el rango es mayor a 60 días, se
          crearán múltiples reportes automáticamente.
        </p>

        <form.Field name="begin_date">
          {(field) => (
            <Input
              label="Fecha Inicio"
              type="date"
              error={field.state.meta.errors[0]?.message}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        <form.Field name="end_date">
          {(field) => (
            <Input
              label="Fecha Fin"
              type="date"
              error={field.state.meta.errors[0]?.message}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress ? `Creando ${progress.current}/${progress.total}...` : "Creando..."}
              </>
            ) : (
              "Generar"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
