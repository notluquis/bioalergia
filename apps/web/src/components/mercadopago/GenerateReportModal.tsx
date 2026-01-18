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
  readonly onClose: () => void;
  readonly open: boolean;
  readonly reportType: MpReportType;
}

export default function GenerateReportModal({ onClose, open, reportType }: Props) {
  const queryClient = useQueryClient();
  const { error: showError, success: showSuccess } = useToast();
  const [progress, setProgress] = useState<null | { current: number; total: number }>(null);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      MPService.createReportBulk(data.begin_date, data.end_date, reportType, (current, total) => {
        setProgress({ current, total });
      }),
    onError: (e: Error) => {
      showError(`Error: ${e.message}`);
      setProgress(null);
    },
    onSuccess: (reports) => {
      const count = reports.length;
      showSuccess(count === 1 ? "Solicitud de reporte enviada" : `${count} reportes solicitados exitosamente`);
      void queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
      form.reset();
      setProgress(null);
      onClose();
    },
  });

  const form = useForm({
    defaultValues: {
      begin_date: "",
      end_date: "",
    } as FormData,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    validators: {
      onChange: schema,
    },
  });

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Generar Reporte: ${reportType === "release" ? "Liberación" : "Conciliación"}`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <p className="text-base-content/70 text-sm">
          Selecciona el rango de fechas para generar el reporte de{" "}
          {reportType === "release" ? "liberación de fondos" : "conciliación"}. Si el rango es mayor a 60 días, se
          crearán múltiples reportes automáticamente.
        </p>

        <form.Field name="begin_date">
          {(field) => (
            <Input
              error={field.state.meta.errors[0]?.message}
              label="Fecha Inicio"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              type="date"
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Field name="end_date">
          {(field) => (
            <Input
              error={field.state.meta.errors[0]?.message}
              label="Fecha Fin"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              type="date"
              value={field.state.value}
            />
          )}
        </form.Field>

        <div className="mt-6 flex justify-end gap-3">
          <Button disabled={mutation.isPending} onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={mutation.isPending} type="submit" variant="primary">
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
