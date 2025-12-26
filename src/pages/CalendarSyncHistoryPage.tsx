import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { numberFormatter } from "@/lib/format";
import { TITLE_LG } from "@/lib/styles";

export default function CalendarSyncHistoryPage() {
  const {
    syncing,
    syncError,
    syncProgress,
    syncDurationMs,
    syncNow,
    hasRunningSyncFromOtherSource,
    lastSyncInfo,
    syncLogs: logs,
    refetchSyncLogs: refetchLogs,
    isLoadingSyncLogs,
  } = useCalendarEvents();
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const pageSize = 5;
  const loading = isLoadingSyncLogs;

  const hasRunningSyncInHistory = logs.some((log) => {
    if (log.status !== "RUNNING") return false; // Fixed: was using log.status which might be TS error if not typed implicitly? No, typed in hook.
    // Actually, hook types are imported.
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
                const hasDetails =
                  log.changeDetails &&
                  ((log.changeDetails.inserted?.length ?? 0) > 0 ||
                    (log.changeDetails.updated?.length ?? 0) > 0 ||
                    (log.changeDetails.excluded?.length ?? 0) > 0);
                const isExpanded = expandedId === log.id;
                return (
                  <>
                    <tr
                      key={log.id}
                      className={`border-base-300 bg-base-200 border-t ${hasDetails ? "hover:bg-base-300/50 cursor-pointer" : ""}`}
                      onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                    >
                      <td className="text-base-content px-4 py-3 font-medium">
                        {hasDetails && (
                          <span className="mr-1 inline-block w-4 text-center text-xs opacity-50">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        )}
                        {started}
                      </td>
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
                    {isExpanded && log.changeDetails && (
                      <tr key={`${log.id}-details`} className="bg-base-100">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="flex flex-wrap gap-4 text-xs">
                            {(log.changeDetails.inserted?.length ?? 0) > 0 && (
                              <div className="min-w-48 flex-1">
                                <p className="text-success mb-1 font-semibold">
                                  Insertadas ({log.changeDetails.inserted?.length})
                                </p>
                                <ul className="text-base-content/70 space-y-0.5">
                                  {log.changeDetails.inserted?.map((s, i) => (
                                    <li key={i}>• {s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(log.changeDetails.updated?.length ?? 0) > 0 && (
                              <div className="min-w-48 flex-1">
                                <p className="text-info mb-1 font-semibold">
                                  Actualizadas ({log.changeDetails.updated?.length})
                                </p>
                                <ul className="text-base-content/70 space-y-0.5">
                                  {log.changeDetails.updated?.map((s, i) => {
                                    if (typeof s === "string") return <li key={i}>• {s}</li>;
                                    return (
                                      <li key={i}>
                                        <span className="font-medium">• {s.summary}</span>
                                        <ul className="border-base-content/20 mt-0.5 ml-1 space-y-0.5 border-l-2 pl-3 text-xs opacity-80">
                                          {s.changes.map((c, j) => (
                                            <li key={j}>{c}</li>
                                          ))}
                                        </ul>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {(log.changeDetails.excluded?.length ?? 0) > 0 && (
                              <div className="min-w-48 flex-1">
                                <p className="text-warning mb-1 font-semibold">
                                  Filtradas ({log.changeDetails.excluded?.length})
                                </p>
                                <ul className="text-base-content/70 space-y-0.5">
                                  {log.changeDetails.excluded?.map((s, i) => (
                                    <li key={i}>• {s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
              {page > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setPage((prev) => Math.max(0, prev - 1))}>
                  Anterior
                </Button>
              )}
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
