import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/certificates/medical")({
  staticData: {
    nav: { iconKey: "FileText", label: "Certificados Médicos", order: 1, section: "Operaciones" },
    permission: { action: "create", subject: "MedicalCertificate" },
    title: "Generar Certificado Médico",
  },
  component: MedicalCertificatePage,
});

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { toast } from "sonner";
import { z } from "zod";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";
import { PAGE_CONTAINER } from "@/lib/styles";

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
  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiClient.post("certificates/medical", { json: data });
      return (await response.blob()) as Blob;
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
      patientName: "",
      rut: "",
      birthDate: dayjs().subtract(25, "years").format("YYYY-MM-DD"),
      address: "",
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
    <div className={PAGE_CONTAINER}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Generar Certificado Médico</h1>
        <p className="text-foreground-500 text-sm mt-1">
          Certificado con firma digital FEA (Ley 19.799)
        </p>
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
            {/* Patient Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Datos del Paciente</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="patientName">
                  {(field) => (
                    <Input
                      label="Nombre Completo"
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
                    <Input
                      type="date"
                      label="Fecha de Nacimiento"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.join(", ")}
                    />
                  )}
                </form.Field>

                <form.Field name="address">
                  {(field) => (
                    <Input
                      label="Domicilio"
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
              <h3 className="text-lg font-semibold text-foreground mb-4">Información Médica</h3>
              <div className="grid gap-4">
                <form.Field name="date">
                  {(field) => (
                    <Input
                      type="date"
                      label="Fecha del Certificado"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.join(", ")}
                      className="sm:w-1/2"
                    />
                  )}
                </form.Field>

                <form.Field name="diagnosis">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Diagnóstico <span className="text-danger">*</span>
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={3}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Ej: cuadro compatible con reacción alérgica"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-danger text-sm mt-1">
                          {field.state.meta.errors.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="symptoms">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Síntomas (opcional)
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        rows={2}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Ej: dolor en diversas zonas, predominio de cefalea intensa"
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            {/* Rest Period */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Reposo Médico (opcional)
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <form.Field name="restDays">
                  {(field) => (
                    <Input
                      type="number"
                      label="Días de Reposo"
                      value={field.state.value?.toString() || "0"}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      onBlur={field.handleBlur}
                      min={0}
                    />
                  )}
                </form.Field>

                <form.Field name="restStartDate">
                  {(field) => (
                    <Input
                      type="date"
                      label="Desde"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>

                <form.Field name="restEndDate">
                  {(field) => (
                    <Input
                      type="date"
                      label="Hasta"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
              </div>
            </div>

            {/* Purpose */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Propósito</h3>
              <div className="grid gap-4">
                <form.Field name="purpose">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Para ser presentado en
                      </label>
                      <select
                        className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(e.target.value as typeof field.state.value)
                        }
                        onBlur={field.handleBlur}
                      >
                        <option value="trabajo">Lugar de trabajo</option>
                        <option value="estudio">Establecimiento educacional</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  )}
                </form.Field>

                <form.Subscribe selector={(state) => state.values.purpose}>
                  {(purpose) =>
                    purpose === "otro" && (
                      <form.Field name="purposeDetail">
                        {(field) => (
                          <Input
                            label="Especificar"
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
            <div className="flex justify-end gap-3 pt-4 border-t border-base-300">
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
    </div>
  );
}
