import { useEffect, useState } from "react";
import dayjs from "dayjs";

import Button from "../components/Button";
import Alert from "../components/Alert";
import { fetchCalendarSyncLogs } from "../features/calendar/api";
import type { CalendarSyncLog } from "../features/calendar/types";

const numberFormatter = new Intl.NumberFormat("es-CL");

export default function CalendarSyncHistoryPage() {
  const [logs, setLogs] = useState<CalendarSyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCalendarSyncLogs(50);
      setLogs(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el historial";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs().catch(() => {
      /* handled */
    });
  }, []);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Historial de sincronizaciones</h1>
          <p className="text-sm text-slate-600">
            Consulta las sincronizaciones ejecutadas (manuales y programadas) y sus resultados.
          </p>
        </div>
        <Button onClick={loadLogs} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="glass-card glass-underlay-gradient overflow-hidden rounded-3xl border border-white/60">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-white/70 uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Insertadas</th>
              <th className="px-4 py-3">Actualizadas</th>
              <th className="px-4 py-3">Omitidas</th>
              <th className="px-4 py-3">Filtradas</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Duración</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-slate-400">
                  {loading ? "Cargando..." : "No hay ejecuciones registradas."}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const started = dayjs(log.startedAt).format("DD MMM YYYY HH:mm");
                const finished = log.finishedAt ? dayjs(log.finishedAt) : null;
                const duration = finished ? `${finished.diff(dayjs(log.startedAt), "second")}s` : "-";
                const sourceLabel = log.triggerLabel ?? log.triggerSource;
                const statusClass =
                  log.status === "SUCCESS"
                    ? "text-emerald-600"
                    : "text-rose-600";
                return (
                  <tr key={log.id} className="border-t border-white/40 bg-white/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{started}</td>
                    <td className={`px-4 py-3 font-semibold ${statusClass}`}>{log.status === "SUCCESS" ? "Éxito" : "Error"}</td>
                    <td className="px-4 py-3">{numberFormatter.format(log.inserted)}</td>
                    <td className="px-4 py-3">{numberFormatter.format(log.updated)}</td>
                    <td className="px-4 py-3">{numberFormatter.format(log.skipped)}</td>
                    <td className="px-4 py-3">{numberFormatter.format(log.excluded)}</td>
                    <td className="px-4 py-3">{sourceLabel}</td>
                    <td className="px-4 py-3">{duration}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {logs.some((log) => log.errorMessage) && (
        <div className="glass-card glass-underlay-gradient space-y-2 rounded-3xl border border-rose-200/70 p-4 text-xs text-rose-700">
          <p className="font-semibold uppercase tracking-wide">Errores recientes</p>
          <ul className="space-y-1">
            {logs
              .filter((log) => log.errorMessage)
              .slice(0, 5)
              .map((log) => (
                <li key={`err-${log.id}`}>
                  {dayjs(log.startedAt).format("DD MMM YYYY HH:mm")}: {log.errorMessage}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
