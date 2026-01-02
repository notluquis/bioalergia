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
      {/* Progress Bar */}
      {isRunning && (
        <div className="bg-base-200 rounded-xl p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="text-primary size-5 animate-spin" />
              <span className="font-medium">
                {currentBackup?.status === "running" ? "Backup en progreso" : "Restauración en progreso"}
              </span>
            </div>
            <span className="text-base-content/60 font-mono text-sm">
              {currentBackup?.currentStep || currentRestore?.currentStep}
            </span>
          </div>
          <div className="bg-base-300 h-2 overflow-hidden rounded-full">
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
          value={fullBackups[0] ? dayjs(fullBackups[0].createdTime).fromNow(true) : "-"}
          color="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Full Backups List */}
        <div className="bg-base-200/50 rounded-xl">
          <div className="border-base-content/5 flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-lg font-semibold">Backups Completos</h2>
              <p className="text-base-content/60 text-sm">Snapshots completos</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["backups"] })}
                disabled={backupsQuery.isFetching}
                title="Actualizar lista"
                className="h-8 w-8 rounded-full p-0"
              >
                <RefreshCw className={cn("size-5", backupsQuery.isFetching && "animate-spin")} />
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => backupMutation.mutate()}
                disabled={isRunning || backupMutation.isPending}
                isLoading={backupMutation.isPending}
                className="h-8 text-xs font-medium"
              >
                {!backupMutation.isPending && <Upload className="mr-1.5 size-4" />}
                Crear Backup
              </Button>
            </div>
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

        {/* Incremental Exports */}
        <div className="bg-base-200/50 rounded-xl">
          <div className="border-base-content/5 border-b p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Exports Incrementales</h2>
                <p className="text-base-content/60 text-sm">Cambios por hora</p>
              </div>
              <span className="bg-base-content/10 rounded-full px-2 py-1 text-xs font-medium">
                {auditExports.length}
              </span>
            </div>
          </div>
          {auditExports.length > 0 ? (
            <div className="divide-base-content/5 max-h-125 divide-y overflow-y-auto">
              {auditExports.slice(0, 50).map((backup) => (
                <div
                  key={backup.id}
                  className="hover:bg-base-content/5 flex items-center justify-between px-4 py-3 text-sm transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-info/10 text-info rounded-lg p-1.5">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium">{backup.name}</p>
                      <p className="text-base-content/60 text-xs">{dayjs(backup.createdTime).format("DD MMM HH:mm")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-base-100/50 rounded px-1.5 py-0.5 font-mono text-xs opacity-60">
                      {formatFileSize(Number(backup.size))}
                    </span>
                    {backup.webViewLink && (
                      <a
                        href={backup.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square"
                      >
                        <Download className="size-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-base-content/60 py-12 text-center text-sm">No hay exports incrementales</div>
          )}
        </div>
      </div>

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
          <p className="text-2xl font-bold">{value}</p>
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
            {tablesQuery.isLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Cargando tablas...</span>
              </div>
            ) : tablesQuery.error ? (
              <p className="text-error text-sm">Error al cargar tablas</p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">Tablas con cambios recientes</h4>
                  </div>
                  {/* Toggle moved to render logic or just implied by logic above; keeping it simple */}
                </div>

                <div className="mb-3">
                  {tablesQuery.data?.length === 0 && (
                    <p className="text-base-content/60 text-sm">No hay tablas en este backup.</p>
                  )}

                  {(() => {
                    const allTables = tablesQuery.data || [];
                    const changedTables = allTables.filter((t) => tablesWithChanges.has(t));
                    const unchangedTables = allTables.filter((t) => !tablesWithChanges.has(t));

                    if (changedTables.length === 0) {
                      return (
                        <div className="border-base-content/10 bg-base-200/30 rounded-lg border py-4 text-center">
                          <p className="text-base-content/60 text-sm">
                            No hay tablas con cambios registrados desde este backup.
                          </p>
                          <button
                            className="text-primary mt-2 text-xs hover:underline"
                            onClick={() => {
                              const el = document.getElementById(`unchanged-tables-${backup.id}`);
                              if (el) el.style.display = el.style.display === "none" ? "grid" : "none";
                            }}
                          >
                            Ver todas las tablas de todas formas
                          </button>
                          <div
                            id={`unchanged-tables-${backup.id}`}
                            className="mt-3 grid grid-cols-2 gap-2 text-left sm:grid-cols-3 md:grid-cols-4"
                            style={{ display: "none" }}
                          >
                            {allTables.map((table) => (
                              <label
                                key={table}
                                className={cn(
                                  "border-base-content/10 hover:bg-base-content/5 flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
                                  selectedTables.includes(table) ? "border-primary bg-primary/5" : ""
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-primary checkbox-sm"
                                  checked={selectedTables.includes(table)}
                                  onChange={() => toggleTable(table)}
                                />
                                <span className="flex-1 truncate">{table}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {changedTables.map((table) => (
                            <label
                              key={table}
                              className={cn(
                                "border-warning/50 bg-warning/5 flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
                                selectedTables.includes(table) ? "border-primary bg-primary/5" : ""
                              )}
                            >
                              <input
                                type="checkbox"
                                className="checkbox checkbox-primary checkbox-sm"
                                checked={selectedTables.includes(table)}
                                onChange={() => toggleTable(table)}
                              />
                              <span className="flex-1 truncate">{table}</span>
                              <span
                                className="bg-warning size-2 shrink-0 rounded-full"
                                title="Tiene cambios recientes"
                              />
                            </label>
                          ))}
                        </div>

                        {unchangedTables.length > 0 && (
                          <div className="mt-4">
                            <details className="group">
                              <summary className="text-base-content/60 hover:text-base-content flex cursor-pointer items-center gap-2 text-xs">
                                <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                                Mostrar tablas sin cambios ({unchangedTables.length})
                              </summary>
                              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                {unchangedTables.map((table) => (
                                  <label
                                    key={table}
                                    className={cn(
                                      "border-base-content/10 hover:bg-base-content/5 flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
                                      selectedTables.includes(table) ? "border-primary bg-primary/5" : ""
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-primary checkbox-sm"
                                      checked={selectedTables.includes(table)}
                                      onChange={() => toggleTable(table)}
                                    />
                                    <span className="flex-1 truncate">{table}</span>
                                  </label>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
