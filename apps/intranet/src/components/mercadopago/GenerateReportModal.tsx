import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { MPService, type MpReportType } from "@/services/mercadopago";

const schema = z
  .object({
    begin_date: z.coerce.date(),
    end_date: z.coerce.date(),
  })
  .refine((data) => data.begin_date.getTime() <= data.end_date.getTime(), {
    message: "La fecha de inicio debe ser anterior a la de fin",
    path: ["end_date"],
  });

type FormData = z.infer<typeof schema>;

const getFieldErrorMessage = (error: unknown) => {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
};

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
      showSuccess(
        count === 1 ? "Solicitud de reporte enviada" : `${count} reportes solicitados exitosamente`,
      );
      void queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
      form.reset();
      setProgress(null);
      onClose();
    },
  });

  const form = useForm({
    defaultValues: {
      begin_date: dayjs().subtract(7, "day").toDate(),
      end_date: dayjs().toDate(),
    } as FormData,
    onSubmit: async ({ value }) => {
      // Manual validation
      const result = schema.safeParse(value);
      if (!result.success) {
        const firstError = result.error.issues[0]?.message || "Datos inválidos";
        showError(firstError);
        return;
      }

      await mutation.mutateAsync(value);
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
        <p className="text-default-600 text-sm">
          Selecciona el rango de fechas para generar el reporte de{" "}
          {reportType === "release" ? "liberación de fondos" : "conciliación"}. Si el rango es mayor
          a 60 días, se crearán múltiples reportes automáticamente.
        </p>

        <form.Field name="begin_date">
          {(field) => (
            <Input
              error={getFieldErrorMessage(field.state.meta.errors[0])}
              label="Fecha Inicio"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(dayjs(e.target.value).toDate());
              }}
              type="date"
              value={dayjs(field.state.value).format("YYYY-MM-DD")}
            />
          )}
        </form.Field>

        <form.Field name="end_date">
          {(field) => (
            <Input
              error={getFieldErrorMessage(field.state.meta.errors[0])}
              label="Fecha Fin"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(dayjs(e.target.value).toDate());
              }}
              type="date"
              value={dayjs(field.state.value).format("YYYY-MM-DD")}
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
