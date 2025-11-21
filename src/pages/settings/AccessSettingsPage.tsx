import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useSettings, type AppSettings } from "../../context/settings-context";

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type AccessForm = Pick<AppSettings, "dbDisplayHost" | "dbDisplayName" | "dbConsoleUrl" | "cpanelUrl">;

export default function AccessSettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<AccessForm>(() => ({
    dbDisplayHost: settings.dbDisplayHost,
    dbDisplayName: settings.dbDisplayName,
    dbConsoleUrl: settings.dbConsoleUrl,
    cpanelUrl: settings.cpanelUrl,
  }));
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      dbDisplayHost: settings.dbDisplayHost,
      dbDisplayName: settings.dbDisplayName,
      dbConsoleUrl: settings.dbConsoleUrl,
      cpanelUrl: settings.cpanelUrl,
    });
  }, [settings]);

  const quickLinks = useMemo(
    () => [
      {
        label: "Abrir cPanel",
        href: normalizeExternalUrl(settings.cpanelUrl),
        description: settings.cpanelUrl ? settings.cpanelUrl : "Configura el enlace directo al cPanel.",
      },
      {
        label: "Abrir consola DB",
        href: normalizeExternalUrl(settings.dbConsoleUrl),
        description: settings.dbConsoleUrl
          ? settings.dbConsoleUrl
          : "Configura el acceso a la consola de la base de datos.",
      },
    ],
    [settings.cpanelUrl, settings.dbConsoleUrl]
  );

  const handleChange = (key: keyof AccessForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await updateSettings({
        ...settings,
        ...form,
        dbConsoleUrl: normalizeExternalUrl(form.dbConsoleUrl),
        cpanelUrl: normalizeExternalUrl(form.cpanelUrl),
      });
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la configuración";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-base-100 space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Accesos rápidos</h2>
          <p className="text-sm text-base-content/70">
            Lanza los paneles que usas con frecuencia y mantén visible la información clave de la base de datos.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => link.href && window.open(link.href, "_blank", "noopener,noreferrer")}
              disabled={!link.href}
              className="flex flex-col rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-left text-sm text-base-content/70 transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-semibold text-base-content">{link.label}</span>
              <span className="text-xs text-base-content/60">{link.description}</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="bg-base-100 space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-secondary drop-shadow-sm">Detalle de conexiones</h2>
          <p className="text-sm text-base-content/70">
            Documenta cómo acceder a los paneles y la base de datos para el equipo técnico.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Servidor visible</span>
            <Input
              type="text"
              value={form.dbDisplayHost}
              onChange={(event) => handleChange("dbDisplayHost", event.target.value)}
              placeholder="Ej: db.bioalergia.cl"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Nombre de la base
            </span>
            <Input
              type="text"
              value={form.dbDisplayName}
              onChange={(event) => handleChange("dbDisplayName", event.target.value)}
              placeholder="Ej: bio_finanzas"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              URL consola DB (https)
            </span>
            <Input
              type="url"
              value={form.dbConsoleUrl}
              onChange={(event) => handleChange("dbConsoleUrl", event.target.value)}
              placeholder="https://"
            />
            <span className="text-xs text-base-content/50">Se normaliza automáticamente para incluir https://</span>
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-base-content/70">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              URL cPanel (https)
            </span>
            <Input
              type="url"
              value={form.cpanelUrl}
              onChange={(event) => handleChange("cpanelUrl", event.target.value)}
              placeholder="https://"
            />
          </label>
        </div>

        {error && (
          <p className="border-l-4 border-error/70 bg-gradient-to-r from-error/10 via-base-100/70 to-base-100/55 px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}
        {status === "success" && !error && (
          <p className="border-l-4 border-success/70 bg-gradient-to-r from-success/10 via-base-100/70 to-base-100/55 px-4 py-3 text-sm text-success">
            Accesos actualizados correctamente.
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
