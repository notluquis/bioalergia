import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileText,
  HardDrive,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import type { BackupFile, BackupJob, RestoreJob } from "@/features/backup/types";

import GoogleDriveConnect from "@/components/backup/GoogleDriveConnect";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { triggerBackup, triggerRestore } from "@/features/backup/api";
import { backupKeys } from "@/features/backup/queries";
import { formatFileSize } from "@/lib/format";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";

import "dayjs/locale/es";

dayjs.extend(relativeTime);
dayjs.locale("es");

// ==================== MAIN COMPONENT ====================

export default function BackupSettingsPage() {
  const { can } = useAuth();
  const { error: showError, success } = useToast();
  const queryClient = useQueryClient();

  // Permissions
  const canCreate = can("create", "Backup");

  // SSE state for live progress only
  const [liveJobs, setLiveJobs] = useState<{ backup: BackupJob | null; restore: null | RestoreJob }>({
    backup: null,
    restore: null,
  });

  // SSE connection for real-time progress
  useEffect(() => {
    const eventSource = new EventSource("/api/backups/progress");

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as {
          job: BackupJob | RestoreJob;
          jobs: { backup: BackupJob | null; restore: null | RestoreJob };
          type: "backup" | "init" | "restore";
        };
        switch (data.type) {
          case "backup": {
            setLiveJobs((prev) => ({ ...prev, backup: data.job as BackupJob }));
            if (data.job.status === "completed" || data.job.status === "failed") {
              void queryClient.invalidateQueries({ queryKey: ["backups"] });
            }

            break;
          }
          case "init": {
            setLiveJobs(data.jobs);

            break;
          }
          case "restore": {
            setLiveJobs((prev) => ({ ...prev, restore: data.job as RestoreJob }));
            if (data.job.status === "completed" || data.job.status === "failed") {
              void queryClient.invalidateQueries({ queryKey: ["backups"] });
            }

            break;
          }
          // No default
        }
      } catch {
        // Ignore parse errors
      }
    };

    const handleError = () => {
      eventSource.close();
    };

    eventSource.addEventListener("message", handleMessage);
    eventSource.addEventListener("error", handleError);

    return () => {
      eventSource.removeEventListener("message", handleMessage);
      eventSource.removeEventListener("error", handleError);
      eventSource.close();
    };
  }, [queryClient]);

  // Queries
  const { data: backups } = useSuspenseQuery({ ...backupKeys.lists(), refetchInterval: 30_000 });

  // Mutations
  const backupMutation = useMutation({
    mutationFn: triggerBackup,
    onError: (e) => {
      showError(e.message);
    },
    onSuccess: () => {
      success("Backup iniciado");
    },
  });

  // Computed
  const currentBackup = liveJobs.backup;
  const currentRestore = liveJobs.restore;
  const isRunning = currentBackup?.status === "running" || currentRestore?.status === "running";

  // Separate full backups from audit exports
  const fullBackups = backups.filter((b) => !b.name.startsWith("audit_"));
  const auditExports = backups.filter((b) => b.name.startsWith("audit_"));

  const totalSize = backups.reduce((acc, b) => {
    const sizeStr = b.size ?? "0";
    return acc + Number.parseInt(sizeStr, 10);
  }, 0);

  const renderBackupListContent = () => {
    if (fullBackups.length === 0) {
      return <div className="text-base-content/60 py-12 text-center">No hay backups disponibles</div>;
    }

    return (
      <>
        {fullBackups.map((backup) => (
          <BackupRow
            backup={backup}
            key={backup.id}
            onSuccess={() => void queryClient.invalidateQueries({ queryKey: ["backups"] })}
          />
        ))}
      </>
    );
  };

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
              {currentBackup?.currentStep ?? currentRestore?.currentStep}
            </span>
          </div>
          <div className="bg-base-300 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${currentBackup?.progress ?? currentRestore?.progress ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Google Drive Connection */}
      <GoogleDriveConnect />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          color="primary"
          icon={<HardDrive className="text-primary size-5" />}
          label="Backups completos"
          value={String(fullBackups.length)}
        />
        <StatCard
          color="info"
          icon={<FileText className="text-info size-5" />}
          label="Exports incrementales"
          value={String(auditExports.length)}
        />
        <StatCard
          color="success"
          icon={<Database className="text-success size-5" />}
          label="Almacenamiento total"
          value={formatFileSize(totalSize)}
        />
        <StatCard
          color="warning"
          icon={<Clock className="text-warning size-5" />}
          label="Último backup"
          value={fullBackups[0] ? dayjs(fullBackups[0].createdTime).fromNow(true) : "-"}
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0"
                onClick={() => void queryClient.invalidateQueries({ queryKey: ["backups"] })}
                size="sm"
                title="Actualizar lista"
                variant="outline"
              >
                <RefreshCw className={cn("size-5")} />
              </Button>
              <Button
                className="h-8 text-xs font-medium"
                disabled={!canCreate || isRunning || backupMutation.isPending}
                isLoading={backupMutation.isPending}
                onClick={() => {
                  backupMutation.mutate();
                }}
                size="sm"
                title={canCreate ? "Crear nuevo backup" : "No tienes permisos para crear backups"}
                variant="primary"
              >
                {!backupMutation.isPending &&
                  (canCreate ? <Upload className="mr-1.5 size-4" /> : <Lock className="mr-1.5 size-4" />)}
                Crear Backup
              </Button>
            </div>
          </div>
          <div className="divide-base-content/5 divide-y">{renderBackupListContent()}</div>
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
                  className="hover:bg-base-content/5 flex items-center justify-between px-4 py-3 text-sm transition-colors"
                  key={backup.id}
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
                        className="btn btn-ghost btn-xs btn-square"
                        href={backup.webViewLink}
                        rel="noopener noreferrer"
                        target="_blank"
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
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function BackupRow({ backup, onSuccess }: { backup: BackupFile; onSuccess: () => void }) {
  const { can } = useAuth();
  const { error: showError, success } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const canRestore = can("update", "Backup");

  const restoreMutation = useMutation<{ job: RestoreJob }, Error, string[] | void>({
    mutationFn: (tables) => triggerRestore(backup.id, tables ?? undefined),
    onError: (e) => {
      showError(e.message);
    },
    onSuccess: () => {
      success("Restauración iniciada");
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
      onSuccess();
    },
  });

  return (
    <div>
      <button
        className="hover:bg-base-content/5 focus:ring-primary/20 flex w-full cursor-pointer items-center justify-between p-4 px-4 text-left transition-colors focus:ring-2 focus:outline-none focus:ring-inset"
        onClick={() => {
          setIsExpanded(!isExpanded);
        }}
        type="button"
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
              className="btn btn-ghost btn-sm"
              href={backup.webViewLink}
              onClick={(e) => {
                e.stopPropagation();
              }}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Download className="size-4" />
            </a>
          )}
        </div>
      </button>

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
              disabled={!canRestore || restoreMutation.isPending}
              isLoading={restoreMutation.isPending}
              onClick={() => {
                restoreMutation.mutate();
              }}
              title={canRestore ? undefined : "Requiere permiso para restaurar"}
              variant="primary"
            >
              {!restoreMutation.isPending &&
                (canRestore ? <RotateCcw className="size-4" /> : <Lock className="size-4" />)}
              Restaurar Todo
            </Button>
            <span className="text-base-content/60 self-center text-sm">o selecciona tablas específicas abajo</span>
          </div>

          <div className="bg-base-200/50 rounded-lg p-4">
            <Suspense
              fallback={
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">Cargando tablas...</span>
                </div>
              }
            >
              <BackupTablesList
                backupId={backup.id}
                canRestore={canRestore}
                createdTime={backup.createdTime}
                isRestoring={restoreMutation.isPending}
                onRestore={restoreMutation.mutate}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupTablesList({
  backupId,
  canRestore,
  isRestoring,
  onRestore,
}: {
  backupId: string;
  canRestore: boolean;
  createdTime: string;
  isRestoring: boolean;
  onRestore: (tables: string[]) => void;
}) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const { data: tables } = useSuspenseQuery(backupKeys.tables(backupId));

  const toggleTable = (table: string) => {
    setSelectedTables((prev) => (prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]));
  };

  const selectAll = () => {
    setSelectedTables(tables.length === selectedTables.length ? [] : [...tables]);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">Seleccionar tablas</h4>
        <button className="text-primary text-xs hover:underline" onClick={selectAll} type="button">
          {selectedTables.length === tables.length ? "Ninguna" : "Todas"}
        </button>
      </div>

      <div className="mb-3">
        {tables.length === 0 && <p className="text-base-content/60 text-sm">No hay tablas en este backup.</p>}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <label
              className={cn(
                "border-base-content/10 hover:bg-base-content/5 flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
                selectedTables.includes(table) ? "border-primary bg-primary/5" : ""
              )}
              key={table}
            >
              <input
                checked={selectedTables.includes(table)}
                className="checkbox checkbox-primary checkbox-sm"
                onChange={() => {
                  toggleTable(table);
                }}
                type="checkbox"
              />
              <span className="flex-1 truncate">{table}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedTables.length > 0 && (
        <Button
          disabled={!canRestore || isRestoring}
          isLoading={isRestoring}
          onClick={() => {
            onRestore(selectedTables);
          }}
          size="sm"
          title={canRestore ? undefined : "Requiere permiso para restaurar"}
          variant="outline"
        >
          {!isRestoring && (canRestore ? <Play className="size-4" /> : <Lock className="size-4" />)}
          Restaurar {selectedTables.length} tabla{selectedTables.length > 1 ? "s" : ""}
        </Button>
      )}
    </>
  );
}

function StatCard({
  color,
  icon,
  label,
  value,
}: {
  color: "info" | "primary" | "success" | "warning";
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const bgColors = {
    info: "bg-info/10",
    primary: "bg-primary/10",
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
