import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSettings, type AppSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Alert from "../ui/Alert";
import { GRID_2_COL_MD } from "@/lib/styles";

const FALLBACK_LOGO_PATH = "/logo192.png";
const FALLBACK_FAVICON_PATH = "/logo_bimi.svg";
const determineAssetMode = (value: string | undefined | null): "url" | "upload" => {
  const trimmed = (value || "").trim();
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
  const { hasRole, can } = useAuth();
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
    setFaviconFile(null);

    // load internal setting if user can edit (with AbortController for cleanup)
    if (!can("manage", "Setting")) return;

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
  }, [settings, hasRole, can]);
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
        <h2 className="text-primary text-lg font-semibold drop-shadow-sm">Configuración General</h2>
        <p className="text-base-content/70 text-sm">Personaliza la identidad visual y la información de contacto.</p>
      </div>
      <div className={GRID_2_COL_MD}>
        {fields.map(({ key, label, type, helper }) => (
          <label key={key} className="text-base-content flex flex-col gap-2 text-sm">
            <span className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">{label}</span>
            {type === "color" ? (
              <Input
                type="color"
                label={label}
                helper={helper}
                value={form[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                className="h-12 w-20 cursor-pointer px-0"
              />
            ) : (
              <Input
                label={label}
                helper={helper}
                type="text"
                value={form[key]}
                onChange={(event) => handleChange(key, event.target.value)}
                placeholder={label}
                inputMode={key === "orgPhone" ? "tel" : key === "supportEmail" ? "email" : undefined}
                autoComplete={key === "orgPhone" ? "tel" : key === "supportEmail" ? "email" : undefined}
              />
            )}
          </label>
        ))}
        <div className="border-base-300 bg-base-200 col-span-full space-y-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
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
            <div className="flex flex-col gap-2">
              <Input
                label="URL del logo"
                value={form.logoUrl}
                onChange={(event) => handleChange("logoUrl", event.target.value)}
                placeholder="https://..."
                helper="Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej: /uploads/branding/logo.png)."
              />
            </div>
          ) : (
            <div className="text-base-content space-y-3 text-sm">
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
                <div className="border-base-300 bg-base-100 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border p-2">
                  <img src={displayedLogo} alt="Vista previa del logo" className="brand-logo--settings" />
                </div>
                <div className="text-base-content/70 text-xs">
                  <p>{logoPreview ? "Vista previa sin guardar" : "Logo actual"}</p>
                  <p className="text-base-content/60 mt-1 break-all">{form.logoUrl}</p>
                </div>
              </div>
              <span className="text-base-content/60 text-xs">
                Tamaño máximo 12&nbsp;MB. Los archivos subidos se guardan en{" "}
                <code className="font-mono">/uploads/branding</code>.
              </span>
            </div>
          )}
        </div>
        <div className="border-base-300 bg-base-200 col-span-full space-y-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
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
            <div className="flex flex-col gap-2">
              <Input
                label="URL del favicon"
                value={form.faviconUrl}
                onChange={(event) => handleChange("faviconUrl", event.target.value)}
                placeholder="https://..."
                helper="Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej: /uploads/branding/favicon.png)."
              />
            </div>
          ) : (
            <div className="text-base-content space-y-3 text-sm">
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
                <div className="border-base-300 bg-base-100 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border p-2">
                  <img src={displayedFavicon} alt="Vista previa del favicon" className="h-full w-full object-contain" />
                </div>
                <div className="text-base-content/70 text-xs">
                  <p>{faviconPreview ? "Vista previa sin guardar" : "Favicon actual"}</p>
                  <p className="text-base-content/60 mt-1 break-all">{form.faviconUrl}</p>
                </div>
              </div>
              <span className="text-base-content/60 text-xs">
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
        <div className="border-base-300 bg-base-200 mt-6 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Ajustes internos (avanzado)</h3>
          <p className="text-base-content/70 text-xs">
            Variables internas editables (prefijo BIOALERGIA_X_). Solo administradores.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Input
              type="number"
              label="Tamaño de chunk para retiros"
              min={50}
              max={5000}
              value={String(upsertChunkSize ?? "")}
              onChange={(e) => setUpsertChunkSize(e.target.value)}
              inputMode="numeric"
              helper={`Env var: ${envUpsertChunkSize ?? "(no definido)"}`}
            />
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
          {internalError && <div className="text-error mt-3 text-xs">{internalError}</div>}
        </div>
      )}
    </form>
  );
}
