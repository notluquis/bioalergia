import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { numberFormatter } from "@/lib/format";
import { TITLE_LG } from "@/lib/styles";
import { cn } from "@/lib/utils";

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
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    return started.isValid() && Date.now() - started.valueOf() < 15 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));

  useEffect(() => {
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

  const tableColumns = [
    { key: "started", label: "Inicio" },
    { key: "status", label: "Estado" },
    { key: "inserted", label: "Insertadas" },
    { key: "updated", label: "Actualizadas" },
    { key: "skipped", label: "Omitidas" },
    { key: "excluded", label: "Filtradas" },
    { key: "source", label: "Origen" },
    { key: "duration", label: "Duración" },
  ];

  return (
    <section className="space-y-6">
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

      <Card>
        <CardContent className="p-0">
          <Table columns={tableColumns} variant="minimal" className="border-0 shadow-none">
            <Table.Body loading={loading} columnsCount={8}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-base-content/50 px-4 py-12 text-center">
                    No hay ejecuciones registradas.
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log) => {
                  const started = dayjs(log.startedAt).format("DD MMM YYYY HH:mm");
                  const finished = log.finishedAt ? dayjs(log.finishedAt) : null;
                  const duration = finished ? `${finished.diff(dayjs(log.startedAt), "second")}s` : "-";
                  const sourceLabel = log.triggerLabel ?? log.triggerSource;

                  const statusColors = {
                    SUCCESS: "text-success",
                    RUNNING: "text-warning",
                    ERROR: "text-error",
                  };
                  const statusClass = statusColors[log.status as keyof typeof statusColors] || "text-error";

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
                        className={cn(
                          "group transition-colors",
                          hasDetails && "hover:bg-base-200/50 cursor-pointer",
                          isExpanded && "bg-base-200/50"
                        )}
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="text-base-content font-medium">
                          <div className="flex items-center gap-2">
                            {hasDetails && (
                              <div className="text-base-content/40 hover:text-primary transition-colors">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            )}
                            <span className={cn(!hasDetails && "ml-5")}>{started}</span>
                          </div>
                        </td>
                        <td className={cn("font-semibold", statusClass)}>
                          {log.status === "SUCCESS" ? "Éxito" : log.status === "RUNNING" ? "En curso..." : "Error"}
                        </td>
                        <td>{numberFormatter.format(log.inserted)}</td>
                        <td>{numberFormatter.format(log.updated)}</td>
                        <td>{numberFormatter.format(log.skipped)}</td>
                        <td>{numberFormatter.format(log.excluded)}</td>
                        <td>{sourceLabel}</td>
                        <td>{duration}</td>
                      </tr>
                      {isExpanded && log.changeDetails && (
                        <tr key={`${log.id}-details`} className="bg-base-200/30">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid gap-6 text-xs md:grid-cols-3">
                              {(log.changeDetails.inserted?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                  <p className="text-success flex items-center gap-1 font-semibold">
                                    <span className="bg-success h-1.5 w-1.5 rounded-full"></span>
                                    Insertadas ({log.changeDetails.inserted?.length})
                                  </p>
                                  <ul className="text-base-content/70 border-success/20 space-y-1 border-l pl-2.5">
                                    {log.changeDetails.inserted?.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(log.changeDetails.updated?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                  <p className="text-info flex items-center gap-1 font-semibold">
                                    <span className="bg-info h-1.5 w-1.5 rounded-full"></span>
                                    Actualizadas ({log.changeDetails.updated?.length})
                                  </p>
                                  <ul className="text-base-content/70 border-info/20 space-y-1 border-l pl-2.5">
                                    {log.changeDetails.updated?.map((s, i) => {
                                      if (typeof s === "string") return <li key={i}>{s}</li>;
                                      return (
                                        <li key={i} className="space-y-1">
                                          <span className="block font-medium">{s.summary}</span>
                                          <ul className="bg-base-100/50 space-y-0.5 rounded p-1.5 opacity-80">
                                            {s.changes.map((c, j) => (
                                              <li key={j}>• {c}</li>
                                            ))}
                                          </ul>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                              {(log.changeDetails.excluded?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                  <p className="text-warning flex items-center gap-1 font-semibold">
                                    <span className="bg-warning h-1.5 w-1.5 rounded-full"></span>
                                    Filtradas ({log.changeDetails.excluded?.length})
                                  </p>
                                  <ul className="text-base-content/70 border-warning/20 space-y-1 border-l pl-2.5">
                                    {log.changeDetails.excluded?.map((s, i) => (
                                      <li key={i}>{s}</li>
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
            </Table.Body>
          </Table>
        </CardContent>
        {logs.length > 0 && (
          <CardFooter className="border-base-200 bg-base-50/50 flex items-center justify-between border-t px-6 py-3">
            <span className="text-base-content/60 text-xs">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              >
                Siguiente
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {logs.some((log) => log.errorMessage) && (
        <Card className="border-error/20 bg-error/5">
          <CardHeader>
            <CardTitle className="text-error flex items-center gap-2 text-base">
              <AlertTriangle size={18} />
              Errores recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {logs
                .filter((log) => log.errorMessage)
                .slice(0, 5)
                .map((log) => (
                  <li key={`err-${log.id}`} className="text-error flex gap-2">
                    <span className="font-mono whitespace-nowrap opacity-70">
                      {dayjs(log.startedAt).format("DD/MM HH:mm")}
                    </span>
                    <span>{log.errorMessage}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
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
