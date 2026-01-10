import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      MPService.createReportBulk(data.begin_date, data.end_date, reportType, (current, total) =>
        setProgress({ current, total })
      ),
    onSuccess: (reports) => {
      const count = reports.length;
      showSuccess(count === 1 ? "Solicitud de reporte enviada" : `${count} reportes solicitados exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
      reset();
      setProgress(null);
      onClose();
    },
    onError: (e: Error) => {
      showError(`Error: ${e.message}`);
      setProgress(null);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Modal
      title={`Generar Reporte: ${reportType === "release" ? "Liberación" : "Conciliación"}`}
      isOpen={open}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-base-content/70 text-sm">
          Selecciona el rango de fechas para generar el reporte de{" "}
          {reportType === "release" ? "liberación de fondos" : "conciliación"}. Si el rango es mayor a 60 días, se
          crearán múltiples reportes automáticamente.
        </p>

        <Input label="Fecha Inicio" type="date" error={errors.begin_date?.message} {...register("begin_date")} />

        <Input label="Fecha Fin" type="date" error={errors.end_date?.message} {...register("end_date")} />

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
