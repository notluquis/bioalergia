import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSettings, type AppSettings } from "../../context/SettingsContext";
import { useAuth } from "../../context/AuthContext";
import Button from "../ui/Button";
import Alert from "../ui/Alert";

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
  const { hasRole } = useAuth();
  const [form, setForm] = useState<AppSettings>(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [upsertChunkSize, setUpsertChunkSize] = useState<number | string>("");
  const [envUpsertChunkSize, setEnvUpsertChunkSize] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<"url" | "upload">(determineLogoMode(settings.logoUrl));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoPreviewRef = useRef<string | null>(null);
  const [faviconMode, setFaviconMode] = useState<"url" | "upload">(determineFaviconMode(settings.faviconUrl));
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const faviconPreviewRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

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
    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
    }
    if (faviconPreviewRef.current) {
      URL.revokeObjectURL(faviconPreviewRef.current);
      faviconPreviewRef.current = null;
    }
    setLogoPreview(null);
    setLogoFile(null);
    setFaviconPreview(null);
    setFaviconFile(null);

    // load internal setting if user can edit (with AbortController for cleanup)
    if (!hasRole("GOD", "ADMIN")) return;

    const controller = new AbortController();

    (async () => {
      try {
        setInternalLoading(true);
        const res = await fetch("/api/settings/internal", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("No se pudo cargar la configuración interna");
        const payload = await res.json();
        if (!controller.signal.aborted) {
          setUpsertChunkSize(payload?.internal?.upsertChunkSize ?? "");
          setEnvUpsertChunkSize(payload?.internal?.envUpsertChunkSize ?? null);
        }
      } catch {
        // Silently ignore aborted requests and errors loading internal settings
      } finally {
        if (!controller.signal.aborted) {
          setInternalLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [settings, hasRole]);
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
    <form onSubmit={handleSubmit} className="bg-base-100 space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Configuración General</h2>
        <p className="text-sm text-base-content/70">Personaliza la identidad visual y la información de contacto.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(({ key, label, type, helper }) => (
          <label key={key} className="flex flex-col gap-2 text-sm text-base-content">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/80">{label}</span>
            {type === "color" ? (
              <input
                type="color"
                value={form[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                className="h-12 w-20 cursor-pointer px-0"
              />
            ) : (
              <input
                type="text"
                value={form[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                className="input input-bordered"
                placeholder={label}
                inputMode={key === "orgPhone" ? "tel" : key === "supportEmail" ? "email" : undefined}
                autoComplete={key === "orgPhone" ? "tel" : key === "supportEmail" ? "email" : undefined}
              />
            )}
            {helper && <span className="text-xs text-base-content/60">{helper}</span>}
          </label>
        ))}
        <div className="col-span-full space-y-3 rounded-2xl border border-base-300 bg-base-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/80">
              Logo institucional
            </span>
            <div className="btn-group">
              <Button
                type="button"
                size="sm"
                variant={logoMode === "url" ? "primary" : "secondary"}
                onClick={() => handleLogoModeChange("url")}
              >
                Usar URL
              </Button>
              <Button
                type="button"
                size="sm"
                variant={logoMode === "upload" ? "primary" : "secondary"}
                onClick={() => handleLogoModeChange("upload")}
              >
                Subir archivo
              </Button>
            </div>
          </div>
          {logoMode === "url" ? (
            <label className="flex flex-col gap-2 text-sm text-base-content">
              <span className="sr-only">URL del logo</span>
              <input
                type="text"
                value={form.logoUrl}
                onChange={(event) => handleChange("logoUrl", event.target.value)}
                className="input input-bordered"
                placeholder="https://..."
              />
              <span className="text-xs text-base-content/60">
                Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej:
                /uploads/branding/logo.png).
              </span>
            </label>
          ) : (
            <div className="space-y-3 text-sm text-base-content">
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => logoInputRef.current?.click()}>
                  Seleccionar archivo
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-base-300 bg-base-100 p-2">
                  <img src={displayedLogo} alt="Vista previa del logo" className="brand-logo--settings" />
                </div>
                <div className="text-xs text-base-content/70">
                  <p>{logoPreview ? "Vista previa sin guardar" : "Logo actual"}</p>
                  <p className="mt-1 break-all text-base-content/60">{form.logoUrl}</p>
                </div>
              </div>
              <span className="text-xs text-base-content/60">
                Tamaño máximo 12&nbsp;MB. Los archivos subidos se guardan en{" "}
                <code className="font-mono">/uploads/branding</code>.
              </span>
            </div>
          )}
        </div>
        <div className="col-span-full space-y-3 rounded-2xl border border-base-300 bg-base-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/80">
              Favicon del sitio
            </span>
            <div className="btn-group">
              <Button
                type="button"
                size="sm"
                variant={faviconMode === "url" ? "primary" : "secondary"}
                onClick={() => handleFaviconModeChange("url")}
              >
                Usar URL
              </Button>
              <Button
                type="button"
                size="sm"
                variant={faviconMode === "upload" ? "primary" : "secondary"}
                onClick={() => handleFaviconModeChange("upload")}
              >
                Subir archivo
              </Button>
            </div>
          </div>
          {faviconMode === "url" ? (
            <label className="flex flex-col gap-2 text-sm text-base-content">
              <span className="sr-only">URL del favicon</span>
              <input
                type="text"
                value={form.faviconUrl}
                onChange={(event) => handleChange("faviconUrl", event.target.value)}
                className="input input-bordered"
                placeholder="https://..."
              />
              <span className="text-xs text-base-content/60">
                Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej:
                /uploads/branding/favicon.png).
              </span>
            </label>
          ) : (
            <div className="space-y-3 text-sm text-base-content">
              <div>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={handleFaviconFileChange}
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => faviconInputRef.current?.click()}>
                  Seleccionar archivo
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-base-300 bg-base-100 p-2">
                  <img src={displayedFavicon} alt="Vista previa del favicon" className="h-full w-full object-contain" />
                </div>
                <div className="text-xs text-base-content/70">
                  <p>{faviconPreview ? "Vista previa sin guardar" : "Favicon actual"}</p>
                  <p className="mt-1 break-all text-base-content/60">{form.faviconUrl}</p>
                </div>
              </div>
              <span className="text-xs text-base-content/60">
                Usa imágenes cuadradas (ideal 512&nbsp;px) con fondo transparente cuando sea posible. Tamaño máximo
                12&nbsp;MB.
              </span>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="col-span-full">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {status === "success" && !error && (
        <div className="col-span-full">
          <Alert variant="success">La configuración se ha guardado correctamente.</Alert>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
      {hasRole() && (
        <div className="mt-6 rounded-lg border border-base-300 bg-base-200 p-4">
          <h3 className="text-sm font-semibold">Ajustes internos (avanzado)</h3>
          <p className="text-xs text-base-content/70">
            Variables internas editables (prefijo BIOALERGIA_X_). Solo administradores.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-base-content">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/80">
                Tamaño de chunk para retiros
              </span>
              <input
                type="number"
                min={50}
                max={5000}
                value={String(upsertChunkSize ?? "")}
                onChange={(e) => setUpsertChunkSize(e.target.value)}
                className="input input-bordered"
                inputMode="numeric"
              />
              <span className="text-xs text-base-content/60">
                Env var: <code>{envUpsertChunkSize ?? "(no definido)"}</code>
              </span>
            </label>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button
                type="button"
                variant="secondary"
                disabled={internalLoading}
                onClick={async () => {
                  setInternalError(null);
                  setInternalLoading(true);
                  try {
                    const body = upsertChunkSize === "" ? {} : { upsertChunkSize: Number(upsertChunkSize) };
                    const res = await fetch("/api/settings/internal", {
                      method: "PUT",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    const payload = await res.json();
                    if (!res.ok || payload?.status !== "ok") {
                      throw new Error(payload?.message || "No se pudo actualizar la configuración interna");
                    }
                    setInternalError(null);
                    // refresh env info
                    const r2 = await fetch("/api/settings/internal", { credentials: "include" });
                    const p2 = await r2.json();
                    setUpsertChunkSize(p2?.internal?.upsertChunkSize ?? "");
                    setEnvUpsertChunkSize(p2?.internal?.envUpsertChunkSize ?? null);
                  } catch (err) {
                    setInternalError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setInternalLoading(false);
                  }
                }}
              >
                {internalLoading ? "Guardando..." : "Guardar ajuste interno"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  setInternalError(null);
                  setInternalLoading(true);
                  try {
                    const res = await fetch("/api/settings/internal", {
                      method: "PUT",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    if (!res.ok) throw new Error("No se pudo eliminar la configuración");
                    setUpsertChunkSize("");
                    setEnvUpsertChunkSize(null);
                  } catch (err) {
                    setInternalError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setInternalLoading(false);
                  }
                }}
              >
                Eliminar ajuste
              </Button>
            </div>
          </div>
          {internalError && <div className="mt-3 text-xs text-error">{internalError}</div>}
        </div>
      )}
    </form>
  );
}
