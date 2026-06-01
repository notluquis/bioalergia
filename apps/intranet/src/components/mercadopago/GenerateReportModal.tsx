import { Button, Form } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppDateRangePicker } from "@/components/forms/AppDatePicker";
import { AppModal } from "@/components/ui/AppModal";
import { useToast } from "@/context/ToastContext";
import { MPService, type MpReportType } from "@/services/mercadopago";

const schema = z.object({
  begin_date: z.coerce.date(),
  end_date: z.coerce.date(),
});
// begin ≤ end enforced natively by the DateRangePicker (AppDateRangePicker).

type FormData = z.infer<typeof schema>;

interface Props {
  readonly onClose: () => void;
  readonly open: boolean;
  readonly reportType: MpReportType;
}
export function GenerateReportModal({ onClose, open, reportType }: Props) {
  const queryClient = useQueryClient();
  const { error: showError, success: showSuccess } = useToast();
  const [progress, setProgress] = useState<null | { current: number; total: number }>(null);
  const [useNowAsEndDate, setUseNowAsEndDate] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      MPService.createReportBulk(
        data.begin_date,
        data.end_date,
        reportType,
        { endAtNow: useNowAsEndDate },
        (current, total) => {
          setProgress({ current, total });
        }
      ),
    onError: (e: Error) => {
      showError(`Error: ${e.message}`);
      setProgress(null);
    },
    onSuccess: (reports) => {
      const count = reports.length;
      showSuccess(
        count === 1 ? "Solicitud de reporte enviada" : `${count} reportes solicitados exitosamente`
      );
      void queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
      form.reset();
      setProgress(null);
      setUseNowAsEndDate(false);
      onClose();
    },
  });

  const form = useForm({
    defaultValues: {
      begin_date: dayjs().subtract(7, "day").toDate(),
      end_date: dayjs().toDate(),
    } as FormData,
    onSubmit: async ({ value }) => {
      const payload: FormData = {
        ...value,
        end_date: useNowAsEndDate ? new Date() : value.end_date,
      };

      await mutation.mutateAsync(payload);
    },
  });

  const handleClose = () => {
    setUseNowAsEndDate(false);
    onClose();
  };

  return (
    <AppModal
      isOpen={open}
      onClose={handleClose}
      title={`Generar Reporte: ${reportType === "release" ? "Liberación" : "Conciliación"}`}
      size="lg"
      footer={
        <>
          <Button
            isDisabled={mutation.isPending}
            onPress={handleClose}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            isDisabled={mutation.isPending}
            type="submit"
            form="generate-report-form"
            variant="primary"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 animate-spin size-4" />
                {progress ? `Creando ${progress.current}/${progress.total}...` : "Creando..."}
              </>
            ) : (
              "Generar"
            )}
          </Button>
        </>
      }
    >
      <Form
        id="generate-report-form"
        className="space-y-4"
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        validationBehavior="aria"
      >
        <p className="text-default-600 text-sm">
          Selecciona el rango de fechas para generar el reporte de{" "}
          {reportType === "release" ? "liberación de fondos" : "conciliación"}. Si el rango es mayor
          a 60 días, se crearán múltiples reportes automáticamente.
        </p>

        <div className="flex items-center gap-3">
          <Button
            isDisabled={mutation.isPending}
            onPress={() => {
              setUseNowAsEndDate((prev) => !prev);
            }}
            type="button"
            variant={useNowAsEndDate ? "primary" : "ghost"}
          >
            {useNowAsEndDate ? "Fecha fin: Ahora" : "Usar fecha actual como fin"}
          </Button>
          {useNowAsEndDate ? (
            <span className="text-default-500 text-xs">
              Se usará la hora actual al momento de generar.
            </span>
          ) : null}
        </div>

        <form.Subscribe selector={(s) => ({ begin: s.values.begin_date, end: s.values.end_date })}>
          {({ begin, end }) => (
            <AppDateRangePicker
              isRequired
              isDisabled={mutation.isPending}
              label="Rango de fechas"
              startValue={begin ? dayjs(begin).format("YYYY-MM-DD") : null}
              endValue={end ? dayjs(end).format("YYYY-MM-DD") : null}
              onChange={(from, to) => {
                if (from) form.setFieldValue("begin_date", dayjs(from, "YYYY-MM-DD").toDate());
                if (to) form.setFieldValue("end_date", dayjs(to, "YYYY-MM-DD").toDate());
              }}
            />
          )}
        </form.Subscribe>
      </Form>
    </AppModal>
  );
}
