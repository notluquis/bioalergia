import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSettings, type AppSettings } from "../context/settings-context";
import Button from "./Button";

const FALLBACK_LOGO_PATH = "/logo192.png";
const FALLBACK_FAVICON_PATH = "/logo_bimi.svg";
const determineAssetMode = (value: string): "url" | "upload" => {
  const trimmed = value.trim();
  if (!trimmed) return "upload";
  return trimmed.startsWith("http") || trimmed.startsWith("/") ? "url" : "upload";
};
const determineLogoMode = determineAssetMode;
const determineFaviconMode = determineAssetMode;

const fields: Array<{ key: keyof AppSettings; label: string; type?: string; helper?: string }> = [
  { key: "orgName", label: "Nombre de la organización" },
  { key: "tagline", label: "Eslogan", helper: "Texto corto que se muestra en el panel" },
  { key: "pageTitle", label: "Título de la página", helper: "Texto que se mostrará en la pestaña del navegador" },
  { key: "primaryColor", label: "Color primario", type: "color" },
  { key: "secondaryColor", label: "Color secundario", type: "color" },
  { key: "supportEmail", label: "Correo de soporte" },
  { key: "orgPhone", label: "Teléfono de contacto" },
  { key: "orgAddress", label: "Dirección" },
  { key: "primaryCurrency", label: "Moneda principal", helper: "Ejemplo: CLP, USD" },
  { key: "calendarTimeZone", label: "Zona horaria calendario", helper: "Ejemplo: America/Santiago" },
  { key: "calendarSyncStart", label: "Fecha inicial de sincronización", type: "date" },
  {
    key: "calendarSyncLookaheadDays",
    label: "Días hacia adelante",
    type: "number",
    helper: "Cantidad de días futuros que se sincronizan (máximo 1095)",
  },
  {
    key: "calendarExcludeSummaries",
    label: "Excluir eventos que contengan",
    helper: "Patrones separados por coma. Ej: No Disponible,Vacaciones",
  },
  {
    key: "calendarDailyMaxDays",
    label: "Días listados en vista diaria",
    type: "number",
    helper: "Número máximo de días mostrados (máximo 120)",
  },
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
  const [faviconMode, setFaviconMode] = useState<"url" | "upload">(determineFaviconMode(settings.faviconUrl));
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const faviconPreviewRef = useRef<string | null>(null);

  const resetLogoSelection = useCallback(() => {
    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
    }
    setLogoPreview(null);
    setLogoFile(null);
  }, []);

  const resetFaviconSelection = useCallback(() => {
    if (faviconPreviewRef.current) {
      URL.revokeObjectURL(faviconPreviewRef.current);
      faviconPreviewRef.current = null;
    }
    setFaviconPreview(null);
    setFaviconFile(null);
  }, []);

  useEffect(() => {
    setForm(settings);
    setLogoMode(determineLogoMode(settings.logoUrl));
    setFaviconMode(determineFaviconMode(settings.faviconUrl));
    resetLogoSelection();
    resetFaviconSelection();
  }, [settings, resetLogoSelection, resetFaviconSelection]);

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) {
        URL.revokeObjectURL(logoPreviewRef.current);
        logoPreviewRef.current = null;
      }
      if (faviconPreviewRef.current) {
        URL.revokeObjectURL(faviconPreviewRef.current);
        faviconPreviewRef.current = null;
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
  const displayedFavicon = faviconPreview ?? (form.faviconUrl || FALLBACK_FAVICON_PATH);

  const handleFaviconModeChange = (mode: "url" | "upload") => {
    setFaviconMode(mode);
    setStatus("idle");
    setError(null);
    if (mode === "url") {
      resetFaviconSelection();
    }
  };

  const handleFaviconFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetFaviconSelection();
    if (!file) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setFaviconFile(file);
    faviconPreviewRef.current = objectUrl;
    setFaviconPreview(objectUrl);
    setError(null);
  };

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

      if (faviconMode === "upload") {
        if (!faviconFile) {
          setStatus("error");
          setError("Selecciona un archivo de favicon antes de guardar");
          return;
        }

        const formData = new FormData();
        formData.append("favicon", faviconFile);

        const response = await fetch("/api/settings/favicon/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        const uploadPayload: unknown = await response.json();

        if (!response.ok) {
          throw new Error("Error de red al subir el favicon");
        }
        if (!isUploadResponse(uploadPayload)) {
          throw new Error("Respuesta inválida del servidor");
        }
        if (uploadPayload.status !== "ok" || !uploadPayload.url) {
          throw new Error(uploadPayload.message ?? "No se pudo subir el favicon");
        }

        payload = { ...payload, faviconUrl: uploadPayload.url };
        setForm(payload);
      }

      await updateSettings(payload);
      if (logoMode === "upload") {
        resetLogoSelection();
      }
      if (faviconMode === "upload") {
        resetFaviconSelection();
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
        <div className="col-span-full space-y-3 rounded-2xl border border-white/40 bg-white/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Favicon del sitio</span>
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-semibold uppercase tracking-wide">
              <button
                type="button"
                className={`px-3 py-1 ${faviconMode === "url" ? "bg-[var(--brand-primary)] text-white" : "text-slate-600"}`}
                onClick={() => handleFaviconModeChange("url")}
              >
                Usar URL
              </button>
              <button
                type="button"
                className={`px-3 py-1 ${faviconMode === "upload" ? "bg-[var(--brand-primary)] text-white" : "text-slate-600"}`}
                onClick={() => handleFaviconModeChange("upload")}
              >
                Subir archivo
              </button>
            </div>
          </div>
          {faviconMode === "url" ? (
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="sr-only">URL del favicon</span>
              <input
                type="text"
                value={form.faviconUrl}
                onChange={(event) => handleChange("faviconUrl", event.target.value)}
                className="glass-input"
                placeholder="https://..."
              />
              <span className="text-xs text-slate-400">
                Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo
                (ej: /uploads/branding/favicon.png).
              </span>
            </label>
          ) : (
            <div className="space-y-3 text-sm text-slate-600">
              <label className="glass-button inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={handleFaviconFileChange}
                />
                Seleccionar archivo
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/60 bg-white/80 p-2">
                  <img
                    src={displayedFavicon}
                    alt="Vista previa del favicon"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  <p>{faviconPreview ? "Vista previa sin guardar" : "Favicon actual"}</p>
                  <p className="mt-1 break-all text-slate-400">{form.faviconUrl}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">
                Usa imágenes cuadradas (ideal 512&nbsp;px) con fondo transparente cuando sea posible. Tamaño máximo 12&nbsp;MB.
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
