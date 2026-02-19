import { Checkbox, Description, Link, Skeleton } from "@heroui/react";
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
import {
  type Dispatch,
  type SetStateAction,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { GoogleDriveConnect } from "@/components/backup/GoogleDriveConnect";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { triggerBackup, triggerRestore } from "@/features/backup/api";
import { backupKeys } from "@/features/backup/queries";
import type { BackupFile, BackupJob, RestoreJob } from "@/features/backup/types";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

import "dayjs/locale/es";

dayjs.extend(relativeTime);
dayjs.locale("es");

type BackupProgressMessage = {
  job: BackupJob | RestoreJob;
  jobs: { backup: BackupJob | null; restore: null | RestoreJob };
  type: "backup" | "init" | "restore";
};

const isJobFinished = (status: BackupJob["status"] | RestoreJob["status"]) =>
  status === "completed" || status === "failed";

function applyBackupProgressMessage(params: {
  data: BackupProgressMessage;
  onRefreshBackups: () => void;
  setLastCompletedBackupResult: Dispatch<SetStateAction<BackupJob["result"] | null>>;
  setLiveJobs: Dispatch<SetStateAction<{ backup: BackupJob | null; restore: null | RestoreJob }>>;
}) {
  const { data, onRefreshBackups, setLastCompletedBackupResult, setLiveJobs } = params;

  switch (data.type) {
    case "init":
      setLiveJobs(data.jobs);
      break;
    case "backup": {
      const backupJob = data.job as BackupJob;
      setLiveJobs((prev) => ({ ...prev, backup: backupJob }));
      if (isJobFinished(backupJob.status)) {
        onRefreshBackups();
      }
      if (backupJob.status === "completed" && backupJob.result) {
        setLastCompletedBackupResult(backupJob.result);
      }
      break;
    }
    case "restore": {
      const restoreJob = data.job as RestoreJob;
      setLiveJobs((prev) => ({ ...prev, restore: restoreJob }));
      if (isJobFinished(restoreJob.status)) {
        onRefreshBackups();
      }
      break;
    }
  }
}

function useBackupProgress(onRefreshBackups: () => void) {
  const [liveJobs, setLiveJobs] = useState<{
    backup: BackupJob | null;
    restore: null | RestoreJob;
  }>({
    backup: null,
    restore: null,
  });
  const [lastCompletedBackupResult, setLastCompletedBackupResult] = useState<
    BackupJob["result"] | null
  >(null);

  useEffect(() => {
    const eventSource = new EventSource("/api/backups/progress");

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as BackupProgressMessage;
        applyBackupProgressMessage({
          data,
          onRefreshBackups,
          setLastCompletedBackupResult,
          setLiveJobs,
        });
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
  }, [onRefreshBackups]);

  return { lastCompletedBackupResult, liveJobs };
}

function RunningJobProgressCard({
  currentBackup,
  currentRestore,
}: {
  currentBackup: BackupJob | null;
  currentRestore: null | RestoreJob;
}) {
  if (currentBackup?.status !== "running" && currentRestore?.status !== "running") {
    return null;
  }

  return (
    <div className="rounded-xl bg-default-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="font-medium">
            {currentBackup?.status === "running"
              ? "Backup en progreso"
              : "Restauración en progreso"}
          </span>
        </div>
        <span className="font-mono text-default-500 text-sm">
          {currentBackup?.currentStep ?? currentRestore?.currentStep}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-default-100">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${currentBackup?.progress ?? currentRestore?.progress ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function LastCompletedBackupCard({ result }: { result: BackupJob["result"] | null }) {
  if (!result) {
    return null;
  }

  const statsEntries = result.stats ? Object.entries(result.stats) : [];
  const hasStats = statsEntries.length > 0;

  return (
    <div className="rounded-xl bg-default-50 p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-5 text-success" />
          <span className="font-semibold text-base">Detalle del último backup</span>
        </div>
        <span className="text-default-500 text-xs">{result.filename || "-"}</span>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-background p-3">
          <span className="block text-default-500 text-xs">Duración</span>
          <span className="font-semibold">{Math.round((result.durationMs ?? 0) / 1000)}s</span>
        </div>
        <div className="rounded-lg bg-background p-3">
          <span className="block text-default-500 text-xs">Tamaño</span>
          <span className="font-semibold">{formatFileSize(result.sizeBytes ?? 0)}</span>
        </div>
        <div className="rounded-lg bg-background p-3">
          <span className="block text-default-500 text-xs">Tablas</span>
          <span className="font-semibold">{result.tables?.length ?? 0}</span>
        </div>
      </div>

      {hasStats ? (
        <div className="rounded-lg border border-default-200 bg-background p-3">
          <span className="mb-2 block font-medium text-sm">Conteo por tabla</span>
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-default-500 text-xs">
                  <th className="pb-2 text-left font-medium">Tabla</th>
                  <th className="pb-2 text-right font-medium">Registros</th>
                </tr>
              </thead>
              <tbody>
                {statsEntries
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([tableName, stat]) => (
                    <tr className="border-default-100 border-t" key={tableName}>
                      <td className="py-2">{tableName}</td>
                      <td className="py-2 text-right">{stat.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-default-200 bg-background p-3 text-default-500 text-sm">
          No hay estadísticas por tabla disponibles para este backup.
        </div>
      )}
    </div>
  );
}

function BackupSummaryCards({
  auditExportsCount,
  fullBackupsLength,
  latestBackupCreatedTime,
  totalSize,
}: {
  auditExportsCount: number;
  fullBackupsLength: number;
  latestBackupCreatedTime: Date | undefined;
  totalSize: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard
        color="primary"
        icon={<HardDrive className="size-5 text-primary" />}
        label="Backups completos"
        value={String(fullBackupsLength)}
      />

      <StatCard
        color="info"
        icon={<FileText className="size-5 text-info" />}
        label="Exports incrementales"
        value={String(auditExportsCount)}
      />

      <StatCard
        color="success"
        icon={<Database className="size-5 text-success" />}
        label="Almacenamiento total"
        value={formatFileSize(totalSize)}
      />

      <StatCard
        color="warning"
        icon={<Clock className="size-5 text-warning" />}
        label="Último backup"
        value={latestBackupCreatedTime ? dayjs(latestBackupCreatedTime).fromNow(true) : "-"}
      />
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export function BackupSettingsPage() {
  const { can } = useAuth();
  const { error: showError, success } = useToast();
  const queryClient = useQueryClient();
  const refreshBackups = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["backups"] });
  }, [queryClient]);

  // Permissions
  const canCreate = can("create", "Backup");
  const { lastCompletedBackupResult, liveJobs } = useBackupProgress(refreshBackups);

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
      return <div className="py-12 text-center text-default-500">No hay backups disponibles</div>;
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
    <div className="space-y-6">
      <RunningJobProgressCard currentBackup={currentBackup} currentRestore={currentRestore} />

      {/* Google Drive Connection */}
      <GoogleDriveConnect />

      <LastCompletedBackupCard result={lastCompletedBackupResult} />

      <BackupSummaryCards
        auditExportsCount={auditExports.length}
        fullBackupsLength={fullBackups.length}
        latestBackupCreatedTime={fullBackups[0]?.createdTime}
        totalSize={totalSize}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Full Backups List */}
        <div className="rounded-xl bg-default-50/50">
          <div className="flex items-center justify-between border-default-100 border-b p-4">
            <div>
              <span className="font-semibold text-lg">Backups Completos</span>
              <span className="block text-default-500 text-sm">Snapshots completos</span>
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
                className="h-8 font-medium text-xs"
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
                  (canCreate ? (
                    <Upload className="mr-1.5 size-4" />
                  ) : (
                    <Lock className="mr-1.5 size-4" />
                  ))}
                Crear Backup
              </Button>
            </div>
          </div>
          <div className="divide-y divide-default-100">{renderBackupListContent()}</div>
        </div>

        {/* Incremental Exports */}
        <div className="rounded-xl bg-default-50/50">
          <div className="border-default-100 border-b p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-lg">Exports Incrementales</span>
                <span className="block text-default-500 text-sm">Cambios por hora</span>
              </div>
              <span className="rounded-full bg-default-100 px-2 py-1 font-medium text-xs">
                {auditExports.length}
              </span>
            </div>
          </div>
          {auditExports.length > 0 ? (
            <div className="max-h-125 divide-y divide-default-100 overflow-y-auto">
              {auditExports.slice(0, 50).map((backup) => (
                <div
                  className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-default-50"
                  key={backup.id}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-info/10 p-1.5 text-info">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <span className="block font-medium">{backup.name}</span>
                      <Description className="text-default-500 text-xs">
                        {dayjs(backup.createdTime).format("DD MMM HH:mm")}
                      </Description>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-background/50 px-1.5 py-0.5 font-mono text-xs opacity-60">
                      {formatFileSize(Number(backup.size))}
                    </span>
                    {backup.webViewLink && (
                      <Button
                        isIconOnly
                        onPress={() => window.open(backup.webViewLink, "_blank")}
                        size="sm"
                        variant="ghost"
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-default-500 text-sm">
              No hay exports incrementales
            </div>
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

  const restoreMutation = useMutation<RestoreJob, Error, string[] | undefined>({
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
      <Button
        aria-expanded={isExpanded}
        className="flex w-full cursor-pointer items-center justify-between p-4 px-4 text-left transition-colors hover:bg-default-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset"
        onPress={() => {
          setIsExpanded(!isExpanded);
        }}
        type="button"
        variant="ghost"
      >
        <div className="flex items-center gap-4">
          {isExpanded ? (
            <ChevronDown className="size-4 text-default-300" />
          ) : (
            <ChevronRight className="size-4 text-default-300" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-success" />
              <span className="font-medium">{backup.name}</span>
            </div>
            <Description className="text-default-500 text-sm">
              {dayjs(backup.createdTime).format("DD MMM YYYY, HH:mm")} •{" "}
              {formatFileSize(Number(backup.size))}
            </Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {backup.webViewLink && (
            <Link
              className="inline-flex h-8 w-8 items-center justify-center rounded-medium hover:bg-default-100"
              href={backup.webViewLink}
              rel="noreferrer"
              target="_blank"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Download className="size-4" />
            </Link>
          )}
        </div>
      </Button>

      {isExpanded && (
        <div className="bg-default-100/30 px-6 py-4">
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              La restauración sobrescribirá datos existentes. Puedes restaurar todo o seleccionar
              tablas específicas.
            </span>
          </div>

          {/* Quick restore all button */}
          <div className="mb-4 flex gap-3">
            <Button
              disabled={!canRestore || restoreMutation.isPending}
              isLoading={restoreMutation.isPending}
              onClick={() => {
                restoreMutation.mutate(undefined);
              }}
              title={canRestore ? undefined : "Requiere permiso para restaurar"}
              variant="primary"
            >
              {!restoreMutation.isPending &&
                (canRestore ? <RotateCcw className="size-4" /> : <Lock className="size-4" />)}
              Restaurar Todo
            </Button>
            <span className="self-center text-default-500 text-sm">
              o selecciona tablas específicas abajo
            </span>
          </div>

          <div className="rounded-lg bg-default-50/50 p-4">
            <Suspense
              fallback={
                <div className="space-y-2 py-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton
                      className="h-8 w-full rounded-md"
                      key={`backup-table-skeleton-${index + 1}`}
                    />
                  ))}
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
  createdTime: Date;
  isRestoring: boolean;
  onRestore: (tables: string[]) => void;
}) {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const { data: tables } = useSuspenseQuery(backupKeys.tables(backupId));

  const toggleTable = (table: string) => {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table],
    );
  };

  const selectAll = () => {
    setSelectedTables(tables.length === selectedTables.length ? [] : [...tables]);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-sm">Seleccionar tablas</span>
        <Button
          className="text-primary text-xs hover:underline"
          onPress={selectAll}
          type="button"
          variant="ghost"
        >
          {selectedTables.length === tables.length ? "Ninguna" : "Todas"}
        </Button>
      </div>

      <div className="mb-3">
        {tables.length === 0 && (
          <Description className="text-default-500 text-sm">
            No hay tablas en este backup.
          </Description>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((table) => (
            <div
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border border-default-200 p-2 text-sm transition-colors hover:bg-default-50",
                selectedTables.includes(table) ? "border-primary bg-primary/5" : "",
              )}
              key={table}
            >
              <Checkbox
                isSelected={selectedTables.includes(table)}
                onChange={() => toggleTable(table)}
              >
                <span className="flex-1 truncate">{table}</span>
              </Checkbox>
            </div>
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
    <div className="rounded-xl bg-default-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", bgColors[color])}>{icon}</div>
        <div>
          <span className="block text-default-500 text-sm">{label}</span>
          <span className="block font-bold text-2xl">{value}</span>
        </div>
      </div>
    </div>
  );
}
