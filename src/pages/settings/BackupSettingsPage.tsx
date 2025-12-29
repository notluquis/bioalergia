import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  HardDrive,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Play,
  Terminal,
  Filter,
  Info,
  AlertCircle,
  Timer,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/es";

import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";

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

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  context?: Record<string, unknown>;
}

// ==================== API ====================

const fetchBackups = async (): Promise<BackupFile[]> => {
  const res = await fetch("/api/backups");
  if (!res.ok) throw new Error("Failed to fetch backups");
  return (await res.json()).backups;
};

const fetchHistory = async (): Promise<(BackupJob | RestoreJob)[]> => {
  const res = await fetch("/api/backups/history");
  if (!res.ok) throw new Error("Failed to fetch history");
  return (await res.json()).history;
};

const fetchTables = async (fileId: string): Promise<string[]> => {
  const res = await fetch(`/api/backups/${fileId}/tables`);
  if (!res.ok) throw new Error("Failed to fetch tables");
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

// ==================== HELPERS ====================

function formatBytes(bytes: number | string): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ==================== MAIN COMPONENT ====================

export default function BackupSettingsPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();

  // SSE state
  const [liveJobs, setLiveJobs] = useState<{ backup: BackupJob | null; restore: RestoreJob | null }>({
    backup: null,
    restore: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource("/api/backups/progress");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          setLiveJobs(data.jobs);
          if (data.logs) setLogs(data.logs);
        } else if (data.type === "backup") {
          setLiveJobs((prev) => ({ ...prev, backup: data.job }));
          if (data.job.status === "completed" || data.job.status === "failed") {
            queryClient.invalidateQueries({ queryKey: ["backups"] });
            queryClient.invalidateQueries({ queryKey: ["backup-history"] });
          }
        } else if (data.type === "restore") {
          setLiveJobs((prev) => ({ ...prev, restore: data.job }));
          if (data.job.status === "completed" || data.job.status === "failed") {
            queryClient.invalidateQueries({ queryKey: ["backup-history"] });
          }
        } else if (data.type === "log") {
          setLogs((prev) => [data.entry, ...prev].slice(0, 100));
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
  const historyQuery = useQuery({ queryKey: ["backup-history"], queryFn: fetchHistory });

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
  const totalSize = backups.reduce((acc, b) => acc + parseInt(b.size || "0", 10), 0);
  const avgDuration = historyQuery.data
    ?.filter((j): j is BackupJob => "result" in j && j.result?.durationMs != null)
    .reduce((acc, j, _, arr) => acc + (j.result?.durationMs || 0) / arr.length, 0);

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-6")}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="text-primary size-6" />
            <h1 className={TITLE_LG}>Backup de Base de Datos</h1>
          </div>
          <p className="text-base-content/60 text-sm">Gestiona copias de seguridad y restauraciones.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLogs(!showLogs)}>
            <Terminal className="size-4" />
            {showLogs ? "Ocultar" : "Logs"}
          </Button>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["backups"] })}
            disabled={backupsQuery.isLoading}
          >
            <RefreshCw className={cn("size-4", backupsQuery.isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="primary"
            onClick={() => backupMutation.mutate()}
            disabled={isRunning || backupMutation.isPending}
            isLoading={backupMutation.isPending}
          >
            <Upload className="size-4" />
            Crear Backup
          </Button>
        </div>
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
          label="Backups guardados"
          value={String(backups.length)}
          color="primary"
        />
        <StatCard
          icon={<Database className="text-info size-5" />}
          label="Almacenamiento total"
          value={formatBytes(totalSize)}
          color="info"
        />
        <StatCard
          icon={<Clock className="text-success size-5" />}
          label="Último backup"
          value={backups[0] ? dayjs(backups[0].createdTime).fromNow() : "-"}
          color="success"
        />
        <StatCard
          icon={<Timer className="text-warning size-5" />}
          label="Duración promedio"
          value={avgDuration ? formatDuration(avgDuration) : "-"}
          color="warning"
        />
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div className="bg-base-100 rounded-xl border">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Terminal className="size-4" /> Logs en vivo
            </h2>
            <span className="text-base-content/40 text-xs">{logs.length} entradas</span>
          </div>
          <div className="bg-base-900 max-h-64 overflow-y-auto p-4 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-base-content/40 text-center">Sin logs recientes</div>
            ) : (
              logs.map((log) => <LogLine key={log.id} log={log} />)
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Backups List */}
      <div className="bg-base-100 rounded-xl border">
        <div className="border-b p-4">
          <h2 className="font-semibold">Backups disponibles</h2>
        </div>
        <div className="divide-y">
          {backupsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary size-6 animate-spin" />
            </div>
          ) : backupsQuery.error ? (
            <div className="text-error py-12 text-center">Error al cargar backups</div>
          ) : backups.length === 0 ? (
            <div className="text-base-content/60 py-12 text-center">No hay backups disponibles</div>
          ) : (
            backups.map((backup) => (
              <BackupRow
                key={backup.id}
                backup={backup}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["backup-history"] })}
              />
            ))
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-base-100 rounded-xl border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Historial de operaciones</h2>
          <div className="flex items-center gap-2">
            <Filter className="text-base-content/40 size-4" />
            <span className="text-base-content/40 text-sm">Últimas {historyQuery.data?.length || 0}</span>
          </div>
        </div>
        <div className="divide-y">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-primary size-5 animate-spin" />
            </div>
          ) : historyQuery.data?.length === 0 ? (
            <div className="text-base-content/60 py-8 text-center text-sm">Sin operaciones</div>
          ) : (
            historyQuery.data?.slice(0, 15).map((job) => <HistoryRow key={job.id} job={job} />)
          )}
        </div>
      </div>
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
  return (
    <div className="bg-base-100 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", `bg-${color}/10`)}>{icon}</div>
        <div>
          <p className="text-base-content/60 text-sm">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LogLine({ log }: { log: LogEntry }) {
  const iconMap = {
    info: <Info className="size-3 text-blue-400" />,
    warn: <AlertTriangle className="size-3 text-yellow-400" />,
    error: <AlertCircle className="size-3 text-red-400" />,
    success: <CheckCircle className="size-3 text-green-400" />,
  };
  const time = dayjs(log.timestamp).format("HH:mm:ss");
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-base-content/40 shrink-0">{time}</span>
      {iconMap[log.level]}
      <span className={cn(log.level === "error" && "text-red-400", log.level === "success" && "text-green-400")}>
        {log.message}
      </span>
    </div>
  );
}

