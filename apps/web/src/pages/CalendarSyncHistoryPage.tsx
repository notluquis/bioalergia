import dayjs from "dayjs";
import { AlertTriangle, Info } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { SyncDetailModal } from "@/features/calendar/components/SyncDetailModal";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarSyncLog } from "@/features/calendar/types";
import { numberFormatter } from "@/lib/format";
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
  const [selectedLog, setSelectedLog] = useState<CalendarSyncLog | null>(null);
  const pageSize = 5;
  const loading = isLoadingSyncLogs;

  const hasRunningSyncInHistory = logs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    // Match backend stale timeout: 5 minutes
    return started.isValid() && Date.now() - started.valueOf() < 5 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));

  useEffect(() => {
    if (page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  // React Compiler auto-memoizes array slicing
  const visibleLogs = logs.slice(page * pageSize, page * pageSize + pageSize);

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
    { key: "source", label: "Origen" },
    { key: "duration", label: "Duración" },
    { key: "actions", label: "" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading || isSyncing}>
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
        <Button size="sm" onClick={syncNow} disabled={isSyncing || loading}>
          {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table columns={tableColumns} variant="minimal" className="border-0 shadow-none">
            <Table.Body loading={loading} columnsCount={7}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-base-content/50 px-4 py-12 text-center">
                    No hay ejecuciones registradas.
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log) => {
                  const started = dayjs(log.startedAt).format("DD MMM YYYY HH:mm");
                  const finished = log.finishedAt ? dayjs(log.finishedAt) : null;
                  const duration =
                    finished && finished.isValid()
                      ? `${finished.diff(dayjs(log.startedAt), "second")}s`
                      : log.status === "RUNNING"
                        ? "En curso..."
                        : "-";
                  const sourceLabel = log.triggerLabel ?? log.triggerSource;

                  const statusColors = {
                    SUCCESS: "text-success",
                    RUNNING: "text-warning",
                    ERROR: "text-error",
                  };
                  const statusClass = statusColors[log.status as keyof typeof statusColors] || "text-error";

                  return (
                    <tr key={log.id} className="group hover:bg-base-200/50 transition-colors">
                      <td className="text-base-content font-medium">{started}</td>
                      <td className={cn("font-semibold", statusClass)}>
                        {log.status === "SUCCESS" ? "Éxito" : log.status === "RUNNING" ? "En curso..." : "Error"}
                      </td>
                      <td>{numberFormatter.format(log.inserted)}</td>
                      <td>{numberFormatter.format(log.updated)}</td>
                      <td>{sourceLabel}</td>
                      <td>{duration}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="text-primary hover:text-primary/80"
                          aria-label="Ver detalle"
                        >
                          <Info size={16} />
                        </Button>
                      </td>
                    </tr>
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

      <SyncDetailModal isOpen={selectedLog !== null} onClose={() => setSelectedLog(null)} log={selectedLog} />
    </section>
  );
}
