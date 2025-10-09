import React, { useEffect, useState } from "react";
import { useSettings, type AppSettings } from "../context/SettingsContext";
import Button from "./Button";

const fields: Array<{ key: keyof AppSettings; label: string; type?: string; helper?: string }> = [
  { key: "orgName", label: "Nombre de la organización" },
  { key: "tagline", label: "Eslogan", helper: "Texto corto que se muestra en el panel" },
  { key: "primaryColor", label: "Color primario", type: "color" },
  { key: "secondaryColor", label: "Color secundario", type: "color" },
  { key: "logoUrl", label: "URL del logo" },
  { key: "supportEmail", label: "Correo de soporte" },
  { key: "orgPhone", label: "Teléfono de contacto" },
  { key: "orgAddress", label: "Dirección" },
  { key: "primaryCurrency", label: "Moneda principal", helper: "Ejemplo: CLP, USD" },
];

export default function SettingsForm() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<AppSettings>(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = (key: keyof AppSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await updateSettings(form);
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
