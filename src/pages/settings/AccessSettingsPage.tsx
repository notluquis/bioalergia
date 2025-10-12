import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
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
      <section className="glass-card glass-underlay-gradient space-y-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Accesos rápidos</h2>
          <p className="text-sm text-slate-600/90">
            Lanza los paneles que usas con frecuencia y mantén visible la información clave de la base de datos.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => link.href && window.open(link.href, "_blank", "noopener,noreferrer")}
              disabled={!link.href}
              className="flex flex-col rounded-2xl border border-white/45 bg-white/70 px-4 py-3 text-left text-sm text-slate-600 transition hover:border-[var(--brand-primary)]/35 hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-semibold text-slate-700">{link.label}</span>
              <span className="text-xs text-slate-500">{link.description}</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="glass-card glass-underlay-gradient space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-secondary)] drop-shadow-sm">Detalle de conexiones</h2>
          <p className="text-sm text-slate-600/90">
            Documenta cómo acceder a los paneles y la base de datos para el equipo técnico.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servidor visible</span>
            <input
              type="text"
              value={form.dbDisplayHost}
              onChange={(event) => handleChange("dbDisplayHost", event.target.value)}
              className="glass-input"
              placeholder="Ej: db.bioalergia.cl"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre de la base</span>
            <input
              type="text"
              value={form.dbDisplayName}
              onChange={(event) => handleChange("dbDisplayName", event.target.value)}
              className="glass-input"
              placeholder="Ej: bio_finanzas"
            />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL consola DB (https)</span>
            <input
              type="url"
              value={form.dbConsoleUrl}
              onChange={(event) => handleChange("dbConsoleUrl", event.target.value)}
              className="glass-input"
              placeholder="https://"
            />
            <span className="text-xs text-slate-400">Se normaliza automáticamente para incluir https://</span>
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL cPanel (https)</span>
            <input
              type="url"
              value={form.cpanelUrl}
              onChange={(event) => handleChange("cpanelUrl", event.target.value)}
              className="glass-input"
              placeholder="https://"
            />
          </label>
        </div>

        {error && (
          <p className="glass-card border-l-4 border-rose-300/80 bg-gradient-to-r from-rose-50/65 via-white/70 to-white/55 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {status === "success" && !error && (
          <p className="glass-card border-l-4 border-emerald-300/80 bg-gradient-to-r from-emerald-50/70 via-white/70 to-white/55 px-4 py-3 text-sm text-emerald-700">
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
