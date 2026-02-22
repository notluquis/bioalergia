import {
  Calendar,
  Card,
  DateField,
  DatePicker,
  DateRangePicker,
  FieldError,
  Label,
  ListBox,
  RangeCalendar,
  Select,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast-interceptor";

const medicalCertificateSearchSchema = z.object({
  patientName: z.string().optional(),
  rut: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().optional(),
});

export const Route = createFileRoute("/_authed/certificates/medical")({
  validateSearch: medicalCertificateSearchSchema,
  staticData: {
    nav: { iconKey: "FileText", label: "Certificados Médicos", order: 1, section: "Operaciones" },
    permission: { action: "create", subject: "MedicalCertificate" },
    title: "Generar Certificado Médico",
  },
  component: MedicalCertificatePage,
});

// Schema matching backend
const medicalCertificateSchema = z.object({
  patientName: z.string().min(1, "Nombre del paciente es requerido"),
  rut: z.string().regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, "RUT inválido (formato: 12.345.678-9)"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  address: z.string().min(1, "Domicilio es requerido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  diagnosis: z.string().min(1, "Diagnóstico es requerido"),
  symptoms: z.string().optional(),
  restDays: z.number().int().min(0).optional(),
  restStartDate: z.string().optional(),
  restEndDate: z.string().optional(),
  purpose: z.enum(["trabajo", "estudio", "otro"]).default("trabajo"),
  purposeDetail: z.string().optional(),
});

type FormData = z.infer<typeof medicalCertificateSchema>;

function MedicalCertificatePage() {
  const search = Route.useSearch();

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiClient.postRaw<Blob>("certificates/medical", data, {
        responseType: "blob",
      });
    },
    onSuccess: (pdfBlob, variables) => {
      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificado_${variables.rut.replace(/\./g, "")}_${dayjs().format("YYYYMMDD")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Certificado generado exitosamente");
    },
    onError: (error) => {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`);
    },
  });

  const form = useForm({
    defaultValues: {
      patientName: search.patientName || "",
      rut: search.rut || "",
      birthDate: search.birthDate || dayjs().subtract(25, "years").format("YYYY-MM-DD"),
      address: search.address || "",
      date: dayjs().format("YYYY-MM-DD"),
      diagnosis: "",
      symptoms: "",
      restDays: 0,
      restStartDate: dayjs().format("YYYY-MM-DD"),
      restEndDate: dayjs().add(7, "days").format("YYYY-MM-DD"),
      purpose: "trabajo" as "trabajo" | "estudio" | "otro",
      purposeDetail: "",
    },
    onSubmit: async ({ value }) => {
      await generateMutation.mutateAsync(value);
    },
  });

  return (
    <Card className="p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="space-y-6">
          {/* Patient Information */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground text-lg">Datos del Paciente</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="patientName">
                {(field) => (
                  <Input
                    label="Nombre Completo"
                    id="patientName"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                )}
              </form.Field>

              <form.Field name="rut">
                {(field) => (
                  <Input
                    label="RUT"
                    id="rut"
                    placeholder="12.345.678-9"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                )}
              </form.Field>

              <form.Field name="birthDate">
                {(field) => (
                  <DatePicker
                    isInvalid={field.state.meta.errors.length > 0}
                    onBlur={field.handleBlur}
                    onChange={(value) => {
                      field.handleChange(value?.toString() ?? "");
                    }}
                    value={field.state.value ? parseDate(field.state.value) : undefined}
                  >
                    <Label>Fecha de Nacimiento</Label>
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
                      <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                    )}
                    <DatePicker.Popover>
                      <Calendar aria-label="Fecha de nacimiento">
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

              <form.Field name="address">
                {(field) => (
                  <Input
                    label="Domicilio"
                    id="address"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                  />
                )}
              </form.Field>
            </div>
          </div>

          {/* Medical Information */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground text-lg">Información Médica</h3>
            <div className="grid gap-4">
              <form.Field name="date">
                {(field) => (
                  <DatePicker
                    className="sm:w-1/2"
                    isInvalid={field.state.meta.errors.length > 0}
                    onBlur={field.handleBlur}
                    onChange={(value) => {
                      field.handleChange(value?.toString() ?? "");
                    }}
                    value={field.state.value ? parseDate(field.state.value) : undefined}
                  >
                    <Label>Fecha del Certificado</Label>
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
                      <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                    )}
                    <DatePicker.Popover>
                      <Calendar aria-label="Fecha del certificado">
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

              <form.Field name="diagnosis">
                {(field) => (
                  <Input
                    as="textarea"
                    id="diagnosis"
                    label="Diagnóstico *"
                    rows={3}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.join(", ")}
                    placeholder="Ej: cuadro compatible con reacción alérgica"
                  />
                )}
              </form.Field>

              <form.Field name="symptoms">
                {(field) => (
                  <Input
                    as="textarea"
                    id="symptoms"
                    label="Síntomas (opcional)"
                    rows={2}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Ej: dolor en diversas zonas, predominio de cefalea intensa"
                  />
                )}
              </form.Field>
            </div>
          </div>

          {/* Rest Period */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground text-lg">Reposo Médico (opcional)</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <form.Field name="restDays">
                {(field) => (
                  <Input
                    type="number"
                    label="Días de Reposo"
                    id="restDays"
                    value={field.state.value?.toString() || "0"}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                    min={0}
                  />
                )}
              </form.Field>

              <form.Field name="restStartDate">
                {(restStartField) => (
                  <form.Field name="restEndDate">
                    {(restEndField) => (
                      <DateRangePicker
                        className="sm:col-span-2"
                        onChange={(value) => {
                          if (!value) {
                            restStartField.handleChange("");
                            restEndField.handleChange("");
                            return;
                          }
                          restStartField.handleChange(value.start.toString());
                          restEndField.handleChange(value.end.toString());
                        }}
                        value={
                          restStartField.state.value && restEndField.state.value
                            ? {
                                end: parseDate(restEndField.state.value),
                                start: parseDate(restStartField.state.value),
                              }
                            : undefined
                        }
                      >
                        <Label>Reposo: Desde / Hasta</Label>
                        <DateField.Group>
                          <DateField.Input slot="start">
                            {(segment) => <DateField.Segment segment={segment} />}
                          </DateField.Input>
                          <DateRangePicker.RangeSeparator />
                          <DateField.Input slot="end">
                            {(segment) => <DateField.Segment segment={segment} />}
                          </DateField.Input>
                          <DateField.Suffix>
                            <DateRangePicker.Trigger>
                              <DateRangePicker.TriggerIndicator />
                            </DateRangePicker.Trigger>
                          </DateField.Suffix>
                        </DateField.Group>
                        <DateRangePicker.Popover>
                          <RangeCalendar visibleDuration={{ months: 2 }} />
                        </DateRangePicker.Popover>
                      </DateRangePicker>
                    )}
                  </form.Field>
                )}
              </form.Field>
            </div>
          </div>

          {/* Purpose */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground text-lg">Propósito</h3>
            <div className="grid gap-4">
              <form.Field name="purpose">
                {(field) => (
                  <Select
                    value={field.state.value || null}
                    onChange={(key) => {
                      if (typeof key === "string") {
                        field.handleChange(key as typeof field.state.value);
                      }
                    }}
                    onBlur={field.handleBlur}
                  >
                    <Label>Para ser presentado en</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="trabajo" textValue="Lugar de trabajo">
                          Lugar de trabajo
                        </ListBox.Item>
                        <ListBox.Item id="estudio" textValue="Establecimiento educacional">
                          Establecimiento educacional
                        </ListBox.Item>
                        <ListBox.Item id="otro" textValue="Otro">
                          Otro
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>

              <form.Subscribe selector={(state) => state.values.purpose}>
                {(purpose) =>
                  purpose === "otro" && (
                    <form.Field name="purposeDetail">
                      {(field) => (
                        <Input
                          label="Especificar"
                          id="purposeDetail"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      )}
                    </form.Field>
                  )
                }
              </form.Subscribe>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-default-200 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => form.reset()}
              isDisabled={generateMutation.isPending}
            >
              Limpiar
            </Button>
            <Button type="submit" isLoading={generateMutation.isPending}>
              {generateMutation.isPending ? "Generando..." : "Generar Certificado"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
