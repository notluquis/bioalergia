import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type React from "react";
import { Suspense, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { type AppSettings, useSettings } from "@/context/SettingsContext";
import {
  fetchInternalSettings,
  updateInternalSettings,
  uploadBrandingAsset,
} from "@/features/settings/api";
import { GRID_2_COL_MD } from "@/lib/styles";

import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Input from "../ui/Input";

const FALLBACK_LOGO_PATH = "/logo192.png";
const FALLBACK_FAVICON_PATH = "/icons/icon-192.png";
const determineAssetMode = (value: null | string | undefined): "upload" | "url" => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "upload";
  return trimmed.startsWith("http") || trimmed.startsWith("/") ? "url" : "upload";
};
const determineLogoMode = determineAssetMode;
const determineFaviconMode = determineAssetMode;

const fields: { helper?: string; key: keyof AppSettings; label: string; type?: string }[] = [
  { key: "orgName", label: "Nombre de la organización" },
  { helper: "Texto corto que se muestra en el panel", key: "tagline", label: "Eslogan" },
  {
    helper: "Texto que se mostrará en la pestaña del navegador",
    key: "pageTitle",
    label: "Título de la página",
  },
  { key: "primaryColor", label: "Color primario", type: "color" },
  { key: "secondaryColor", label: "Color secundario", type: "color" },
  { key: "supportEmail", label: "Correo de soporte" },
  { key: "orgPhone", label: "Teléfono de contacto" },
  { key: "orgAddress", label: "Dirección" },
  { helper: "Ejemplo: CLP, USD", key: "primaryCurrency", label: "Moneda principal" },
];

