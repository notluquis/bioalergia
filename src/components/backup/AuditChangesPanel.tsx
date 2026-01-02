/**
 * Audit Changes Panel Component
 *
 * Shows recent database changes with diffs and revert functionality.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  History,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Database,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Upload,
} from "lucide-react";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

// ==================== TYPES ====================

interface AuditChange {
  id: string;
  table_name: string;
  row_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  transaction_id: string;
  created_at: string;
  exported_at: string | null;
}

interface AuditStats {
  totalChanges: number;
  pendingExport: number;
  byTable: { table_name: string; count: number }[];
  byOperation: { operation: string; count: number }[];
}

// ==================== API ====================

const fetchAuditStats = async (): Promise<AuditStats> => {
  const res = await fetch("/api/audit/stats");
  if (!res.ok) throw new Error("Failed to fetch audit stats");
  return res.json();
};

const fetchRecentChanges = async (): Promise<AuditChange[]> => {
  const res = await fetch("/api/audit/changes?limit=50");
  if (!res.ok) throw new Error("Failed to fetch changes");
  return (await res.json()).changes;
};

const revertChange = async (changeId: string): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`/api/audit/revert/${changeId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to revert change");
  return res.json();
};

const triggerExport = async (): Promise<{ success: boolean; message: string }> => {
  const res = await fetch("/api/audit/export", { method: "POST" });
  if (!res.ok) throw new Error("Failed to export");
  return res.json();
};

// ==================== HELPERS ====================

function getOperationIcon(op: string) {
  switch (op) {
    case "INSERT":
      return <Plus className="text-success size-4" />;
    case "UPDATE":
      return <Pencil className="text-warning size-4" />;
    case "DELETE":
      return <Trash2 className="text-error size-4" />;
    default:
      return <Database className="size-4" />;
  }
}

function getOperationLabel(op: string) {
  switch (op) {
    case "INSERT":
      return "Creado";
    case "UPDATE":
      return "Modificado";
    case "DELETE":
      return "Eliminado";
    default:
      return op;
  }
}

// ==================== MAIN COMPONENT ====================

export default function AuditChangesPanel() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Queries
  const statsQuery = useQuery({
    queryKey: ["audit-stats"],
    queryFn: fetchAuditStats,
    refetchInterval: 60000,
  });

  const changesQuery = useQuery({
    queryKey: ["audit-changes"],
    queryFn: fetchRecentChanges,
  });

  // Mutations
  const revertMutation = useMutation({
    mutationFn: revertChange,
    onSuccess: (data) => {
      if (data.success) {
        success("Cambio revertido");
        queryClient.invalidateQueries({ queryKey: ["audit-changes"] });
      } else {
        showError(data.message);
      }
    },
    onError: (e) => showError(e.message),
  });

  const exportMutation = useMutation({
    mutationFn: triggerExport,
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

  const stats = statsQuery.data;
  const changes = changesQuery.data || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="text-secondary size-5" />
          <h2 className="text-lg font-semibold">Auditoría de Cambios</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["audit-changes"] })}
            disabled={changesQuery.isLoading}
          >
            <RefreshCw className={cn("size-4", changesQuery.isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || !stats?.pendingExport}
            isLoading={exportMutation.isPending}
          >
            {!exportMutation.isPending && <Upload className="size-4" />}
            Exportar ({stats?.pendingExport || 0})
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-base-200/50 rounded-lg p-3">
            <p className="text-base-content/60 text-xs">Total cambios</p>
            <p className="text-lg font-bold">{stats.totalChanges.toLocaleString()}</p>
          </div>
          <div className="bg-base-200/50 rounded-lg p-3">
            <p className="text-base-content/60 text-xs">Pendientes export</p>
            <p className="text-warning text-lg font-bold">{stats.pendingExport.toLocaleString()}</p>
          </div>
          {stats.byOperation.slice(0, 2).map((op) => (
            <div key={op.operation} className="bg-base-200/50 rounded-lg p-3">
              <p className="text-base-content/60 flex items-center gap-1 text-xs">
                {getOperationIcon(op.operation)} {getOperationLabel(op.operation)}
              </p>
              <p className="text-lg font-bold">{op.count.toLocaleString()}</p>
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
          changes.slice(0, 20).map((change) => (
            <div key={change.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getOperationIcon(change.operation)}
                  <div>
                    <p className="text-sm font-medium">
                      <span className="text-primary">{change.table_name}</span>
                      <span className="text-base-content/40 mx-1">#{change.row_id}</span>
                    </p>
                    <p className="text-base-content/60 text-xs">{dayjs(change.created_at).format("DD MMM HH:mm:ss")}</p>
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
                    onClick={() => revertMutation.mutate(change.id)}
                    disabled={revertMutation.isPending}
                    title="Revertir este cambio"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Diff viewer */}
              {expanded === change.id && change.diff && (
                <div className="bg-base-300/50 mt-2 overflow-x-auto rounded-lg p-3 font-mono text-xs">
                  {Object.entries(change.diff).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-warning">{key}:</span>
                      <span className="text-success">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
