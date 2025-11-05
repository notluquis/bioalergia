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
    <form onSubmit={handleSubmit} className="bg-base-100 space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Sincronización de Calendario</h2>
        <p className="text-sm text-base-content/70">
          Controla los parámetros que usamos para sincronizar eventos desde Google Calendar y la forma en que se
          muestran en el panel interno.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-base-content/70">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Zona horaria</span>
          <input
            type="text"
            value={form.calendarTimeZone}
            onChange={(event) => handleChange("calendarTimeZone", event.target.value)}
            className="input input-bordered"
            placeholder="America/Santiago"
          />
          <span className="text-xs text-base-content/50">Se utiliza para cron y conversión de fechas.</span>
        </label>

        <label className="flex flex-col gap-2 text-sm text-base-content/70">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Fecha inicial</span>
          <input
            type="date"
            value={form.calendarSyncStart}
            onChange={(event) => handleChange("calendarSyncStart", event.target.value)}
            className="input input-bordered"
          />
          <span className="text-xs text-base-content/50">Primer día que se sincroniza desde Google Calendar.</span>
        </label>

        <label className="flex flex-col gap-2 text-sm text-base-content/70">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Días hacia adelante
          </span>
          <input
            type="number"
            min={1}
            max={1095}
            value={form.calendarSyncLookaheadDays}
            onChange={(event) => handleChange("calendarSyncLookaheadDays", event.target.value)}
            className="input input-bordered"
          />
          <span className="text-xs text-base-content/50">Cuántos días futuros se sincronizan (máximo 1095).</span>
        </label>

        <label className="flex flex-col gap-2 text-sm text-base-content/70">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Días en vista diaria
          </span>
          <input
            type="number"
            min={1}
            max={120}
            value={form.calendarDailyMaxDays}
            onChange={(event) => handleChange("calendarDailyMaxDays", event.target.value)}
            className="input input-bordered"
          />
          <span className="text-xs text-base-content/50">
            Número máximo de días listados en la vista &quot;Detalle diario&quot;.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm text-base-content/70">
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Excluir eventos que contengan
        </span>
        <textarea
          rows={3}
          value={form.calendarExcludeSummaries}
          onChange={(event) => handleChange("calendarExcludeSummaries", event.target.value)}
          className="textarea textarea-bordered"
          placeholder={DEFAULT_EXCLUDE}
        />
        <span className="text-xs text-base-content/50">
          Patrones separados por coma (match insensible a mayúsculas). Por ejemplo:{" "}
          <em>&quot;No Disponible,Vacaciones&quot;</em>.
        </span>
      </label>

      {error && (
        <p className="border-l-4 border-error/70 bg-linear-to-r from-error/10 via-base-100/70 to-base-100/55 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}
      {status === "success" && !error && (
        <p className="border-l-4 border-success/70 bg-linear-to-r from-success/10 via-base-100/70 to-base-100/55 px-4 py-3 text-sm text-success">
          Configuración de calendario actualizada correctamente.
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs font-semibold text-secondary underline"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              calendarExcludeSummaries: DEFAULT_EXCLUDE,
            }))
          }
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
