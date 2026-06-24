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
import type { ClinicAssetKind } from "@finanzas/orpc-contracts/exam-reports";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";

/**
 * Clinic profile panel — datos + logos administrables. Los logos/firma se
 * suben a R2 (presign → PUT directo) y se persisten como URL en ClinicSettings;
 * los generadores de PDF los embeben (fallback al asset local si está vacío).
 */
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
  {
    key: "superintendenciaNumber",
    label: "Prestador Superintendencia de Salud N°",
    placeholder: "Ej. 123456",
  },
];

interface FormState {
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
  logoUrl: string;
  secondaryLogoUrl: string;
  superintendenciaNumber: string;
  papuleThresholdMm: number;
}

const ASSET_MIME = ["image/png", "image/jpeg"];

export function ClinicSettingsPanel() {
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
      logoUrl: settingsQ.data.logoUrl ?? "",
      secondaryLogoUrl: settingsQ.data.secondaryLogoUrl ?? "",
      superintendenciaNumber: settingsQ.data.superintendenciaNumber ?? "",
      papuleThresholdMm: settingsQ.data.papuleThresholdMm,
    });
  }, [settingsQ.data, form]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "clinic-settings"] });

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Sin formulario");
      return examReportsORPCClient.updateClinicSettings({
        ...form,
        doctorRut: form.doctorRut || null,
        signatureUrl: form.signatureUrl || null,
        logoUrl: form.logoUrl || null,
        secondaryLogoUrl: form.secondaryLogoUrl || null,
        superintendenciaNumber: form.superintendenciaNumber || null,
      });
    },
    onSuccess: () => {
      void invalidate();
      toast.success("Datos guardados");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Persiste un asset (logo/firma) de forma inmediata + actualiza el form.
  async function persistAsset(field: keyof FormState, url: string | null) {
    await examReportsORPCClient.updateClinicSettings({ [field]: url });
    setForm((f) => (f ? { ...f, [field]: url ?? "" } : f));
    void invalidate();
  }

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
          Información, logos y firma que aparecen en cada PDF (informes, cotizaciones, presupuestos,
          certificados).
        </p>
      </header>

      {/* Logos + firma (R2, embebidos en PDFs) */}
      <Surface className="rounded-3xl border border-default-100 p-4" variant="default">
        <h3 className="mb-3 font-medium text-foreground">Logos y firma</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <ClinicAssetUploader
            label="Logo principal"
            hint="PNG/JPEG. Se usa en todos los PDFs."
            kind="logo"
            value={form.logoUrl}
            onUploaded={(url) => persistAsset("logoUrl", url)}
            onRemove={() => persistAsset("logoUrl", null)}
            onError={(m) => toast.error(m)}
            onSuccess={(m) => toast.success(m)}
          />
          <ClinicAssetUploader
            label="Logo secundario"
            hint="Opcional (ej. AAAEIC en certificados)."
            kind="secondary-logo"
            value={form.secondaryLogoUrl}
            onUploaded={(url) => persistAsset("secondaryLogoUrl", url)}
            onRemove={() => persistAsset("secondaryLogoUrl", null)}
            onError={(m) => toast.error(m)}
            onSuccess={(m) => toast.success(m)}
          />
          <ClinicAssetUploader
            label="Firma"
            hint="Imagen de la firma del médico."
            kind="signature"
            value={form.signatureUrl}
            onUploaded={(url) => persistAsset("signatureUrl", url)}
            onRemove={() => persistAsset("signatureUrl", null)}
            onError={(m) => toast.error(m)}
            onSuccess={(m) => toast.success(m)}
          />
        </div>
      </Surface>

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
                <NumberField.Group className="grid-cols-1">
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

type ClinicAssetUploaderProps = {
  label: string;
  hint: string;
  kind: ClinicAssetKind;
  value: string;
  onUploaded: (url: string) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

function ClinicAssetUploader({
  label,
  hint,
  kind,
  value,
  onUploaded,
  onRemove,
  onError,
  onSuccess,
}: ClinicAssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!ASSET_MIME.includes(file.type)) {
      onError("Sólo PNG o JPEG (se embeben en el PDF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("Imagen mayor a 5MB.");
      return;
    }
    setBusy(true);
    try {
      const presign = await examReportsORPCClient.presignClinicAsset({
        kind,
        filename: file.name,
        contentType: file.type as "image/png" | "image/jpeg",
      });
      const put = await fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error(`Subida a R2 falló: ${put.status}`);
      await onUploaded(presign.cdnUrl);
      onSuccess(`${label} actualizado`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error subiendo imagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-24 items-center justify-center rounded-xl border border-default-200 border-dashed bg-default-50 p-2">
        {value ? (
          <img alt={label} className="max-h-full max-w-full object-contain" src={value} />
        ) : (
          <ImageIcon className="size-8 text-default-300" />
        )}
      </div>
      <p className="text-default-500 text-xs">{hint}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          isPending={busy}
          onPress={() => inputRef.current?.click()}
        >
          <Upload size={14} /> {value ? "Reemplazar" : "Subir"}
        </Button>
        {value ? (
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            className="text-danger"
            aria-label={`Quitar ${label}`}
            onPress={() => void onRemove()}
          >
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        aria-label={`Subir ${label}`}
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