export default function SettingsForm() {
  const { settings, updateSettings } = useSettings();
  const { hasRole } = useAuth();
  const [form, setForm] = useState<AppSettings>(settings);
  const [status, setStatus] = useState<"error" | "idle" | "saving" | "success">("idle");
  const [error, setError] = useState<null | string>(null);

  const [logoMode, setLogoMode] = useState<"upload" | "url">(determineLogoMode(settings.logoUrl));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<null | string>(null);
  const logoPreviewRef = useRef<null | string>(null);

  const [faviconMode, setFaviconMode] = useState<"upload" | "url">(
    determineFaviconMode(settings.faviconUrl),
  );
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<null | string>(null);
  const faviconPreviewRef = useRef<null | string>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const resetLogoSelection = () => {
    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current);
      logoPreviewRef.current = null;
    }
    setLogoPreview(null);
    setLogoFile(null);
  };

  const resetFaviconSelection = () => {
    if (faviconPreviewRef.current) {
      URL.revokeObjectURL(faviconPreviewRef.current);
      faviconPreviewRef.current = null;
    }
    setFaviconPreview(null);
    setFaviconFile(null);
  };

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
  }, [settings]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      if (faviconPreviewRef.current) URL.revokeObjectURL(faviconPreviewRef.current);
    };
  }, []);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      if (faviconPreviewRef.current) URL.revokeObjectURL(faviconPreviewRef.current);
    };
  }, []);

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (args: { endpoint: string; file: File }) =>
      uploadBrandingAsset(args.file, args.endpoint),
  });

  const handleChange = (key: keyof AppSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  };

  const handleLogoModeChange = (mode: "upload" | "url") => {
    setLogoMode(mode);
    setStatus("idle");
    setError(null);
    if (mode === "url") resetLogoSelection();
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetLogoSelection();
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLogoFile(file);
    logoPreviewRef.current = objectUrl;
    setLogoPreview(objectUrl);
    setError(null);
  };

  const handleFaviconModeChange = (mode: "upload" | "url") => {
    setFaviconMode(mode);
    setStatus("idle");
    setError(null);
    if (mode === "url") resetFaviconSelection();
  };

  const handleFaviconFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetFaviconSelection();
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setFaviconFile(file);
    faviconPreviewRef.current = objectUrl;
    setFaviconPreview(objectUrl);
    setError(null);
  };

  const displayedLogo = logoPreview ?? (form.logoUrl || FALLBACK_LOGO_PATH);
  const displayedFavicon = faviconPreview ?? (form.faviconUrl || FALLBACK_FAVICON_PATH);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const payload = { ...form };

      if (logoMode === "upload") {
        if (!logoFile) throw new Error("Selecciona un archivo de logo antes de guardar");
        const url = await uploadMutation.mutateAsync({
          endpoint: "/api/settings/logo/upload",
          file: logoFile,
        });
        payload.logoUrl = url;
      }

      if (faviconMode === "upload") {
        if (!faviconFile) throw new Error("Selecciona un archivo de favicon antes de guardar");
        const url = await uploadMutation.mutateAsync({
          endpoint: "/api/settings/favicon/upload",
          file: faviconFile,
        });
        payload.faviconUrl = url;
      }

      await updateSettings(payload);

      if (logoMode === "upload") resetLogoSelection();
      if (faviconMode === "upload") resetFaviconSelection();

      setStatus("success");
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error inesperado";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <form className="bg-base-100 space-y-6 p-6" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h2 className="text-primary text-lg font-semibold drop-shadow-sm">Configuración General</h2>
        <p className="text-base-content/70 text-sm">
          Personaliza la identidad visual y la información de contacto.
        </p>
      </div>
      <div className={GRID_2_COL_MD}>
        {fields.map(({ helper, key, label, type }) => (
          <label className="text-base-content flex flex-col gap-2 text-sm" key={key}>
            <span className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
              {label}
            </span>
            {type === "color" ? (
              <Input
                className="h-12 w-20 cursor-pointer px-0"
                helper={helper}
                label={label}
                onChange={(event) => {
                  handleChange(key, event.target.value);
                }}
                type="color"
                // eslint-disable-next-line security/detect-object-injection
                value={form[key]}
              />
            ) : (
              (() => {
                const isEmail = key === "supportEmail";
                const isPhone = key === "orgPhone";
                const isName = key === "orgName";

                const inputMode = (() => {
                  if (isEmail) return "email";
                  if (isPhone) return "tel";
                  return "text";
                })();
                const autoComplete = (() => {
                  if (isEmail) return "email";
                  if (isPhone) return "tel";
                  if (isName) return "name";
                  return "off";
                })();

                return (
                  <Input
                    autoComplete={autoComplete}
                    helper={helper}
                    id={key}
                    inputMode={inputMode}
                    label={label}
                    onChange={(event) => {
                      handleChange(key, event.target.value);
                    }}
                    placeholder={label}
                    type={isEmail ? "email" : "text"}
                    // eslint-disable-next-line security/detect-object-injection
                    value={form[key]}
                  />
                );
              })()
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
                onClick={() => {
                  handleLogoModeChange("url");
                }}
                size="sm"
                type="button"
                variant={logoMode === "url" ? "primary" : "secondary"}
              >
                Usar URL
              </Button>
              <Button
                onClick={() => {
                  handleLogoModeChange("upload");
                }}
                size="sm"
                type="button"
                variant={logoMode === "upload" ? "primary" : "secondary"}
              >
                Subir archivo
              </Button>
            </div>
          </div>
          {logoMode === "url" ? (
            <div className="flex flex-col gap-2">
              <Input
                helper="Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej: /uploads/branding/logo.png)."
                label="URL del logo"
                onChange={(event) => {
                  handleChange("logoUrl", event.target.value);
                }}
                placeholder="https://..."
                value={form.logoUrl}
              />
            </div>
          ) : (
            <div className="text-base-content space-y-3 text-sm">
              <div>
                <input
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={handleLogoFileChange}
                  ref={logoInputRef}
                  type="file"
                />
                <Button
                  onClick={() => logoInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Seleccionar archivo
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="border-base-300 bg-base-100 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border p-2">
                  <img
                    alt="Vista previa del logo"
                    className="brand-logo--settings"
                    src={displayedLogo}
                  />
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
                onClick={() => {
                  handleFaviconModeChange("url");
                }}
                size="sm"
                type="button"
                variant={faviconMode === "url" ? "primary" : "secondary"}
              >
                Usar URL
              </Button>
              <Button
                onClick={() => {
                  handleFaviconModeChange("upload");
                }}
                size="sm"
                type="button"
                variant={faviconMode === "upload" ? "primary" : "secondary"}
              >
                Subir archivo
              </Button>
            </div>
          </div>
          {faviconMode === "url" ? (
            <div className="flex flex-col gap-2">
              <Input
                helper="Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej: /uploads/branding/favicon.png)."
                label="URL del favicon"
                onChange={(event) => {
                  handleChange("faviconUrl", event.target.value);
                }}
                placeholder="https://..."
                value={form.faviconUrl}
              />
            </div>
          ) : (
            <div className="text-base-content space-y-3 text-sm">
              <div>
                <input
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={handleFaviconFileChange}
                  ref={faviconInputRef}
                  type="file"
                />
                <Button
                  onClick={() => faviconInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Seleccionar archivo
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="border-base-300 bg-base-100 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border p-2">
                  <img
                    alt="Vista previa del favicon"
                    className="h-full w-full object-contain"
                    src={displayedFavicon}
                  />
                </div>
                <div className="text-base-content/70 text-xs">
                  <p>{faviconPreview ? "Vista previa sin guardar" : "Favicon actual"}</p>
                  <p className="text-base-content/60 mt-1 break-all">{form.faviconUrl}</p>
                </div>
              </div>
              <span className="text-base-content/60 text-xs">
                Usa imágenes cuadradas (ideal 512&nbsp;px) con fondo transparente cuando sea
                posible. Tamaño máximo 12&nbsp;MB.
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
        <Button disabled={uploadMutation.isPending || status === "saving"} type="submit">
          {status === "saving" || uploadMutation.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>

      {hasRole() && (
        <Suspense
          fallback={
            <div className="border-base-300 bg-base-200 mt-6 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Ajustes internos (avanzado)</h3>
              <div className="text-base-content/60 mt-3 flex items-center gap-2 text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Cargando configuración interna...
              </div>
            </div>
          }
        >
          <InternalSettingsSection />
        </Suspense>
      )}
    </form>
  );
}

function InternalSettingsSection() {
  const queryClient = useQueryClient();
  const [upsertChunkSize, setUpsertChunkSize] = useState<number | string>("");

  // Using useSuspenseQuery - we know this component is only rendered if hasRole() is true
  // We assume hasRole() implies necessary permissions or we handle the error via boundary if needed.
  // Actually, standard practice is to use the query.
  const { data: internalData } = useSuspenseQuery({
    queryFn: fetchInternalSettings,
    queryKey: ["settings-internal"],
    staleTime: 0,
  });

  const internalMutation = useMutation({
    mutationFn: (body: object) =>
      updateInternalSettings(body).then((res) => {
        if (res.status !== "ok") throw new Error(res.message ?? "Error al actualizar");
        return res;
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings-internal"] });
    },
  });

  // Effect to sync state with data
  useEffect(() => {
    if (upsertChunkSize === "") {
      setUpsertChunkSize(internalData.internal.upsertChunkSize ?? "");
    }
  }, [internalData, upsertChunkSize]);

  const envUpsertChunkSize = internalData.internal.envUpsertChunkSize ?? null;

  return (
    <div className="border-base-300 bg-base-200 mt-6 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Ajustes internos (avanzado)</h3>
      <p className="text-base-content/70 text-xs">
        Variables internas editables (prefijo BIOALERGIA_X_). Solo administradores.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Input
          helper={`Env var: ${envUpsertChunkSize ?? "(no definido)"}`}
          inputMode="numeric"
          label="Tamaño de chunk para retiros"
          max={5000}
          min={50}
          onChange={(e) => {
            setUpsertChunkSize(e.target.value);
          }}
          type="number"
          value={String(upsertChunkSize)}
        />
        <div className="flex items-end gap-2 md:col-span-2">
          <Button
            disabled={internalMutation.isPending}
            onClick={() => {
              const body =
                upsertChunkSize === "" ? {} : { upsertChunkSize: Number(upsertChunkSize) };
              internalMutation.mutate(body);
            }}
            type="button"
            variant="secondary"
          >
            {internalMutation.isPending ? "Guardando..." : "Guardar ajuste interno"}
          </Button>
          <Button
            onClick={() => {
              internalMutation.mutate({});
            }}
            type="button"
            variant="ghost"
          >
            Eliminar ajuste
          </Button>
        </div>
      </div>
      {internalMutation.isError && (
        <div className="text-error mt-3 text-xs">
          {internalMutation.error instanceof Error ? internalMutation.error.message : "Error"}
        </div>
      )}
    </div>
  );
}
