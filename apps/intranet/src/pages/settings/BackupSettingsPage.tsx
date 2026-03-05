import {
  Button,
  Card,
  Checkbox,
  Description,
  Disclosure,
  Link,
  ScrollShadow,
  Skeleton,
  Surface,
  Table,
} from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Download,
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

const isJobActive = (status: BackupJob["status"] | RestoreJob["status"] | undefined) =>
  status === "pending" || status === "running" || status === "uploading";

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
  isBackupStarting,
}: {
  currentBackup: BackupJob | null;
  currentRestore: null | RestoreJob;
  isBackupStarting: boolean;
}) {
  const hasActiveBackup = isJobActive(currentBackup?.status);
  const hasActiveRestore = isJobActive(currentRestore?.status);
  const shouldShow = hasActiveBackup || hasActiveRestore || isBackupStarting;
  if (!shouldShow) {
    return null;
  }

  const isBackupFlow = hasActiveBackup || isBackupStarting;
  const progress =
    currentBackup?.progress ?? currentRestore?.progress ?? (isBackupStarting ? 8 : 0);
  const stepLabel =
    currentBackup?.currentStep ??
    currentRestore?.currentStep ??
    (isBackupStarting ? "Inicializando backup..." : "En cola...");

  return (
    <Surface aria-live="polite" className="rounded-[28px] p-6 shadow-inner" variant="secondary">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 text-primary" />
          <span className="font-medium">
            {isBackupFlow ? "Backup en progreso" : "Restauración en progreso"}
          </span>
        </div>
        <span className="font-mono text-default-500 text-sm">{stepLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-default-100">
        <div
          className={cn("h-full bg-primary ", {
            "": progress < 12,
          })}
          style={{ width: `${progress}%` }}
        />
      </div>
    </Surface>
  );
}

function LastCompletedBackupCard({ result }: { result: BackupJob["result"] | null }) {
  if (!result) {
    return null;
  }

  const statsEntries = result.stats ? Object.entries(result.stats) : [];
  const hasStats = statsEntries.length > 0;

  return (
    <Surface className="rounded-[28px] p-6 shadow-inner" variant="secondary">
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
          <Table variant="secondary">
            <Table.ScrollContainer className="max-h-56">
              <Table.Content
                aria-label="Conteo por tabla del último backup"
                className="min-w-[360px]"
              >
                <Table.Header>
                  <Table.Column isRowHeader>Tabla</Table.Column>
                  <Table.Column className="text-right">Registros</Table.Column>
                </Table.Header>
                <Table.Body>
                  {statsEntries
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([tableName, stat]) => (
                      <Table.Row id={tableName} key={tableName}>
                        <Table.Cell>{tableName}</Table.Cell>
                        <Table.Cell className="text-right">{stat.count}</Table.Cell>
                      </Table.Row>
                    ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-default-200 bg-background p-3 text-default-500 text-sm">
          No hay estadísticas por tabla disponibles para este backup.
        </div>
      )}
    </Surface>
  );
}

function BackupSummaryCards({
  fullBackupsLength,
  latestBackupCreatedTime,
  totalSize,
}: {
  fullBackupsLength: number;
  latestBackupCreatedTime: Date | undefined;
  totalSize: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        color="primary"
        icon={<HardDrive className="size-5 text-primary" />}
        label="Backups"
        value={String(fullBackupsLength)}
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
  const [isBackupStarting, setIsBackupStarting] = useState(false);
  const { lastCompletedBackupResult, liveJobs } = useBackupProgress(refreshBackups);

  // Queries
  const { data: backups } = useSuspenseQuery({ ...backupKeys.lists(), refetchInterval: 30_000 });

  // Mutations
  const backupMutation = useMutation({
    mutationFn: triggerBackup,
    onMutate: () => {
      setIsBackupStarting(true);
    },
    onError: (e) => {
      setIsBackupStarting(false);
      showError(e.message);
    },
    onSuccess: () => {
      success("Backup iniciado");
    },
    onSettled: () => {
      setIsBackupStarting(false);
    },
  });

  // Computed
  const currentBackup = liveJobs.backup;
  const currentRestore = liveJobs.restore;
  const isRunning = isJobActive(currentBackup?.status) || isJobActive(currentRestore?.status);

  // Keep only full backups in this view
  const fullBackups = backups.filter((b) => !b.name.startsWith("audit_"));

  const totalSize = backups.reduce((acc, b) => {
    const sizeStr = b.size ?? "0";
    return acc + Number.parseInt(sizeStr, 10);
  }, 0);

  const renderBackupListContent = () => {
    if (fullBackups.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
          <HardDrive className="size-6 text-default-400" />
          <p className="font-medium text-default-700 text-sm">No hay backups disponibles</p>
          <Description className="max-w-sm text-xs">
            Cuando ejecutes un backup, aparecerá aquí con opciones de descarga y restauración.
          </Description>
        </div>
      );
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
      <RunningJobProgressCard
        currentBackup={currentBackup}
        currentRestore={currentRestore}
        isBackupStarting={isBackupStarting}
      />

      {/* Google Drive Connection */}
      <GoogleDriveConnect />

      <LastCompletedBackupCard result={lastCompletedBackupResult} />

      <BackupSummaryCards
        fullBackupsLength={fullBackups.length}
        latestBackupCreatedTime={fullBackups[0]?.createdTime}
        totalSize={totalSize}
      />

      <div className="grid gap-6">
        <Surface className="overflow-hidden rounded-[28px] p-0" variant="secondary">
          <div className="flex items-center justify-between border-default-100 border-b px-5 py-4">
            <span className="font-semibold text-lg">Backups</span>
            <div className="flex items-center gap-2">
              <Button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0"
                onPress={() => void queryClient.invalidateQueries({ queryKey: ["backups"] })}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={cn("size-5")} />
              </Button>
              <Button
                className="h-9 gap-2 rounded-full px-4 font-semibold text-sm"
                isDisabled={!canCreate || isRunning || backupMutation.isPending}
                isPending={backupMutation.isPending}
                onPress={() => {
                  backupMutation.mutate();
                }}
                size="sm"
                variant="primary"
              >
                {!backupMutation.isPending &&
                  (canCreate ? <Upload className="size-4" /> : <Lock className="size-4" />)}
                Crear Backup
              </Button>
            </div>
          </div>
          <ScrollShadow
            className="max-h-125 divide-y divide-default-100/70"
            hideScrollBar
            size={56}
          >
            {renderBackupListContent()}
          </ScrollShadow>
        </Surface>
      </div>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function BackupRow({ backup, onSuccess }: { backup: BackupFile; onSuccess: () => void }) {
  const { can } = useAuth();
  const { error: showError, success } = useToast();
  const queryClient = useQueryClient();
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
    <Disclosure className="bg-transparent">
      <Disclosure.Heading>
        <Button
          className="flex h-auto min-h-16 w-full cursor-pointer items-start justify-between px-5 py-3.5 text-left hover:bg-default-50/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset"
          slot="trigger"
          type="button"
          variant="ghost"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Disclosure.Indicator className="mt-1 size-4 shrink-0 text-default-300" />
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 shrink-0 text-success" />
                <span className="truncate font-medium">{backup.name}</span>
              </div>
              <Description className="leading-5 text-default-500 text-xs">
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
      </Disclosure.Heading>

      <Disclosure.Content>
        <Disclosure.Body className="border-default-100 border-t bg-default-50/40 px-5 py-4">
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              La restauración sobrescribirá datos existentes. Puedes restaurar todo o seleccionar
              tablas específicas.
            </span>
          </div>

          <div className="mb-4 flex gap-3">
            <Button
              isDisabled={!canRestore || restoreMutation.isPending}
              isPending={restoreMutation.isPending}
              onPress={() => {
                restoreMutation.mutate(undefined);
              }}
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
                  {["a", "b", "c", "d"].map((slot) => (
                    <Skeleton
                      className="h-8 w-full rounded-md"
                      key={`backup-table-skeleton-${slot}`}
                    />
                  ))}
                </div>
              }
            >
              <BackupTablesList
                backupId={backup.id}
                canRestore={canRestore}
                isRestoring={restoreMutation.isPending}
                onRestore={restoreMutation.mutate}
              />
            </Suspense>
          </div>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
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
      {tables.length > 0 ? (
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

          <ScrollShadow className="mb-3 max-h-64" hideScrollBar size={48}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {tables.map((table) => (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-default-200 p-2 text-sm hover:bg-default-50",
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
          </ScrollShadow>
        </>
      ) : (
        <div className="mb-3 rounded-lg border border-default-200 bg-background px-4 py-6 text-center">
          <Description className="text-sm">No hay tablas en este backup.</Description>
        </div>
      )}

      {selectedTables.length > 0 && (
        <Button
          isDisabled={!canRestore || isRestoring}
          isPending={isRestoring}
          onPress={() => {
            onRestore(selectedTables);
          }}
          size="sm"
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
    <Card className="rounded-xl bg-default-50/50 p-2.5" variant="secondary">
      <Card.Content className="p-0">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", bgColors[color])}>{icon}</div>
          <div>
            <span className="block text-default-500 text-sm">{label}</span>
            <span className="block font-bold text-2xl">{value}</span>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
