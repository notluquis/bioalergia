import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Clock,
  CheckCircle,
  Loader2,
  HardDrive,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Play,
  RotateCcw,
  FileText,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/es";

import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/format";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import AuditChangesPanel from "@/components/backup/AuditChangesPanel";

dayjs.extend(relativeTime);
dayjs.locale("es");

// ==================== TYPES ====================

interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink?: string;
}

interface BackupJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  type: "full" | "scheduled";
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentStep: string;
  result?: {
    filename: string;
    sizeBytes: number;
    durationMs: number;
    driveFileId: string;
    tables: string[];
  };
  error?: string;
}

interface RestoreJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  backupFileId: string;
  tables?: string[];
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentStep: string;
  error?: string;
}

// ==================== API ====================

const fetchBackups = async (): Promise<BackupFile[]> => {
  const res = await fetch("/api/backups");
  if (!res.ok) throw new Error("Failed to fetch backups");
  return (await res.json()).backups;
};

const fetchTables = async (fileId: string): Promise<string[]> => {
  const res = await fetch(`/api/backups/${fileId}/tables`);
  if (!res.ok) throw new Error("Failed to fetch tables");
  return (await res.json()).tables;
};

const fetchTablesWithChanges = async (since?: string): Promise<string[]> => {
  const url = since
    ? `/api/audit/tables-with-changes?since=${encodeURIComponent(since)}`
    : "/api/audit/tables-with-changes";
  const res = await fetch(url);
  if (!res.ok) return [];
  return (await res.json()).tables;
};

const triggerBackup = async (): Promise<{ job: BackupJob }> => {
  const res = await fetch("/api/backups", { method: "POST" });
  if (!res.ok) throw new Error("Failed to start backup");
  return res.json();
};

