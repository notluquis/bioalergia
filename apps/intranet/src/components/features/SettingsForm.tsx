import { ButtonGroup } from "@heroui/react";
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

import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileInput } from "../ui/FileInput";
import { Input } from "../ui/Input";

const FALLBACK_LOGO_PATH = "/logo192.png";
const FALLBACK_FAVICON_PATH = "/icons/icon-192.png";
const determineAssetMode = (value: null | string | undefined): "upload" | "url" => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "upload";
  }
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

async function resolveAssetUrlIfNeeded(params: {
  endpoint: string;
  file: File | null;
  mode: "upload" | "url";
  mutation: (args: { endpoint: string; file: File }) => Promise<string>;
  requiredFileMessage: string;
}) {
  if (params.mode !== "upload") {
    return null;
  }
  if (!params.file) {
    throw new Error(params.requiredFileMessage);
  }
  return params.mutation({
    endpoint: params.endpoint,
    file: params.file,
  });
}
export function SettingsForm() {
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
      if (logoPreviewRef.current) {
        URL.revokeObjectURL(logoPreviewRef.current);
      }
      if (faviconPreviewRef.current) {
        URL.revokeObjectURL(faviconPreviewRef.current);
      }
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

  const handleFaviconModeChange = (mode: "upload" | "url") => {
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

  const displayedLogo = logoPreview ?? (form.logoUrl || FALLBACK_LOGO_PATH);
  const displayedFavicon = faviconPreview ?? (form.faviconUrl || FALLBACK_FAVICON_PATH);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const payload = { ...form };
      const uploadAsset = (args: { endpoint: string; file: File }) =>
        uploadMutation.mutateAsync(args);

      const logoUrl = await resolveAssetUrlIfNeeded({
        endpoint: "/api/settings/logo/upload",
        file: logoFile,
        mode: logoMode,
        mutation: uploadAsset,
        requiredFileMessage: "Selecciona un archivo de logo antes de guardar",
      });
      if (logoUrl) {
        payload.logoUrl = logoUrl;
      }

      const faviconUrl = await resolveAssetUrlIfNeeded({
        endpoint: "/api/settings/favicon/upload",
        file: faviconFile,
        mode: faviconMode,
        mutation: uploadAsset,
        requiredFileMessage: "Selecciona un archivo de favicon antes de guardar",
      });
      if (faviconUrl) {
        payload.faviconUrl = faviconUrl;
      }

      await updateSettings(payload);

      if (logoMode === "upload") {
        resetLogoSelection();
      }
      if (faviconMode === "upload") {
        resetFaviconSelection();
      }

      setStatus("success");
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error inesperado";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <form className="space-y-6 bg-background p-6" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h2 className="font-semibold text-lg text-primary drop-shadow-sm">Configuración General</h2>
        <p className="text-default-600 text-sm">
          Personaliza la identidad visual y la información de contacto.
        </p>
      </div>
      <div className={GRID_2_COL_MD}>
        <GeneralSettingsFields form={form} onChange={handleChange} />
        <LogoSection
          logoMode={logoMode}
          logoPreview={logoPreview}
          logoUrl={form.logoUrl}
          onFileChange={handleLogoFileChange}
          onModeChange={handleLogoModeChange}
          onUrlChange={(value) => handleChange("logoUrl", value)}
          previewUrl={displayedLogo}
        />

        <FaviconSection
          faviconMode={faviconMode}
          faviconPreview={faviconPreview}
          faviconUrl={form.faviconUrl}
          onFileChange={handleFaviconFileChange}
          onModeChange={handleFaviconModeChange}
          onUrlChange={(value) => handleChange("faviconUrl", value)}
          previewUrl={displayedFavicon}
        />
      </div>
      {error && (
        <div className="col-span-full">
          <Alert status="danger">{error}</Alert>
        </div>
      )}
      {status === "success" && !error && (
        <div className="col-span-full">
          <Alert status="success">La configuración se ha guardado correctamente.</Alert>
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
            <div className="mt-6 rounded-lg border border-default-200 bg-default-50 p-4">
              <h3 className="font-semibold text-sm">Ajustes internos (avanzado)</h3>
              <div className="mt-3 flex items-center gap-2 text-default-500 text-sm">
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

function GeneralSettingsFields({
  form,
  onChange,
}: {
  form: AppSettings;
  onChange: (key: keyof AppSettings, value: string) => void;
}) {
  return (
    <>
      {fields.map(({ helper, key, label, type }) => (
        <div className="flex flex-col gap-2 text-foreground text-sm" key={key}>
          <span className="font-semibold text-default-700 text-xs uppercase tracking-wide">
            {label}
          </span>
          {type === "color" ? (
            <Input
              className="h-12 w-20 cursor-pointer px-0"
              helper={helper}
              label={label}
              onChange={(event) => {
                onChange(key, event.target.value);
              }}
              type="color"
              // eslint-disable-next-line security/detect-object-injection
              value={form[key]}
            />
          ) : (
            <TextSettingInput
              fieldKey={key}
              form={form}
              helper={helper}
              label={label}
              onChange={onChange}
            />
          )}
        </div>
      ))}
    </>
  );
}

function TextSettingInput({
  form,
  helper,
  label,
  onChange,
  fieldKey,
}: {
  form: AppSettings;
  helper?: string;
  label: string;
  onChange: (key: keyof AppSettings, value: string) => void;
  fieldKey: keyof AppSettings;
}) {
  const isEmail = fieldKey === "supportEmail";
  const isPhone = fieldKey === "orgPhone";
  const isName = fieldKey === "orgName";

  const inputMode = isEmail ? "email" : isPhone ? "tel" : "text";
  const autoComplete = isEmail ? "email" : isPhone ? "tel" : isName ? "name" : "off";

  return (
    <Input
      autoComplete={autoComplete}
      helper={helper}
      id={fieldKey}
      inputMode={inputMode}
      label={label}
      onChange={(event) => {
        onChange(fieldKey, event.target.value);
      }}
      placeholder={label}
      type={isEmail ? "email" : "text"}
      // eslint-disable-next-line security/detect-object-injection
      value={form[fieldKey]}
    />
  );
}

function LogoSection({
  logoMode,
  logoPreview,
  logoUrl,
  onFileChange,
  onModeChange,
  onUrlChange,
  previewUrl,
}: {
  logoMode: "upload" | "url";
  logoPreview: null | string;
  logoUrl: string | null | undefined;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onModeChange: (mode: "upload" | "url") => void;
  onUrlChange: (value: string) => void;
  previewUrl: string;
}) {
  return (
    <div className="col-span-full space-y-3 rounded-2xl border border-default-200 bg-default-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-default-700 text-xs uppercase tracking-wide">
          Logo institucional
        </span>
        <ButtonGroup>
          <Button
            onClick={() => {
              onModeChange("url");
            }}
            size="sm"
            type="button"
            variant={logoMode === "url" ? "primary" : "secondary"}
          >
            Usar URL
          </Button>
          <Button
            onClick={() => {
              onModeChange("upload");
            }}
            size="sm"
            type="button"
            variant={logoMode === "upload" ? "primary" : "secondary"}
          >
            Subir archivo
          </Button>
        </ButtonGroup>
      </div>
      {logoMode === "url" ? (
        <div className="flex flex-col gap-2">
          <Input
            helper="Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej: /uploads/branding/logo.png)."
            label="URL del logo"
            onChange={(event) => {
              onUrlChange(event.target.value);
            }}
            placeholder="https://..."
            value={logoUrl ?? ""}
          />
        </div>
      ) : (
        <div className="space-y-3 text-foreground text-sm">
          <FileInput
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="min-h-20"
            label="Logo"
            onChange={onFileChange}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-default-200 bg-background p-2">
              <img alt="Vista previa del logo" className="brand-logo--settings" src={previewUrl} />
            </div>
            <div className="text-default-600 text-xs">
              <p>{logoPreview ? "Vista previa sin guardar" : "Logo actual"}</p>
              <p className="mt-1 break-all text-default-500">{logoUrl}</p>
            </div>
          </div>
          <span className="text-default-500 text-xs">
            Tamaño máximo 12&nbsp;MB. Los archivos subidos se guardan en{" "}
            <code className="font-mono">/uploads/branding</code>.
          </span>
        </div>
      )}
    </div>
  );
}

function FaviconSection({
  faviconMode,
  faviconPreview,
  faviconUrl,
  onFileChange,
  onModeChange,
  onUrlChange,
  previewUrl,
}: {
  faviconMode: "upload" | "url";
  faviconPreview: null | string;
  faviconUrl: string | null | undefined;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onModeChange: (mode: "upload" | "url") => void;
  onUrlChange: (value: string) => void;
  previewUrl: string;
}) {
  return (
    <div className="col-span-full space-y-3 rounded-2xl border border-default-200 bg-default-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-default-700 text-xs uppercase tracking-wide">
          Favicon del sitio
        </span>
        <ButtonGroup>
          <Button
            onClick={() => {
              onModeChange("url");
            }}
            size="sm"
            type="button"
            variant={faviconMode === "url" ? "primary" : "secondary"}
          >
            Usar URL
          </Button>
          <Button
            onClick={() => {
              onModeChange("upload");
            }}
            size="sm"
            type="button"
            variant={faviconMode === "upload" ? "primary" : "secondary"}
          >
            Subir archivo
          </Button>
        </ButtonGroup>
      </div>
      {faviconMode === "url" ? (
        <div className="flex flex-col gap-2">
          <Input
            helper="Puedes usar una URL pública (https://) o una ruta interna generada tras subir un archivo (ej: /uploads/branding/favicon.png)."
            label="URL del favicon"
            onChange={(event) => {
              onUrlChange(event.target.value);
            }}
            placeholder="https://..."
            value={faviconUrl ?? ""}
          />
        </div>
      ) : (
        <div className="space-y-3 text-foreground text-sm">
          <FileInput
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon,image/vnd.microsoft.icon"
            className="min-h-20"
            label="Favicon"
            onChange={onFileChange}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-default-200 bg-background p-2">
              <img
                alt="Vista previa del favicon"
                className="h-full w-full object-contain"
                src={previewUrl}
              />
            </div>
            <div className="text-default-600 text-xs">
              <p>{faviconPreview ? "Vista previa sin guardar" : "Favicon actual"}</p>
              <p className="mt-1 break-all text-default-500">{faviconUrl}</p>
            </div>
          </div>
          <span className="text-default-500 text-xs">
            Usa imágenes cuadradas (ideal 512&nbsp;px) con fondo transparente cuando sea posible.
            Tamaño máximo 12&nbsp;MB.
          </span>
        </div>
      )}
    </div>
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
        if (res.status !== "ok") {
          throw new Error(res.message ?? "Error al actualizar");
        }
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
    <div className="mt-6 rounded-lg border border-default-200 bg-default-50 p-4">
      <h3 className="font-semibold text-sm">Ajustes internos (avanzado)</h3>
      <p className="text-default-600 text-xs">
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
        <div className="mt-3 text-danger text-xs">
          {internalMutation.error instanceof Error ? internalMutation.error.message : "Error"}
        </div>
      )}
    </div>
  );
}
