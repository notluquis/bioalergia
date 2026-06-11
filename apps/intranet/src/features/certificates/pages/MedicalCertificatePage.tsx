import { Button, Card, Form, Label, ListBox, NumberField, Select } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { addDays, formatChile, today } from "@/lib/dates";
import { z } from "zod";
import { certificatesORPCClient, toCertificatesApiError } from "@/features/certificates/orpc";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { AppDatePicker, AppDateRangePicker } from "@/components/forms/AppDatePicker";
import { PatientSelectModal } from "@/features/exam-reports/components/PatientSelectModal";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { findPersonByRut } from "@/features/people/api";
import { toast } from "@/lib/toast-interceptor";
import { DocumentPatientSection } from "@/components/documents/DocumentPatientSection";
import { useDocumentPatientAutofill } from "@/components/documents/useDocumentPatientAutofill";
import { Search } from "lucide-react";
import { useState } from "react";

const routeApi = getRouteApi("/_authed/certificates/medical");

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

export function MedicalCertificatePage() {
  const search = routeApi.useSearch();
  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      try {
        return await certificatesORPCClient.generateMedical(data);
      } catch (error) {
        throw toCertificatesApiError(error);
      }
    },
    onSuccess: (pdfBlob, variables) => {
      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificado_${variables.rut.replace(/\./g, "")}_${formatChile(new Date(), "YYYYMMDD")}.pdf`;
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
      birthDate: search.birthDate || `${Number(today().slice(0, 4)) - 25}${today().slice(4)}`,
      address: search.address || "",
      date: today(),
      diagnosis: "",
      symptoms: "",
      restDays: 0,
      restStartDate: today(),
      restEndDate: addDays(today(), 7),
      purpose: "trabajo" as "trabajo" | "estudio" | "otro",
      purposeDetail: "",
    },
    onSubmit: async ({ value }) => {
      await generateMutation.mutateAsync(value);
    },
  });

  const handleAutofill = useDocumentPatientAutofill(form, {
    patientName: "patientName",
    birthDate: "birthDate",
    address: "address",
  });

  return (
    <Card className="p-6">
      <Form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        validationBehavior="aria"
      >
        <div className="space-y-6">
          <DocumentPatientSection
            actionButton={
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onPress={() => setSelectPatientOpen(true)}
              >
                <Search size={14} />
                Seleccionar Paciente
              </Button>
            }
            patientNameField={
              <form.Field name="patientName">
                {(field) => <TanStackInputField field={field} label="Nombre Completo" />}
              </form.Field>
            }
            rutField={
              <form.Field name="rut">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="RUT"
                    placeholder="12.345.678-9"
                    onBlur={() => handleAutofill(field.state.value)}
                  />
                )}
              </form.Field>
            }
            birthDateField={
              <form.Field name="birthDate">
                {(field) => (
                  <AppDatePicker
                    label="Fecha de Nacimiento"
                    errorMessage={field.state.meta.errors.join(", ")}
                    value={field.state.value}
                    onChange={(val) => {
                      field.handleChange(val);
                      field.handleBlur();
                    }}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
            }
            addressField={
              <form.Field name="address">
                {(field) => <TanStackInputField field={field} label="Domicilio" />}
              </form.Field>
            }
          />

          {/* Medical Information */}
          <div>
            <h3 className="mb-4 font-semibold text-foreground text-lg">Información Médica</h3>
            <div className="grid gap-4">
              <form.Field name="date">
                {(field) => (
                  <AppDatePicker
                    className="sm:w-1/2"
                    label="Fecha del Certificado"
                    errorMessage={field.state.meta.errors.join(", ")}
                    value={field.state.value}
                    onChange={(val) => {
                      field.handleChange(val);
                      field.handleBlur();
                    }}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>

              <form.Field name="diagnosis">
                {(field) => (
                  <TanStackTextAreaField
                    field={field}
                    label="Diagnóstico *"
                    rows={3}
                    placeholder="Ej: cuadro compatible con reacción alérgica"
                  />
                )}
              </form.Field>

              <form.Field name="symptoms">
                {(field) => (
                  <TanStackTextAreaField
                    field={field}
                    label="Síntomas (opcional)"
                    rows={2}
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
                  <NumberField
                    minValue={0}
                    onBlur={field.handleBlur}
                    onChange={(v) => field.handleChange(v ?? 0)}
                    step={1}
                    value={field.state.value ?? 0}
                    variant="secondary"
                  >
                    <Label>Días de Reposo</Label>
                    <NumberField.Group className="grid-cols-1">
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                )}
              </form.Field>

              <form.Field name="restStartDate">
                {(restStartField) => (
                  <form.Field name="restEndDate">
                    {(restEndField) => (
                      <AppDateRangePicker
                        className="sm:col-span-2"
                        label="Reposo: Desde / Hasta"
                        startValue={restStartField.state.value}
                        endValue={restEndField.state.value}
                        onChange={(start: string, end: string) => {
                          restStartField.handleChange(start);
                          restEndField.handleChange(end);
                        }}
                        visibleMonths={2}
                      />
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
                      {(field) => <TanStackInputField field={field} label="Especificar" />}
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
              variant="outline"
              onPress={() => form.reset()}
              isDisabled={generateMutation.isPending}
            >
              Limpiar
            </Button>
            <Button type="submit" isPending={generateMutation.isPending}>
              {generateMutation.isPending ? "Generando..." : "Generar Certificado"}
            </Button>
          </div>
        </div>
      </Form>

      <PatientSelectModal
        isOpen={selectPatientOpen}
        onClose={() => setSelectPatientOpen(false)}
        onCreateNew={() => {
          setSelectPatientOpen(false);
          setCreatePatientOpen(true);
        }}
        onSelect={async (selected) => {
          setSelectPatientOpen(false);
          if (selected.person.rut) {
            try {
              const data = await findPersonByRut(selected.person.rut);
              if (!data) throw new Error("Person not found");
              form.setFieldValue("patientName", data.names);
              form.setFieldValue("rut", selected.person.rut);
              if (data.birthDate) form.setFieldValue("birthDate", data.birthDate);

              const personRecord = data as unknown as Record<string, unknown>;
              if (personRecord.address) {
                const addr = personRecord.address;
                const fullAddr =
                  Array.isArray(addr) && addr.length > 0
                    ? `${addr[0].street} ${addr[0].streetNumber || ""}`.trim()
                    : typeof addr === "string"
                      ? addr
                      : typeof addr === "object" && addr !== null && "street" in addr
                        ? `${(addr as Record<string, unknown>).street} ${(addr as Record<string, unknown>).streetNumber || ""}`.trim()
                        : "";
                if (fullAddr) {
                  form.setFieldValue("address", fullAddr);
                }
              }
            } catch (e) {
              // Si falla (poco probable porque viene de DB), hacemos fallback básico
              form.setFieldValue(
                "patientName",
                [selected.person.names, selected.person.fatherName].filter(Boolean).join(" ")
              );
              form.setFieldValue("rut", selected.person.rut);
            }
          } else {
            form.setFieldValue(
              "patientName",
              [selected.person.names, selected.person.fatherName].filter(Boolean).join(" ")
            );
          }
        }}
      />
      <CreatePatientModal
        isOpen={createPatientOpen}
        onClose={() => {
          setCreatePatientOpen(false);
          setSelectPatientOpen(true);
        }}
      />
    </Card>
  );
}