const triggerRestore = async (fileId: string, tables?: string[]): Promise<{ job: RestoreJob }> => {
  const res = await fetch(`/api/backups/${fileId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tables }),
  });
  if (!res.ok) throw new Error("Failed to start restore");
  return res.json();
};

// ==================== MAIN COMPONENT ====================

export default function BackupSettingsPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  // SSE state for live progress only
  const [liveJobs, setLiveJobs] = useState<{ backup: BackupJob | null; restore: RestoreJob | null }>({
    backup: null,
    restore: null,
  });

  // SSE connection for real-time progress
  useEffect(() => {
    const eventSource = new EventSource("/api/backups/progress");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          setLiveJobs(data.jobs);
        } else if (data.type === "backup") {
          setLiveJobs((prev) => ({ ...prev, backup: data.job }));
          if (data.job.status === "completed" || data.job.status === "failed") {
            queryClient.invalidateQueries({ queryKey: ["backups"] });
          }
        } else if (data.type === "restore") {
          setLiveJobs((prev) => ({ ...prev, restore: data.job }));
          if (data.job.status === "completed" || data.job.status === "failed") {
            queryClient.invalidateQueries({ queryKey: ["backups"] });
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [queryClient]);

  // Queries
  const backupsQuery = useQuery({ queryKey: ["backups"], queryFn: fetchBackups, refetchInterval: 30000 });

  // Mutations
  const backupMutation = useMutation({
    mutationFn: triggerBackup,
    onSuccess: () => success("Backup iniciado"),
    onError: (e) => showError(e.message),
  });

  // Computed
  const currentBackup = liveJobs.backup;
  const currentRestore = liveJobs.restore;
  const isRunning = currentBackup?.status === "running" || currentRestore?.status === "running";
  const backups = backupsQuery.data || [];

  // Separate full backups from audit exports
  const fullBackups = backups.filter((b) => !b.name.startsWith("audit_"));
  const auditExports = backups.filter((b) => b.name.startsWith("audit_"));

  const totalSize = backups.reduce((acc, b) => acc + parseInt(b.size || "0", 10), 0);

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-6")}>
      {/* Actions Row */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["backups"] })}
          disabled={backupsQuery.isFetching}
        >
          <RefreshCw className={cn("size-4", backupsQuery.isFetching && "animate-spin")} />
        </Button>
        <Button
          variant="primary"
          onClick={() => backupMutation.mutate()}
          disabled={isRunning || backupMutation.isPending}
          isLoading={backupMutation.isPending}
        >
          {!backupMutation.isPending && <Upload className="size-4" />}
          Crear Backup
        </Button>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="bg-base-200 rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="text-primary size-5 animate-spin" />
              <span className="font-semibold">
                {currentBackup?.status === "running" ? "Backup en progreso" : "Restauración en progreso"}
              </span>
            </div>
            <span className="text-base-content/60 text-sm">
              {currentBackup?.currentStep || currentRestore?.currentStep}
            </span>
          </div>
          <div className="bg-base-300 h-3 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${currentBackup?.progress || currentRestore?.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={<HardDrive className="text-primary size-5" />}
          label="Backups completos"
          value={String(fullBackups.length)}
          color="primary"
        />
        <StatCard
          icon={<FileText className="text-info size-5" />}
          label="Exports incrementales"
          value={String(auditExports.length)}
          color="info"
        />
        <StatCard
          icon={<Database className="text-success size-5" />}
          label="Almacenamiento total"
          value={formatFileSize(totalSize)}
          color="success"
        />
        <StatCard
          icon={<Clock className="text-warning size-5" />}
          label="Último backup"
          value={fullBackups[0] ? dayjs(fullBackups[0].createdTime).fromNow() : "-"}
          color="warning"
        />
      </div>

      {/* Full Backups List */}
      <div className="bg-base-200/50 rounded-xl">
        <div className="p-4">
          <h2 className="font-semibold">Backups Completos</h2>
          <p className="text-base-content/60 text-sm">Snapshots completos de la base de datos (domingos 3am)</p>
        </div>
        <div className="divide-base-content/5 divide-y">
          {backupsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary size-6 animate-spin" />
            </div>
          ) : backupsQuery.error ? (
            <div className="text-error py-12 text-center">Error al cargar backups</div>
          ) : fullBackups.length === 0 ? (
            <div className="text-base-content/60 py-12 text-center">No hay backups disponibles</div>
          ) : (
            fullBackups.map((backup) => (
              <BackupRow
                key={backup.id}
                backup={backup}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["backups"] })}
              />
            ))
          )}
        </div>
      </div>

      {/* Incremental Exports (collapsible) */}
      {auditExports.length > 0 && (
        <details className="bg-base-200/50 rounded-xl">
          <summary className="cursor-pointer p-4">
            <span className="font-semibold">Exports Incrementales ({auditExports.length})</span>
            <span className="text-base-content/60 ml-2 text-sm">Cambios exportados cada hora</span>
          </summary>
          <div className="divide-base-content/5 max-h-64 divide-y overflow-y-auto">
            {auditExports.slice(0, 20).map((backup) => (
              <div key={backup.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="text-info size-4" />
                  <span>{backup.name}</span>
                </div>
                <div className="text-base-content/60 flex items-center gap-3">
                  <span>{formatFileSize(Number(backup.size))}</span>
                  <span>{dayjs(backup.createdTime).format("DD MMM HH:mm")}</span>
                  {backup.webViewLink && (
                    <a href={backup.webViewLink} target="_blank" rel="noopener noreferrer">
                      <Download className="hover:text-primary size-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Audit Changes Panel */}
      <AuditChangesPanel />
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "primary" | "info" | "success" | "warning";
}) {
  const bgColors = {
    primary: "bg-primary/10",
    info: "bg-info/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
  };

  return (
    <div className="bg-base-200/50 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", bgColors[color])}>{icon}</div>
        <div>
          <p className="text-base-content/60 text-sm">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function BackupRow({ backup, onSuccess }: { backup: BackupFile; onSuccess: () => void }) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const tablesQuery = useQuery({
    queryKey: ["backup-tables", backup.id],
    queryFn: () => fetchTables(backup.id),
    enabled: isExpanded,
  });

  // Fetch tables that have changes AFTER this backup was created
  const tablesWithChangesQuery = useQuery({
    queryKey: ["tables-with-changes", backup.createdTime],
    queryFn: () => fetchTablesWithChanges(backup.createdTime),
    enabled: isExpanded,
    staleTime: 30000,
  });

  const restoreMutation = useMutation({
    mutationFn: (tables?: string[]) => triggerRestore(backup.id, tables),
    onSuccess: () => {
      success("Restauración iniciada");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      onSuccess();
    },
    onError: (e) => showError(e.message),
  });

  const tablesWithChanges = new Set(tablesWithChangesQuery.data || []);
  const toggleTable = (table: string) =>
    setSelectedTables((prev) => (prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]));

  return (
    <div>
      <div
        className="hover:bg-base-content/5 flex cursor-pointer items-center justify-between p-4 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {isExpanded ? (
            <ChevronDown className="text-base-content/40 size-4" />
          ) : (
            <ChevronRight className="text-base-content/40 size-4" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-success size-4" />
              <p className="font-medium">{backup.name}</p>
            </div>
            <p className="text-base-content/60 text-sm">
              {dayjs(backup.createdTime).format("DD MMM YYYY, HH:mm")} • {formatFileSize(Number(backup.size))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {backup.webViewLink && (
            <a
              href={backup.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="size-4" />
            </a>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-base-300/30 px-6 py-4">
          <div className="bg-warning/10 text-warning mb-4 flex items-start gap-2 rounded-lg p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              La restauración sobrescribirá datos existentes. Puedes restaurar todo o seleccionar tablas específicas.
            </span>
          </div>

          {/* Quick restore all button */}
          <div className="mb-4 flex gap-3">
            <Button
              variant="primary"
              onClick={() => restoreMutation.mutate(undefined)}
              disabled={restoreMutation.isPending}
              isLoading={restoreMutation.isPending}
            >
              {!restoreMutation.isPending && <RotateCcw className="size-4" />}
              Restaurar Todo
            </Button>
            <span className="text-base-content/60 self-center text-sm">o selecciona tablas específicas abajo</span>
          </div>

          <div className="bg-base-200/50 rounded-lg p-4">
            <h4 className="mb-3 text-sm font-medium">Restaurar tablas específicas</h4>

            {tablesQuery.isLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Cargando tablas...</span>
              </div>
            ) : tablesQuery.error ? (
              <p className="text-error text-sm">Error al cargar tablas</p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {tablesQuery.data?.map((table) => {
                    const hasChanges = tablesWithChanges.has(table);
                    return (
                      <label
                        key={table}
                        className={cn(
                          "border-base-content/10 flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
                          selectedTables.includes(table)
                            ? "border-primary bg-primary/5"
                            : hasChanges
                              ? "border-warning/50 bg-warning/5"
                              : "hover:bg-base-content/5"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary checkbox-sm"
                          checked={selectedTables.includes(table)}
                          onChange={() => toggleTable(table)}
                        />
                        <span className="flex-1 truncate">{table}</span>
                        {hasChanges && (
                          <span className="bg-warning size-2 shrink-0 rounded-full" title="Tiene cambios recientes" />
                        )}
                      </label>
                    );
                  })}
                </div>

                {selectedTables.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restoreMutation.mutate(selectedTables)}
                    disabled={restoreMutation.isPending}
                    isLoading={restoreMutation.isPending}
                  >
                    {!restoreMutation.isPending && <Play className="size-4" />}
                    Restaurar {selectedTables.length} tabla{selectedTables.length > 1 ? "s" : ""}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
