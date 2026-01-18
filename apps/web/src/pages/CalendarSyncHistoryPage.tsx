import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Info } from "lucide-react";
import { useState } from "react";

import type { CalendarSyncLog } from "@/features/calendar/types";

import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SyncDetailModal } from "@/features/calendar/components/SyncDetailModal";
import { SyncProgressPanel } from "@/features/calendar/components/SyncProgressPanel";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar-events";
import { numberFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CalendarSyncHistoryPage() {
  const {
    hasRunningSyncFromOtherSource,
    isLoadingSyncLogs,
    lastSyncInfo,
    refetchSyncLogs: refetchLogs,
    syncDurationMs,
    syncError,
    syncing,
    syncLogs: logs,
    syncNow,
    syncProgress,
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
      cell: ({ row }) => (
        <span className="text-base-content font-medium">
          {dayjs(row.original.startedAt).format("DD MMM YYYY HH:mm")}
        </span>
      ),
      header: "Inicio",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => {
        const log = row.original;
        const statusColors = {
          ERROR: "text-error",
          RUNNING: "text-warning",
          SUCCESS: "text-success",
        };
        const statusClass = statusColors[log.status] || "text-error";
        const statusText = (() => {
          if (log.status === "SUCCESS") return "Éxito";
          if (log.status === "RUNNING") return "En curso...";
          return "Error";
        })();
        return <span className={cn("font-semibold", statusClass)}>{statusText}</span>;
      },
      header: "Estado",
    },
    {
      accessorKey: "inserted",
      cell: ({ row }) => numberFormatter.format(row.original.inserted),
      header: "Insertadas",
    },
    {
      accessorKey: "updated",
      cell: ({ row }) => numberFormatter.format(row.original.updated),
      header: "Actualizadas",
    },
    {
      cell: ({ row }) => row.original.triggerLabel ?? row.original.triggerSource,
      header: "Origen",
      id: "source",
    },
    {
      cell: ({ row }) => {
        const log = row.original;
        const finished = log.finishedAt ? dayjs(log.finishedAt) : null;
        if (finished?.isValid()) return `${finished.diff(dayjs(log.startedAt), "second")}s`;
        if (log.status === "RUNNING") return "En curso...";
        return "-";
      },
      header: "Duración",
      id: "duration",
    },
    {
      cell: ({ row }) => (
        <Button
          aria-label="Ver detalle"
          className="text-primary hover:text-primary/80"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row.original);
          }}
          size="sm"
          variant="ghost"
        >
          <Info size={16} />
        </Button>
      ),
      header: "",
      id: "actions",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button disabled={loading || isSyncing} onClick={handleRefresh} size="sm" variant="ghost">
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
        <Button disabled={isSyncing || loading} onClick={syncNow} size="sm">
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
                  <li className="text-error flex gap-2" key={`err-${log.id}`}>
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
        lastSyncInfo={lastSyncInfo ?? undefined}
        showLastSyncInfo
        syncDurationMs={syncDurationMs}
        syncError={syncError}
        syncing={syncing}
        syncProgress={syncProgress}
      />

      <SyncDetailModal
        isOpen={selectedLog !== null}
        log={selectedLog}
        onClose={() => {
          setSelectedLog(null);
        }}
      />
    </section>
  );
}
