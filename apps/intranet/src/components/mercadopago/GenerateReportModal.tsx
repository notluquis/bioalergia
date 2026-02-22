import { Calendar, DateField, DatePicker, FieldError, Label, Modal } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
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
  if (!error) {
    return undefined;
  }
  if (typeof error === "string") {
    return error;
  }
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
        },
      ),
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

      // Manual validation
      const result = schema.safeParse(payload);
      if (!result.success) {
        const firstError = result.error.issues[0]?.message || "Datos inválidos";
        showError(firstError);
        return;
      }

      await mutation.mutateAsync(payload);
    },
  });

  const handleClose = () => {
    setUseNowAsEndDate(false);
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>{`Generar Reporte: ${reportType === "release" ? "Liberación" : "Conciliación"}`}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <p className="text-default-600 text-sm">
                  Selecciona el rango de fechas para generar el reporte de{" "}
                  {reportType === "release" ? "liberación de fondos" : "conciliación"}. Si el rango
                  es mayor a 60 días, se crearán múltiples reportes automáticamente.
                </p>

                <div className="flex items-center gap-3">
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => {
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

                <form.Field name="begin_date">
                  {(field) => (
                    <DatePicker
                      isInvalid={field.state.meta.errors.length > 0}
                      isRequired
                      onBlur={field.handleBlur}
                      onChange={(value) => {
                        if (!value) {
                          return;
                        }
                        field.handleChange(dayjs(value.toString(), "YYYY-MM-DD").toDate());
                      }}
                      value={parseDate(dayjs(field.state.value).format("YYYY-MM-DD"))}
                    >
                      <Label>Fecha Inicio</Label>
                      <DateField.Group>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                        <DateField.Suffix>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Suffix>
                      </DateField.Group>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{getFieldErrorMessage(field.state.meta.errors[0])}</FieldError>
                      )}
                      <DatePicker.Popover>
                        <Calendar aria-label="Fecha inicio">
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

                <form.Field name="end_date">
                  {(field) => (
                    <DatePicker
                      isDisabled={useNowAsEndDate}
                      isInvalid={field.state.meta.errors.length > 0}
                      isRequired
                      onBlur={field.handleBlur}
                      onChange={(value) => {
                        if (!value) {
                          return;
                        }
                        field.handleChange(dayjs(value.toString(), "YYYY-MM-DD").toDate());
                      }}
                      value={parseDate(dayjs(field.state.value).format("YYYY-MM-DD"))}
                    >
                      <Label>Fecha Fin</Label>
                      <DateField.Group>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                        <DateField.Suffix>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Suffix>
                      </DateField.Group>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{getFieldErrorMessage(field.state.meta.errors[0])}</FieldError>
                      )}
                      <DatePicker.Popover>
                        <Calendar aria-label="Fecha fin">
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

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    disabled={mutation.isPending}
                    onClick={handleClose}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button disabled={mutation.isPending} type="submit" variant="primary">
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {progress
                          ? `Creando ${progress.current}/${progress.total}...`
                          : "Creando..."}
                      </>
                    ) : (
                      "Generar"
                    )}
                  </Button>
                </div>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