function BackupRow({ backup, onSuccess }: { backup: BackupFile; onSuccess: () => void }) {
  const { success, error: showError } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const tablesQuery = useQuery({
    queryKey: ["backup-tables", backup.id],
    queryFn: () => fetchTables(backup.id),
    enabled: isExpanded,
  });

  const restoreMutation = useMutation({
    mutationFn: (tables?: string[]) => triggerRestore(backup.id, tables),
    onSuccess: () => {
      success("Restauración iniciada");
      onSuccess();
    },
    onError: (e) => showError(e.message),
  });

  const toggleTable = (table: string) =>
    setSelectedTables((prev) => (prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]));

  return (
    <div>
      <div
        className="hover:bg-base-50 flex cursor-pointer items-center justify-between p-4 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {isExpanded ? (
            <ChevronDown className="text-base-content/40 size-4" />
          ) : (
            <ChevronRight className="text-base-content/40 size-4" />
          )}
          <div>
            <p className="font-medium">{backup.name}</p>
            <p className="text-base-content/60 text-sm">
              {dayjs(backup.createdTime).format("DD MMM YYYY, HH:mm")} • {formatBytes(backup.size)}
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
        <div className="bg-base-50 border-t px-6 py-4">
          <div className="bg-warning/10 text-warning mb-4 flex items-start gap-2 rounded-lg p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>La restauración sobrescribirá datos existentes.</span>
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => restoreMutation.mutate(undefined)}
              disabled={restoreMutation.isPending}
            >
              <RotateCcw className="size-4" />
              Restaurar todo
            </Button>
          </div>

          <div className="bg-base-100 rounded-lg border p-4">
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
                  {tablesQuery.data?.map((table) => (
                    <label
                      key={table}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors",
                        selectedTables.includes(table) ? "border-primary bg-primary/5" : "hover:bg-base-200"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={selectedTables.includes(table)}
                        onChange={() => toggleTable(table)}
                      />
                      <span className="truncate">{table}</span>
                    </label>
                  ))}
                </div>

                {selectedTables.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => restoreMutation.mutate(selectedTables)}
                    disabled={restoreMutation.isPending}
                  >
                    <Play className="size-4" />
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

function HistoryRow({ job }: { job: BackupJob | RestoreJob }) {
  const isBackup = "type" in job;
  const isSuccess = job.status === "completed";
  const isFailed = job.status === "failed";

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        {job.status === "running" ? (
          <Loader2 className="text-primary size-5 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle className="text-success size-5" />
        ) : isFailed ? (
          <XCircle className="text-error size-5" />
        ) : (
          <Clock className="text-base-content/40 size-5" />
        )}
        <div>
          <p className="font-medium">
            {isBackup ? "Backup" : "Restauración"}
            {!isBackup && (job as RestoreJob).tables && (
              <span className="text-base-content/60 ml-1 text-sm">({(job as RestoreJob).tables?.length} tablas)</span>
            )}
          </p>
          <p className="text-base-content/60 text-sm">
            {dayjs(job.startedAt).format("DD MMM, HH:mm")}
            {job.completedAt &&
              ` • ${((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>
      <div className="text-right">
        {isSuccess && isBackup && (job as BackupJob).result && (
          <span className="text-base-content/60 text-sm">{formatBytes((job as BackupJob).result!.sizeBytes)}</span>
        )}
        {isFailed && <span className="text-error text-sm">Error</span>}
      </div>
    </div>
  );
}
