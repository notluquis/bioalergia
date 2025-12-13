import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { fetchCalendarSyncLogs } from "@/features/calendar/api";
import { CALENDAR_SYNC_LOGS_QUERY_KEY, useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarSyncLog } from "@/features/calendar/types";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { numberFormatter } from "@/lib/format";
import { TITLE_LG } from "@/lib/styles";

export default function CalendarSyncHistoryPage() {
  const { syncing, syncError, syncProgress, syncDurationMs, syncNow, hasRunningSyncFromOtherSource, lastSyncInfo } =
    useCalendarEvents();
  const [page, setPage] = useState(0);
  const pageSize = 5;

  // Use React Query for auto-refresh only when RUNNING
  const {
    data: logs = [],
    isLoading: loading,
    refetch: refetchLogs,
  } = useQuery<CalendarSyncLog[], Error>({
    queryKey: CALENDAR_SYNC_LOGS_QUERY_KEY,
    queryFn: () => fetchCalendarSyncLogs(50),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.length) return false;
      const running = data.find((log) => log.status === "RUNNING");
      if (!running) return false;
      const started = dayjs(running.startedAt);
      return started.isValid() && Date.now() - started.valueOf() < 15 * 60 * 1000 ? 5000 : false;
    },
    placeholderData: [],
  });

  const hasRunningSyncInHistory = logs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    return started.isValid() && Date.now() - started.valueOf() < 15 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));

  useEffect(() => {
    // Clamp page when log size changes
    if (page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  const visibleLogs = useMemo(() => logs.slice(page * pageSize, page * pageSize + pageSize), [logs, page, pageSize]);

  const handleRefresh = () => {
    refetchLogs().catch(() => {
      /* handled */
    });
    setPage(0);
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
          <Button variant="secondary" onClick={handleRefresh} disabled={loading || isSyncing}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button onClick={syncNow} disabled={isSyncing || loading}>
            {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Button>
        </div>
      </header>

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
              visibleLogs.map((log) => {
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
        {logs.length > 0 && (
          <div className="border-base-200 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs">
            <span className="text-base-content/60">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
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

      <SyncProgressPanel
        syncing={syncing}
        syncError={syncError}
        syncProgress={syncProgress}
        syncDurationMs={syncDurationMs}
        lastSyncInfo={lastSyncInfo ?? undefined}
        showLastSyncInfo
      />
    </section>
  );
}
