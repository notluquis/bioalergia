import {
  Button,
  Form,
  Input,
  Label,
  NumberField,
  Spinner,
  Surface,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";

export const Route = createFileRoute("/_authed/settings/clinic")({
  staticData: {
    nav: {
      iconKey: "Building2",
      label: "Datos Clínica",
      order: 65,
      section: "Sistema",
    },
    permission: { action: "read", subject: "Patient" },
    title: "Datos de la clínica",
  },
  component: ClinicSettingsPage,
});

const FIELDS: { key: keyof FormState; label: string; placeholder?: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "address", label: "Dirección" },
  { key: "phoneWhatsapp", label: "WhatsApp" },
  { key: "phoneLandline", label: "Teléfono fijo" },
  { key: "email", label: "Email" },
  { key: "website", label: "Web principal" },
  { key: "websiteSecondary", label: "Web secundaria" },
  { key: "defaultReagents", label: "Reactivos por defecto" },
  { key: "defaultTechnique", label: "Técnica por defecto" },
  { key: "doctorName", label: "Doctor (nombre)" },
  { key: "doctorSpecialty", label: "Doctor (especialidad)" },
  { key: "doctorRut", label: "Doctor (RUT)" },
  { key: "signatureUrl", label: "Firma (URL imagen)" },
];

type FormState = {
  name: string;
  address: string;
  phoneWhatsapp: string;
  phoneLandline: string;
  email: string;
  website: string;
  websiteSecondary: string;
  defaultReagents: string;
  defaultTechnique: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorRut: string;
  signatureUrl: string;
  papuleThresholdMm: number;
};

function ClinicSettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const settingsQ = useQuery(examReportsKeys.clinicSettings());

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!settingsQ.data || form) return;
    setForm({
      name: settingsQ.data.name,
      address: settingsQ.data.address,
      phoneWhatsapp: settingsQ.data.phoneWhatsapp,
      phoneLandline: settingsQ.data.phoneLandline,
      email: settingsQ.data.email,
      website: settingsQ.data.website,
      websiteSecondary: settingsQ.data.websiteSecondary,
      defaultReagents: settingsQ.data.defaultReagents,
      defaultTechnique: settingsQ.data.defaultTechnique,
      doctorName: settingsQ.data.doctorName,
      doctorSpecialty: settingsQ.data.doctorSpecialty,
      doctorRut: settingsQ.data.doctorRut ?? "",
      signatureUrl: settingsQ.data.signatureUrl ?? "",
      papuleThresholdMm: settingsQ.data.papuleThresholdMm,
    });
  }, [settingsQ.data, form]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Sin formulario");
      return examReportsORPCClient.updateClinicSettings({
        ...form,
        doctorRut: form.doctorRut || null,
        signatureUrl: form.signatureUrl || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "clinic-settings"] });
      toast.success("Datos guardados");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!form) {
    return (
      <div className="flex items-center gap-2 p-6 text-default-600">
        <Spinner size="sm" /> Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h2 className="font-semibold text-foreground text-xl">Datos de la clínica</h2>
        <p className="text-default-600 text-sm">
          Información que aparece en el footer y firma de cada PDF de informe.
        </p>
      </header>

      <Surface className="rounded-3xl border border-default-100 p-4" variant="default">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {FIELDS.map((f) => (
              <TextField
                className="w-full"
                key={f.key}
                name={f.key}
                onChange={(v) => setForm({ ...form, [f.key]: v })}
                value={String(form[f.key] ?? "")}
              >
                <Label>{f.label}</Label>
                <Input placeholder={f.placeholder} />
              </TextField>
            ))}
            <div className="space-y-1">
              <Label>Umbral pápula (mm)</Label>
              <NumberField
                aria-label="Umbral pápula"
                formatOptions={{ maximumFractionDigits: 1 }}
                minValue={0}
                onChange={(v) =>
                  setForm({ ...form, papuleThresholdMm: Number.isFinite(v) ? v : 3 })
                }
                value={form.papuleThresholdMm}
              >
                <NumberField.Group>
                  <NumberField.Input />
                </NumberField.Group>
              </NumberField>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button isPending={save.isPending} type="submit">
              <Save className="size-4" />
              Guardar
            </Button>
          </div>
        </Form>
      </Surface>
    </div>
  );
}
