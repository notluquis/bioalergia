import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSettings, type AppSettings } from "../context/settings-context";
import Button from "./Button";

const FALLBACK_LOGO_PATH = "/logo192.png";
const determineLogoMode = (logoUrl: string): "url" | "upload" =>
  logoUrl.startsWith("http") || logoUrl.startsWith("/uploads/") ? "url" : "upload";

const fields: Array<{ key: keyof AppSettings; label: string; type?: string; helper?: string }> = [
  { key: "orgName", label: "Nombre de la organización" },
  { key: "tagline", label: "Eslogan", helper: "Texto corto que se muestra en el panel" },
  { key: "primaryColor", label: "Color primario", type: "color" },
  { key: "secondaryColor", label: "Color secundario", type: "color" },
  { key: "supportEmail", label: "Correo de soporte" },
  { key: "orgPhone", label: "Teléfono de contacto" },
  { key: "orgAddress", label: "Dirección" },
  { key: "primaryCurrency", label: "Moneda principal", helper: "Ejemplo: CLP, USD" },
];

interface UploadResponse {
  status: string;
  url?: string;
  message?: string;
}

function isUploadResponse(value: unknown): value is UploadResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.status === "string" &&
    (typeof obj.url === "string" || typeof obj.url === "undefined") &&
    (typeof obj.message === "string" || typeof obj.message === "undefined")
  );
}

export default function SettingsForm() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<"url" | "upload">(determineLogoMode(settings.logoUrl));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoPreviewRef = useRef<string | null>(null);

  const resetLogoSelection = useCallback(() => {
    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
    }
    setLogoPreview(null);
    setLogoFile(null);
  }, []);

  useEffect(() => {
    setForm(settings);
    setLogoMode(determineLogoMode(settings.logoUrl));
    resetLogoSelection();
  }, [settings, resetLogoSelection]);

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) {
        URL.revokeObjectURL(logoPreviewRef.current);
        logoPreviewRef.current = null;
      }
    };
  }, []);

  const handleChange = (key: keyof AppSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  };

  const handleLogoModeChange = (mode: "url" | "upload") => {
    setLogoMode(mode);
    setStatus("idle");
    setError(null);
    if (mode === "url") {
      resetLogoSelection();
    }
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetLogoSelection();
    if (!file) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLogoFile(file);
    logoPreviewRef.current = objectUrl;
    setLogoPreview(objectUrl);
    setError(null);
  };

  const displayedLogo = logoPreview ?? (form.logoUrl || FALLBACK_LOGO_PATH);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  setStatus("saving");
  setError(null);

  try {
    let payload = form;

    if (logoMode === "upload") {
      if (!logoFile) {
        setStatus("error");
        setError("Selecciona un archivo de logo antes de guardar");
        return;
      }

      const formData = new FormData();
      formData.append("logo", logoFile);

      const response = await fetch("/api/settings/logo/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const uploadPayload: unknown = await response.json();

      if (!response.ok) {
        throw new Error("Error de red al subir el logo");
      }
      if (!isUploadResponse(uploadPayload)) {
        throw new Error("Respuesta inválida del servidor");
      }
      if (uploadPayload.status !== "ok" || !uploadPayload.url) {
        throw new Error(uploadPayload.message ?? "No se pudo subir el logo");
      }

      payload = { ...form, logoUrl: uploadPayload.url };
      setForm(payload);
    }

    await updateSettings(payload);
    if (logoMode === "upload") {
      resetLogoSelection();
    }
    setStatus("success");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    setError(message);
    setStatus("error");
  }
};

  return (
    <form onSubmit={handleSubmit} className="glass-card glass-underlay-gradient space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Configuración General</h2>
        <p className="text-sm text-slate-600/90">Personaliza la identidad visual y la información de contacto.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(({ key, label, type, helper }) => (
          <label key={key} className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            {type === "color" ? (
              <input
                type="color"
                value={form[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                className="glass-input h-12 w-20 cursor-pointer px-0"
              />
            ) : (
              <input
                type="text"
                value={form[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                className="glass-input"
                placeholder={label}
              />
            )}
            {helper && <span className="text-xs text-slate-400">{helper}</span>}
          </label>
        ))}
        <div className="col-span-full space-y-3 rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logo institucional</span>
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide">
              <button
                type="button"
                className={`px-3 py-1 ${logoMode === "url" ? "bg-[var(--brand-primary)] text-white" : "text-slate-600"}`}
                onClick={() => handleLogoModeChange("url")}
              >
                Usar URL
              </button>
              <button
                type="button"
                className={`px-3 py-1 ${logoMode === "upload" ? "bg-[var(--brand-primary)] text-white" : "text-slate-600"}`}
                onClick={() => handleLogoModeChange("upload")}
              >
                Subir archivo
              </button>
            </div>
          </div>
          {logoMode === "url" ? (
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="sr-only">URL del logo</span>
              <input
                type="text"
                value={form.logoUrl}
                onChange={(event) => handleChange("logoUrl", event.target.value)}
                className="glass-input"
                placeholder="https://..."
              />
              <span className="text-xs text-slate-400">
                Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo
                (ej: /uploads/branding/logo.png).
              </span>
            </label>
          ) : (
            <div className="space-y-3 text-sm text-slate-600">
              <label className="glass-button inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                Seleccionar archivo
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-white/60 bg-white/80 p-2">
                  <img
                    src={displayedLogo}
                    alt="Vista previa del logo"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  <p>{logoPreview ? "Vista previa sin guardar" : "Logo actual"}</p>
                  <p className="mt-1 break-all text-slate-400">{form.logoUrl}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">
                Tamaño máximo 12&nbsp;MB. Los archivos subidos se guardan en <code className="font-mono">/uploads/branding</code>.
              </span>
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="glass-card border-l-4 border-rose-300/80 bg-gradient-to-r from-rose-50/65 via-white/70 to-white/55 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {status === "success" && !error && (
        <p className="glass-card border-l-4 border-emerald-300/80 bg-gradient-to-r from-emerald-50/70 via-white/70 to-white/55 px-4 py-3 text-sm text-emerald-700">
          La configuración se ha guardado correctamente.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
