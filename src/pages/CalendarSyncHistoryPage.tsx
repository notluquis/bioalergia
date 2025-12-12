import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { fetchCalendarSyncLogs, syncCalendarEvents } from "@/features/calendar/api";
import { numberFormatter } from "@/lib/format";
import { TITLE_LG } from "@/lib/styles";

export default function CalendarSyncHistoryPage() {
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Use React Query for auto-refresh only when RUNNING
  const {
    data: logs = [],
    isLoading: loading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["calendar", "sync-logs-history"],
    queryFn: () => fetchCalendarSyncLogs(50),
  });

  const syncing = logs.some((log) => log.status === "RUNNING");

  // Auto-refresh every 5s when there's a RUNNING sync
  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(() => {
      refetchLogs().catch(() => {
        /* handled */
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [syncing, refetchLogs]);

  const handleRefresh = () => {
    refetchLogs().catch(() => {
      /* handled */
    });
  };

  const handleSync = async () => {
    setSyncMessage(null);
    setError(null);
    try {
      const result = await syncCalendarEvents();
      setSyncMessage(
        `Sincronización completada. Nuevos: ${numberFormatter.format(result.inserted)}, actualizados: ${numberFormatter.format(result.updated)}, omitidos: ${numberFormatter.format(result.skipped)}.`
      );
      await refetchLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo ejecutar la sincronización";
      setError(message);
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className={TITLE_LG}>Historial de sincronización</h1>
          <p className="text-base-content/70 text-sm">
            Consulta las sincronizaciones ejecutadas (manuales y programadas) y sus resultados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleRefresh} disabled={loading || syncing}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button onClick={handleSync} disabled={syncing || loading}>
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </div>
      </header>

      {error && <Alert variant="error">{error}</Alert>}
      {syncMessage && <Alert variant="success">{syncMessage}</Alert>}

      <div className="bg-base-100 border-base-300 overflow-hidden rounded-3xl border">
        <table className="text-base-content w-full text-left text-xs">
          <thead className="bg-base-200 text-base-content/80 tracking-wide uppercase">
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
                <td colSpan={8} className="text-base-content/50 px-4 py-4 text-center">
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
                  log.status === "SUCCESS" ? "text-success" : log.status === "RUNNING" ? "text-warning" : "text-error";
                return (
                  <tr key={log.id} className="border-base-300 bg-base-200 border-t">
                    <td className="text-base-content px-4 py-3 font-medium">{started}</td>
                    <td className={`px-4 py-3 font-semibold ${statusClass}`}>
                      {log.status === "SUCCESS" ? "Éxito" : log.status === "RUNNING" ? "En curso..." : "Error"}
                    </td>
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
        <div className="bg-base-100 border-error/20 text-error space-y-2 rounded-3xl border p-4 text-xs">
          <p className="font-semibold tracking-wide uppercase">Errores recientes</p>
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
