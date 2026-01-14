import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Info } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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
  const [selectedLog, setSelectedLog] = useState<CalendarSyncLog | null>(null);
  const loading = isLoadingSyncLogs;

  const hasRunningSyncInHistory = logs.some((log) => {
    if (log.status !== "RUNNING") return false;
    const started = dayjs(log.startedAt);
    // Match backend stale timeout: 5 minutes
    return started.isValid() && Date.now() - started.valueOf() < 5 * 60 * 1000;
  });
  const isSyncing = syncing || hasRunningSyncFromOtherSource || hasRunningSyncInHistory;

  const handleRefresh = () => {
    refetchLogs().catch(() => {
      /* handled */
    });
  };

  const columns: ColumnDef<CalendarSyncLog>[] = [
    {
      accessorKey: "startedAt",
      header: "Inicio",
      cell: ({ row }) => (
        <span className="text-base-content font-medium">
          {dayjs(row.original.startedAt).format("DD MMM YYYY HH:mm")}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => {
        const log = row.original;
        const statusColors = {
          SUCCESS: "text-success",
          RUNNING: "text-warning",
          ERROR: "text-error",
        };
        const statusClass = statusColors[log.status as keyof typeof statusColors] || "text-error";
        const statusText = (() => {
          if (log.status === "SUCCESS") return "Éxito";
          if (log.status === "RUNNING") return "En curso...";
          return "Error";
        })();
        return <span className={cn("font-semibold", statusClass)}>{statusText}</span>;
      },
    },
    {
      accessorKey: "inserted",
      header: "Insertadas",
      cell: ({ row }) => numberFormatter.format(row.original.inserted),
    },
    {
      accessorKey: "updated",
      header: "Actualizadas",
      cell: ({ row }) => numberFormatter.format(row.original.updated),
    },
    {
      id: "source",
      header: "Origen",
      cell: ({ row }) => row.original.triggerLabel ?? row.original.triggerSource,
    },
    {
      id: "duration",
      header: "Duración",
      cell: ({ row }) => {
        const log = row.original;
        const finished = log.finishedAt ? dayjs(log.finishedAt) : null;
        if (finished?.isValid()) return `${finished.diff(dayjs(log.startedAt), "second")}s`;
        if (log.status === "RUNNING") return "En curso...";
        return "-";
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row.original);
          }}
          className="text-primary hover:text-primary/80"
          aria-label="Ver detalle"
        >
          <Info size={16} />
        </Button>
      ),
    },
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
          <DataTable
            columns={columns}
            data={logs}
            isLoading={loading}
            noDataMessage="No hay ejecuciones registradas."
          />
        </CardContent>
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
