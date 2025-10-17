import { useEffect, useState } from "react";
import Button from "../../components/Button";
import { useSettings, type AppSettings } from "../../context/settings-context";

type CalendarForm = Pick<
  AppSettings,
  | "calendarTimeZone"
  | "calendarSyncStart"
  | "calendarSyncLookaheadDays"
  | "calendarExcludeSummaries"
  | "calendarDailyMaxDays"
>;

const DEFAULT_EXCLUDE = "No Disponible";

export default function CalendarSettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<CalendarForm>(() => ({
    calendarTimeZone: settings.calendarTimeZone,
    calendarSyncStart: settings.calendarSyncStart,
    calendarSyncLookaheadDays: settings.calendarSyncLookaheadDays,
    calendarExcludeSummaries: settings.calendarExcludeSummaries,
    calendarDailyMaxDays: settings.calendarDailyMaxDays,
  }));
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      calendarTimeZone: settings.calendarTimeZone,
      calendarSyncStart: settings.calendarSyncStart,
      calendarSyncLookaheadDays: settings.calendarSyncLookaheadDays,
      calendarExcludeSummaries: settings.calendarExcludeSummaries,
      calendarDailyMaxDays: settings.calendarDailyMaxDays,
    });
  }, [settings]);

  const handleChange = (key: keyof CalendarForm, value: string) => {
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
      });
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la configuración";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card glass-underlay-gradient space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Sincronización de Calendario</h2>
        <p className="text-sm text-slate-600/90">
          Controla los parámetros que usamos para sincronizar eventos desde Google Calendar y la forma en que se muestran
          en el panel interno.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zona horaria</span>
          <input
            type="text"
            value={form.calendarTimeZone}
            onChange={(event) => handleChange("calendarTimeZone", event.target.value)}
            className="glass-input"
            placeholder="America/Santiago"
          />
          <span className="text-[11px] text-slate-400">Se utiliza para cron y conversión de fechas.</span>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha inicial</span>
          <input
            type="date"
            value={form.calendarSyncStart}
            onChange={(event) => handleChange("calendarSyncStart", event.target.value)}
            className="glass-input"
          />
          <span className="text-[11px] text-slate-400">Primer día que se sincroniza desde Google Calendar.</span>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días hacia adelante</span>
          <input
            type="number"
            min={1}
            max={1095}
            value={form.calendarSyncLookaheadDays}
            onChange={(event) => handleChange("calendarSyncLookaheadDays", event.target.value)}
            className="glass-input"
          />
          <span className="text-[11px] text-slate-400">Cuántos días futuros se sincronizan (máximo 1095).</span>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días en vista diaria</span>
          <input
            type="number"
            min={1}
            max={120}
            value={form.calendarDailyMaxDays}
            onChange={(event) => handleChange("calendarDailyMaxDays", event.target.value)}
            className="glass-input"
          />
          <span className="text-[11px] text-slate-400">Número máximo de días listados en la vista “Detalle diario”.</span>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm text-slate-600">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Excluir eventos que contengan</span>
        <textarea
          rows={3}
          value={form.calendarExcludeSummaries}
          onChange={(event) => handleChange("calendarExcludeSummaries", event.target.value)}
          className="glass-input"
          placeholder={DEFAULT_EXCLUDE}
        />
        <span className="text-[11px] text-slate-400">
          Patrones separados por coma (match insensible a mayúsculas). Por ejemplo: <em>No Disponible,Vacaciones</em>.
        </span>
      </label>

      {error && (
        <p className="glass-card border-l-4 border-rose-300/80 bg-gradient-to-r from-rose-50/65 via-white/70 to-white/55 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {status === "success" && !error && (
        <p className="glass-card border-l-4 border-emerald-300/80 bg-gradient-to-r from-emerald-50/70 via-white/70 to-white/55 px-4 py-3 text-sm text-emerald-700">
          Configuración de calendario actualizada correctamente.
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs font-semibold text-[var(--brand-secondary)] underline"
          onClick={() => setForm((prev) => ({
            ...prev,
            calendarExcludeSummaries: DEFAULT_EXCLUDE,
          }))}
        >
          Restaurar patrones por defecto
        </button>
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
