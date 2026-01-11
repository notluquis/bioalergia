/**
 * Audit Changes Panel Component
 *
 * Shows recent database changes with diffs and revert functionality.
 */

// ==================== IMPORTS ====================

import { useFindManyAuditLog } from "@finanzas/db/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  ChevronDown,
  ChevronRight,
  Database,
  History,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

// ==================== TYPES ====================

interface AuditStats {
  totalChanges: number;
  pendingExport: number;
  byTable: { table_name: string; count: number }[];
  byOperation: { operation: string; count: number }[];
}

// ==================== HELPERS ====================

function getOperationIcon(op: string) {
  switch (op) {
    case "INSERT": {
      return <Plus className="text-success size-4" />;
    }
    case "UPDATE": {
      return <Pencil className="text-warning size-4" />;
    }
    case "DELETE": {
      return <Trash2 className="text-error size-4" />;
    }
    default: {
      return <Database className="size-4" />;
    }
  }
}

function getOperationLabel(op: string) {
  switch (op) {
    case "INSERT":
    case "CREATE": {
      return "Creado";
    }
    case "UPDATE": {
      return "Modificado";
    }
    case "DELETE": {
      return "Eliminado";
    }
    default: {
      return op;
    }
  }
}

// ==================== COMPONENT ====================

export default function AuditChangesPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Queries using ZenStack Hooks - include user relation
  const {
    data: auditLogs,
    refetch,
    isFetching,
  } = useFindManyAuditLog({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          // name is not on User, it's on Person relation
        },
      },
    },
  });

  // Calculate stats client-side since we're fetching the latest 50 anyway
  const total = auditLogs?.length || 0;

  const byOperationCount: Record<string, number> = {
    CREATE: 0,
    UPDATE: 0,
    DELETE: 0,
  };

  const byEntityCount: Record<string, number> = {};

  auditLogs?.forEach((log: any) => {
    // Count operations
    const action = log.action as string;
    if (typeof byOperationCount[action] === "number") {
      byOperationCount[action] = (byOperationCount[action] ?? 0) + 1;
    }
    // Count entities
    const entity = log.entity;
    byEntityCount[entity] = (byEntityCount[entity] || 0) + 1;
  });

  const stats: AuditStats = {
    totalChanges: total,
    pendingExport: 0, // Not available in basic log
    byOperation: Object.entries(byOperationCount)
      .filter(([, count]) => count > 0)
      .map(([operation, count]) => ({ operation, count })),
    byTable: Object.entries(byEntityCount)
      .toSorted((a, b) => b[1] - a[1])
      .map(([table_name, count]) => ({ table_name, count })),
  };

  // Adapter to match the UI's expected format

  const changes = (auditLogs || []).map((log: any) => {
    const details = (log.details as any) || {};
    return {
      id: String(log.id),
      table_name: log.entity,
      row_id: log.entityId || "N/A",
      operation: log.action as "INSERT" | "UPDATE" | "DELETE",
      // Flatten usage for existing UI
      old_data: details.old_data || null,
      new_data: details.new_data || null,
      diff: details.diff || null,
      transaction_id: "N/A", // Not present in new schema
      created_at: log.createdAt as unknown as string, // Date object/string handling
      exported_at: null, // Not present in basic log
      user: log.user || null, // Include user info
    };
  });

  const revertMutation = useMutation({
    mutationFn: async (changeId: string) => {
      return await apiClient.post<{ success: boolean; message: string }>(`/api/audit/revert/${changeId}`, {});
    },
    onSuccess: (data) => {
      if (data.success) {
        success("Cambio revertido");
        refetch(); // Refetch ZenStack query
      } else {
        showError(data.message);
      }
    },
    onError: (e) => showError(e.message),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      return await apiClient.post<{ success: boolean; message: string }>("/api/audit/export", {});
    },
    onSuccess: (data) => {
      if (data.success) {
        success("Exportación completada");
        queryClient.invalidateQueries({ queryKey: ["audit-stats"] });
      } else {
        showError(data.message);
      }
    },
    onError: (e) => showError(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-base-200/50 rounded-xl">
        <div className="border-base-content/5 flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <History className="text-secondary size-5" />
            <h2 className="text-lg font-semibold">Auditoría de Cambios</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0"
              title="Actualizar lista"
            >
              <RefreshCw className={cn("size-5", isFetching && "animate-spin")} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              isLoading={exportMutation.isPending}
              className="h-8 text-xs font-medium"
            >
              {!exportMutation.isPending && <Upload className="mr-1.5 size-4" />}
              Respaldar Ahora
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="bg-base-100/50 border-base-content/5 rounded-lg border p-3">
                <p className="text-base-content/60 text-xs">Total cambios</p>
                <p className="text-xl font-bold">{stats.totalChanges.toLocaleString()}</p>
              </div>
              <div className="bg-base-100/50 border-base-content/5 rounded-lg border p-3">
                <p className="text-base-content/60 text-xs">Pendientes export</p>
                <p className="text-warning text-xl font-bold">{stats.pendingExport.toLocaleString()}</p>
              </div>
              {stats.byOperation.slice(0, 2).map((op) => (
                <div key={op.operation} className="bg-base-100/50 border-base-content/5 rounded-lg border p-3">
                  <p className="text-base-content/60 flex items-center gap-1 text-xs">
                    {getOperationIcon(op.operation)} {getOperationLabel(op.operation)}
                  </p>
                  <p className="text-xl font-bold">{op.count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent Changes */}
          <div className="bg-base-200/50 divide-base-300 divide-y overflow-hidden rounded-xl">
            {changes.length === 0 ? (
              <div className="text-base-content/60 p-8 text-center">
                <History className="mx-auto mb-2 size-8 opacity-40" />
                <p>No hay cambios registrados aún</p>
              </div>
            ) : (
              changes.slice(0, 20).map((change: any) => (
                <div key={change.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getOperationIcon(change.operation)}
                      <div>
                        <p className="text-sm font-medium">
                          <span className="text-primary">{change.table_name}</span>
                          <span className="text-base-content/40 mx-1">#{change.row_id}</span>
                        </p>
                        <p className="text-base-content/60 text-xs">
                          {dayjs(change.created_at).format("DD MMM HH:mm:ss")}
                          {change.user && (
                            <span className="text-base-content/40 ml-2">• {change.user.name || change.user.email}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {change.diff && (
                        <button
                          onClick={() => setExpanded(expanded === change.id ? null : change.id)}
                          className="text-base-content/60 hover:text-base-content flex items-center gap-1 text-xs"
                        >
                          {expanded === change.id ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                          Diff
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const opText = (() => {
                            if (change.operation === "INSERT") return "eliminar este registro";
                            if (change.operation === "DELETE") return "recrear este registro";
                            return "restaurar los valores anteriores";
                          })();
                          if (
                            globalThis.confirm(
                              `¿Estás seguro de que deseas ${opText}?\n\nTabla: ${change.table_name}\nID: ${change.row_id}`
                            )
                          ) {
                            revertMutation.mutate(change.id);
                          }
                        }}
                        disabled={revertMutation.isPending}
                        title="Revertir este cambio"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Diff viewer - shows old → new */}
                  {expanded === change.id && (
                    <div className="bg-base-300/50 mt-2 overflow-x-auto rounded-lg p-3 font-mono text-xs">
                      {change.operation === "INSERT" && change.new_data && (
                        <div className="text-success">
                          <span className="text-base-content/60 mr-2">+ Creado:</span>
                          {Object.entries(change.new_data)
                            .slice(0, 5)
                            .map(([k, v]) => (
                              <span key={k} className="mr-3">
                                <span className="text-base-content/40">{k}=</span>
                                {JSON.stringify(v)}
                              </span>
                            ))}
                          {Object.keys(change.new_data).length > 5 && <span className="text-base-content/40">...</span>}
                        </div>
                      )}
                      {change.operation === "DELETE" && change.old_data && (
                        <div className="text-error">
                          <span className="text-base-content/60 mr-2">- Eliminado:</span>
                          {Object.entries(change.old_data)
                            .slice(0, 5)
                            .map(([k, v]) => (
                              <span key={k} className="mr-3">
                                <span className="text-base-content/40">{k}=</span>
                                {JSON.stringify(v)}
                              </span>
                            ))}
                        </div>
                      )}
                      {change.operation === "UPDATE" && change.diff && change.old_data && (
                        <div className="space-y-1">
                          {Object.entries(change.diff).map(([key, newValue]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-warning min-w-25">{key}:</span>
                              <span className="text-error line-through opacity-60">
                                {JSON.stringify(change.old_data?.[key])}
                              </span>
                              <span className="text-base-content/40">→</span>
                              <span className="text-success">{JSON.stringify(newValue)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
