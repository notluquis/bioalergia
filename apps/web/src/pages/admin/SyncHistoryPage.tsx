import type { SyncLog } from "@finanzas/db";
import { useFindManySyncLog } from "@finanzas/db/hooks";
import dayjs from "dayjs";
import { CheckCircle, FileText, History, Info, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { cn } from "@/lib/utils";

export default function SyncHistoryPage() {
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  // Data Sync Query
  const {
    data: syncLogs,
    isLoading,
    refetch,
  } = useFindManySyncLog({
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const s = status.toUpperCase();
    if (s === "SUCCESS") {
      return (
        <span className="badge badge-success gap-1 text-xs font-semibold">
          <CheckCircle className="h-3 w-3" /> Exitoso
        </span>
      );
    }
    if (s === "ERROR" || s === "FAILED") {
      return (
        <span className="badge badge-error gap-1 text-xs font-semibold">
          <XCircle className="h-3 w-3" /> Error
        </span>
      );
    }
    return (
      <span className="badge badge-warning gap-1 text-xs font-semibold">
        <Loader2 className="h-3 w-3 animate-spin" /> {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <History className="text-primary h-6 w-6" />
            Historial de Sincronización
          </h1>
          <p className="text-base-content/60 text-sm">
            Monitorea los procesos de importación de datos y cargas masivas (CSV, Bancos).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-base-100 border-base-200 min-h-100 overflow-hidden rounded-xl border shadow-sm">
        <Table
          columns={[
            { key: "status", label: "Estado" },
            { key: "date", label: "Fecha" },
            { key: "source", label: "Origen" },
            { key: "counts", label: "Métricas" },
            { key: "duration", label: "Duración" },
            { key: "actions", label: "" },
          ]}
        >
          <Table.Body loading={isLoading} columnsCount={6} emptyMessage="No hay registros de sincronización de datos.">
            {syncLogs?.map((log) => {
              const duration = log.finishedAt ? dayjs(log.finishedAt).diff(dayjs(log.startedAt), "s") : null;

              return (
                <tr key={log.id.toString()} className="hover:bg-base-200/50">
                  <td>
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="font-medium">{dayjs(log.startedAt).format("DD/MM/YYYY")}</div>
                    <div className="text-base-content/50 text-xs">{dayjs(log.startedAt).format("HH:mm:ss")}</div>
                  </td>
                  <td>
                    <div className="badge badge-ghost font-mono text-xs">{log.triggerSource}</div>
                    {log.triggerLabel && (
                      <div className="text-base-content/60 mt-1 max-w-50 truncate text-xs" title={log.triggerLabel}>
                        {log.triggerLabel}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2 text-xs">
                      <span className="bg-success/10 text-success rounded px-1.5 py-0.5" title="Insertados">
                        +{log.inserted || 0}
                      </span>
                      <span className="bg-info/10 text-info rounded px-1.5 py-0.5" title="Actualizados">
                        ~{log.updated || 0}
                      </span>
                      <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5" title="Omitidos">
                        -{log.skipped || 0}
                      </span>
                    </div>
                  </td>
                  <td className="text-base-content/70 text-sm">{duration !== null ? `${duration}s` : "-"}</td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn-square"
                      onClick={() => setSelectedLog(log)}
                      title="Ver detalles"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table.Body>
        </Table>
      </div>

      {/* Details Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Detalle de Sincronización">
        <div className="space-y-4">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" />
              Estado General
            </h4>
            <div className="bg-base-200 mt-2 grid grid-cols-2 gap-4 rounded-lg p-3 text-sm">
              <div>
                <span className="text-base-content/60 block text-xs">ID</span>
                <span className="font-mono">{selectedLog?.id.toString()}</span>
              </div>
              <div>
                <span className="text-base-content/60 block text-xs">Status</span>
                <span
                  className={cn(
                    "font-semibold",
                    selectedLog?.status === "SUCCESS" && "text-success",
                    selectedLog?.status === "ERROR" && "text-error"
                  )}
                >
                  {selectedLog?.status}
                </span>
              </div>
              {selectedLog?.errorMessage && (
                <div className="col-span-2">
                  <span className="text-error block text-xs font-bold">Error Message</span>
                  <div className="bg-error/10 text-error mt-1 rounded p-2 font-mono text-xs">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Detalles de Cambios</h4>
            {selectedLog?.changeDetails ? (
              <div className="bg-base-300/50 mt-2 max-h-75 overflow-auto rounded-lg p-3">
                <pre className="font-mono text-xs leading-tight">
                  {JSON.stringify(selectedLog.changeDetails, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-base-content/50 mt-2 text-center text-sm italic">No hay detalles adicionales.</div>
            )}
          </div>
        </div>
        <div className="modal-action">
          <Button onClick={() => setSelectedLog(null)}>Cerrar</Button>
        </div>
      </Modal>
    </div>
  );
}
