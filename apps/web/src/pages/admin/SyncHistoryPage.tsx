import type { SyncLog } from "@finanzas/db";
import { useFindManySyncLog } from "@finanzas/db/hooks";
import dayjs from "dayjs";
import { CheckCircle, ChevronDown, ChevronRight, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ChangeDetail = {
  eventId?: string;
  summary?: string;
  action?: string;
  fields?: string[];
};

const ChangeDetailsViewer = ({ data }: { data: unknown }) => {
  if (!data) return null;

  const details = data as ChangeDetail[];
  if (!Array.isArray(details) || details.length === 0) {
    return <p className="text-base-content/50 text-sm italic">No hay cambios detallados.</p>;
  }

  // Group by action
  const grouped = details.reduce(
    (acc, item) => {
      const action = item.action || "unknown";
      if (!acc[action]) acc[action] = [];
      acc[action].push(item);
      return acc;
    },
    {} as Record<string, ChangeDetail[]>
  );

  const actionLabels: Record<string, { label: string; color: string }> = {
    created: { label: "Insertados", color: "text-success" },
    updated: { label: "Modificados", color: "text-info" },
    deleted: { label: "Eliminados", color: "text-error" },
    skipped: { label: "Omitidos", color: "text-warning" },
    unknown: { label: "Otros", color: "text-base-content/70" },
  };

  return (
    <details className="group bg-base-100/50 border-base-200 open:bg-base-100 overflow-hidden rounded-lg border">
      <summary className="hover:bg-base-200 flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium transition-colors select-none">
        <span>Ver Detalle de Cambios ({details.length})</span>
        <ChevronDown className="h-3 w-3 opacity-50 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-base-200 space-y-3 border-t p-3">
        {Object.entries(grouped).map(([action, items]) => {
          const lookup = actionLabels[action as keyof typeof actionLabels];
          const label = lookup?.label ?? "Otros";
          const color = lookup?.color ?? "text-base-content/70";
          return (
            <div key={action}>
              <h5 className={cn("mb-1.5 text-xs font-semibold tracking-wide uppercase", color)}>
                {label} ({items.length})
              </h5>
              <div className="bg-base-200/50 max-h-40 space-y-1 overflow-y-auto rounded-lg p-2">
                {items.slice(0, 50).map((item, idx) => (
                  <div key={idx} className="border-base-300 flex items-start gap-2 border-b pb-1 text-xs last:border-0">
                    <span className="text-base-content/70 flex-1 truncate" title={item.summary}>
                      {item.summary || item.eventId || "Sin título"}
                    </span>
                    {item.fields && item.fields.length > 0 && (
                      <span className="text-base-content/50 shrink-0 font-mono">[{item.fields.join(", ")}]</span>
                    )}
                  </div>
                ))}
                {items.length > 50 && (
                  <p className="text-base-content/50 pt-1 text-center text-xs">...y {items.length - 50} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
};

export default function SyncHistoryPage() {
  const [expandedId, setExpandedId] = useState<bigint | null>(null);

  const {
    data: syncLogs,
    isLoading,
    refetch,
  } = useFindManySyncLog({
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const toggleExpanded = (id: bigint) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
    <div className="bg-base-100 border-base-200 min-h-100 overflow-hidden rounded-xl border shadow-sm">
      {/* Card Header */}
      <div className="border-base-200 flex items-center justify-between border-b px-4 py-3">
        <span className="text-base-content/70 text-sm font-medium">{syncLogs?.length ?? 0} sincronizaciones</span>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Content */}
      {(() => {
        if (isLoading) {
          return (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          );
        }

        if (!syncLogs || syncLogs.length === 0) {
          return (
            <div className="text-base-content/50 flex h-64 items-center justify-center text-sm">
              No hay registros de sincronización de datos.
            </div>
          );
        }

        return (
          <div className="divide-base-200 divide-y">
            {syncLogs.map((log: SyncLog) => {
              const isExpanded = expandedId === log.id;
              const duration = log.finishedAt ? dayjs(log.finishedAt).diff(dayjs(log.startedAt), "s") : null;

              return (
                <div key={log.id.toString()} className="bg-base-100">
                  {/* Row Header */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(log.id)}
                    className="hover:bg-base-200/50 flex w-full items-center gap-4 px-4 py-3 text-left transition-colors"
                  >
                    {/* Expand Icon */}
                    <span className="text-base-content/40">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>

                    {/* Status */}
                    <StatusBadge status={log.status} />

                    {/* Date */}
                    <div className="min-w-24">
                      <div className="text-sm font-medium">{dayjs(log.startedAt).format("DD/MM/YYYY")}</div>
                      <div className="text-base-content/50 text-xs">{dayjs(log.startedAt).format("HH:mm:ss")}</div>
                    </div>

                    {/* Source */}
                    <div className="flex-1">
                      <span className="badge badge-ghost font-mono text-xs">{log.triggerSource}</span>
                      {log.triggerLabel && (
                        <span className="text-base-content/60 ml-2 text-xs" title={log.triggerLabel}>
                          {log.triggerLabel.slice(0, 30)}
                          {log.triggerLabel.length > 30 ? "..." : ""}
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
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

                    {/* Duration */}
                    <div className="text-base-content/70 min-w-12 text-right text-sm">
                      {duration === null ? "-" : `${duration}s`}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="bg-base-200/30 border-base-200 border-t px-6 py-4">
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Stats Summary */}
                        <div>
                          <h4 className="mb-3 text-sm font-semibold">Resumen de la Sincronización</h4>
                          <div className="bg-base-100 grid grid-cols-2 gap-3 rounded-lg p-3">
                            <div>
                              <span className="text-base-content/60 block text-xs">ID</span>
                              <span className="font-mono text-sm">{log.id.toString()}</span>
                            </div>
                            <div>
                              <span className="text-base-content/60 block text-xs">Duración</span>
                              <span className="text-sm">
                                {duration === null ? "En progreso..." : `${duration} segundos`}
                              </span>
                            </div>
                            <div>
                              <span className="text-base-content/60 block text-xs">Insertados</span>
                              <span className="text-success text-lg font-bold">{log.inserted || 0}</span>
                            </div>
                            <div>
                              <span className="text-base-content/60 block text-xs">Actualizados</span>
                              <span className="text-info text-lg font-bold">{log.updated || 0}</span>
                            </div>
                            <div>
                              <span className="text-base-content/60 block text-xs">Omitidos</span>
                              <span className="text-warning text-lg font-bold">{log.skipped || 0}</span>
                            </div>
                            <div>
                              <span className="text-base-content/60 block text-xs">Excluidos</span>
                              <span className="text-base-content/70 text-lg font-bold">{log.excluded || 0}</span>
                            </div>
                          </div>

                          {/* Error Message */}
                          {log.errorMessage && (
                            <div className="mt-4">
                              <span className="text-error mb-1 block text-xs font-bold">Mensaje de Error</span>
                              <div className="bg-error/10 text-error max-h-32 overflow-auto rounded-lg p-2 font-mono text-xs">
                                {log.errorMessage}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Change Details */}
                        <div>
                          <h4 className="mb-3 text-sm font-semibold">Detalle de Cambios</h4>
                          <ChangeDetailsViewer data={log.changeDetails} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
