import {
  Alert,
  AlertDialog,
  Breadcrumbs,
  Button,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Pagination,
  Select,
  Separator,
  Spinner,
  Surface,
  Tooltip,
  TextField,
  ProgressBar,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import {
  Check,
  ChevronRight,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Home,
  RefreshCw,
  RotateCw,
  ScanLine,
  ServerCog,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildPaginationItems } from "@/components/pagination/pagination-items";
import { useToast } from "@/context/ToastContext";
import {
  useActiveClinicalSkinTestJob,
  useArchiveSkinTestWorkbookSnapshots,
  useApproveSkinTestImport,
  useConfigureOneDriveFolder,
  useOneDriveSkinTestStatus,
  useOneDriveFolderChildren,
  useProcessDiscoveredSkinTestImports,
  useProcessSkinTestImports,
  useOneDriveFolderPreview,
  useRejectSkinTestImport,
  useRenewOneDriveSubscription,
  useReprocessSkinTestImport,
  useSkinTestImports,
  useSyncSkinTestImports,
  useGetOneDriveAuthUrl,
  useConnectOneDrive,
  useCancelClinicalSkinTestJob,
  useDisconnectOneDrive,
  useClinicalSkinTestJobStatus,
  type SkinTestImportFilters,
} from "./skin-tests-queries";
import type {
  OneDriveFolderItem,
  SkinTestImport,
  SkinTestImportStatus,
  SkinTestResult,
} from "./skin-tests-types";

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: "ALL" | SkinTestImportStatus }> = [
  { label: "Todos", value: "ALL" },
  { label: "Descubiertos", value: "DISCOVERED" },
  { label: "Pendientes", value: "PENDING_REVIEW" },
  { label: "Importados", value: "IMPORTED" },
  { label: "Con error", value: "ERROR" },
  { label: "Rechazados", value: "REJECTED" },
  { label: "Omitidos", value: "SKIPPED" },
];

const STATUS_LABELS: Record<SkinTestImportStatus, string> = {
  DISCOVERED: "Descubierto",
  ERROR: "Error",
  IMPORTED: "Importado",
  PENDING_REVIEW: "Pendiente",
  REJECTED: "Rechazado",
  SKIPPED: "Omitido",
};

const STATUS_COLORS: Record<SkinTestImportStatus, "danger" | "default" | "success" | "warning"> = {
  DISCOVERED: "default",
  ERROR: "danger",
  IMPORTED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
  SKIPPED: "default",
};

const ARCHIVE_LIMIT_OPTIONS = [
  { label: "50 archivos", value: 50 },
  { label: "100 archivos", value: 100 },
  { label: "500 archivos", value: 500 },
  { label: "1000 archivos", value: 1000 },
  { label: "5000 archivos", value: 5000 },
];

const SNAPSHOT_STATUS_LABELS = {
  ARCHIVED: "archivado",
  ERROR: "error",
  MISSING: "pendiente",
  STALE: "desactualizado",
} as const;

const IMPORTS_PAGE_SIZE = 20;

interface SkinTestSyncJobMeta {
  accountEmail?: string;
  accountIndex?: number;
  accountsTotal?: number;
  discovered?: number;
  documents?: number;
  documentsMatched?: number;
  documentsUnmatched?: number;
  downloadedBytes?: number;
  dryRun?: boolean;
  elapsedSeconds?: number;
  errors?: number;
  etaSeconds?: number | null;
  failed?: number;
  filesProcessed?: number;
  filesTotal?: number;
  filename?: string;
  imported?: number;
  page?: number;
  pending?: number;
  phase?:
    | "archiving"
    | "completed"
    | "delta"
    | "discovered-processing"
    | "processing"
    | "scanned"
    | "starting";
  scanned?: number;
  skipped?: number;
  unchanged?: number;
  xlsx?: number;
  archived?: number;
}

const SYNC_PHASE_LABELS: Record<NonNullable<SkinTestSyncJobMeta["phase"]>, string> = {
  completed: "Completado",
  archiving: "Archivando XLSX",
  delta: "Leyendo OneDrive",
  "discovered-processing": "Procesando descubiertos",
  processing: "Procesando xlsx",
  scanned: "Cambios leídos",
  starting: "Preparando",
};

function getSyncJobMeta(meta: unknown): SkinTestSyncJobMeta {
  if (!meta || typeof meta !== "object") return {};
  const value = meta as Record<string, unknown>;
  return {
    accountEmail: typeof value.accountEmail === "string" ? value.accountEmail : undefined,
    accountIndex: typeof value.accountIndex === "number" ? value.accountIndex : undefined,
    accountsTotal: typeof value.accountsTotal === "number" ? value.accountsTotal : undefined,
    discovered: typeof value.discovered === "number" ? value.discovered : undefined,
    documents: typeof value.documents === "number" ? value.documents : undefined,
    documentsMatched:
      typeof value.documentsMatched === "number" ? value.documentsMatched : undefined,
    documentsUnmatched:
      typeof value.documentsUnmatched === "number" ? value.documentsUnmatched : undefined,
    downloadedBytes: typeof value.downloadedBytes === "number" ? value.downloadedBytes : undefined,
    dryRun: typeof value.dryRun === "boolean" ? value.dryRun : undefined,
    elapsedSeconds: typeof value.elapsedSeconds === "number" ? value.elapsedSeconds : undefined,
    errors: typeof value.errors === "number" ? value.errors : undefined,
    etaSeconds:
      typeof value.etaSeconds === "number"
        ? value.etaSeconds
        : value.etaSeconds === null
          ? null
          : undefined,
    failed: typeof value.failed === "number" ? value.failed : undefined,
    filesProcessed: typeof value.filesProcessed === "number" ? value.filesProcessed : undefined,
    filesTotal: typeof value.filesTotal === "number" ? value.filesTotal : undefined,
    filename: typeof value.filename === "string" ? value.filename : undefined,
    imported: typeof value.imported === "number" ? value.imported : undefined,
    page: typeof value.page === "number" ? value.page : undefined,
    pending: typeof value.pending === "number" ? value.pending : undefined,
    phase: isSyncPhase(value.phase) ? value.phase : undefined,
    scanned: typeof value.scanned === "number" ? value.scanned : undefined,
    skipped: typeof value.skipped === "number" ? value.skipped : undefined,
    unchanged: typeof value.unchanged === "number" ? value.unchanged : undefined,
    xlsx: typeof value.xlsx === "number" ? value.xlsx : undefined,
    archived: typeof value.archived === "number" ? value.archived : undefined,
  };
}

function isSyncPhase(value: unknown): value is NonNullable<SkinTestSyncJobMeta["phase"]> {
  return (
    value === "completed" ||
    value === "archiving" ||
    value === "delta" ||
    value === "discovered-processing" ||
    value === "processing" ||
    value === "scanned" ||
    value === "starting"
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "calculando";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function SkinTestImportPanel() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SkinTestImportStatus | undefined>("DISCOVERED");
  const [importsPage, setImportsPage] = useState(1);
  const [archiveLimit, setArchiveLimit] = useState(100);
  const [isRereadAllOpen, setIsRereadAllOpen] = useState(false);
  const [selectedImportIds, setSelectedImportIds] = useState<Record<string, boolean>>({});
  const filters: SkinTestImportFilters = useMemo(
    () => ({
      page: importsPage,
      pageSize: IMPORTS_PAGE_SIZE,
      query: query.trim() || undefined,
      status,
    }),
    [importsPage, query, status]
  );
  const oneDrive = useOneDriveSkinTestStatus();
  const imports = useSkinTestImports(filters);
  const syncMutation = useSyncSkinTestImports();
  const cancelJobMutation = useCancelClinicalSkinTestJob();
  const archiveSnapshotsMutation = useArchiveSkinTestWorkbookSnapshots();
  const processDiscoveredMutation = useProcessDiscoveredSkinTestImports();
  const processSelectedMutation = useProcessSkinTestImports();
  const connectOneDrive = useConnectOneDrive();
  const authUrlQuery = useGetOneDriveAuthUrl(window.location.origin + window.location.pathname);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const handledOAuthCodeRef = useRef<string | null>(null);
  const handledTerminalJobRef = useRef<string | null>(null);
  const activeJobQuery = useActiveClinicalSkinTestJob({ enabled: !activeJobId });
  const jobStatusQuery = useClinicalSkinTestJobStatus(activeJobId);
  const runningJobId = activeJobId ?? activeJobQuery.data?.job?.id ?? null;
  const activeJobStatus = jobStatusQuery.data?.job?.status;
  const knownActiveJobStatus = activeJobStatus ?? activeJobQuery.data?.job?.status;
  const isSyncInProgress =
    syncMutation.isPending ||
    knownActiveJobStatus === "pending" ||
    knownActiveJobStatus === "running";
  const currentJob = jobStatusQuery.data?.job ?? null;
  const syncMeta = getSyncJobMeta(currentJob?.meta);
  const hasFileProgress =
    typeof syncMeta.filesTotal === "number" &&
    syncMeta.filesTotal > 0 &&
    typeof syncMeta.filesProcessed === "number";
  const isUnknownProgress =
    currentJob?.status === "running" &&
    !hasFileProgress &&
    (syncMeta.phase === "starting" || syncMeta.phase === "delta" || syncMeta.phase === "scanned");
  const progressValue = hasFileProgress
    ? (syncMeta.filesProcessed ?? 0)
    : (currentJob?.progress ?? 0);
  const progressMaxValue = hasFileProgress ? (syncMeta.filesTotal ?? 1) : currentJob?.total || 1;
  const progressRatioLabel = hasFileProgress
    ? `${syncMeta.filesProcessed ?? 0} / ${syncMeta.filesTotal}`
    : !isUnknownProgress && currentJob && currentJob.total > 0
      ? `${currentJob.progress} / ${currentJob.total}`
      : null;
  const selectedIds = useMemo(
    () =>
      Object.entries(selectedImportIds)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [selectedImportIds]
  );
  const importsTotal = imports.data?.total ?? 0;
  const importsTotalPages = Math.max(1, Math.ceil(importsTotal / IMPORTS_PAGE_SIZE));
  const importsPageItems = buildPaginationItems({
    currentPage: importsPage,
    totalPages: importsTotalPages,
  });
  const visibleStart = importsTotal === 0 ? 0 : (importsPage - 1) * IMPORTS_PAGE_SIZE + 1;
  const visibleEnd = Math.min(importsTotal, importsPage * IMPORTS_PAGE_SIZE);
  const visibleDiscoveredItems =
    imports.data?.items.filter((item) => item.status === "DISCOVERED") ?? [];
  const allVisibleDiscoveredSelected =
    visibleDiscoveredItems.length > 0 &&
    visibleDiscoveredItems.every((item) => selectedImportIds[item.id]);
  const canProcessAllDiscovered = status === "DISCOVERED" && importsTotal > 0;

  useEffect(() => {
    const initialJobId = activeJobQuery.data?.job?.id;
    if (initialJobId && !activeJobId) {
      setActiveJobId(initialJobId);
    }
  }, [activeJobId, activeJobQuery.data?.job?.id]);

  // Clear activeJobId when job expired/not found (404)
  useEffect(() => {
    if (!activeJobId || !jobStatusQuery.isError) return;
    const err = jobStatusQuery.error;
    const is404 = err && typeof err === "object" && "status" in err && err.status === 404;
    if (is404) {
      setActiveJobId(null);
    }
  }, [activeJobId, jobStatusQuery.isError, jobStatusQuery.error]);

  useEffect(() => {
    if (!activeJobId || !currentJob) return;
    if (!["completed", "failed", "cancelled"].includes(currentJob.status)) return;
    if (handledTerminalJobRef.current === activeJobId) return;

    handledTerminalJobRef.current = activeJobId;
    void imports.refetch();
    void oneDrive.refetch();

    // Notify user when job finishes
    const meta = getSyncJobMeta(currentJob.meta);
    if (currentJob.status === "completed") {
      toast.success(`Sincronización completada — ${meta.filesProcessed ?? 0} archivos procesados`);
    } else if (currentJob.status === "failed") {
      toast.error(currentJob.message ?? "La sincronización falló");
    } else if (currentJob.status === "cancelled") {
      toast.info("Sincronización cancelada");
    }
  }, [activeJobId, currentJob, imports, oneDrive, toast]);

  useEffect(() => {
    setSelectedImportIds({});
    setImportsPage(1);
  }, [query, status]);

  useEffect(() => {
    if (importsTotal > 0 && importsPage > importsTotalPages) {
      setImportsPage(importsTotalPages);
    }
  }, [importsPage, importsTotal, importsTotalPages]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (
      code &&
      handledOAuthCodeRef.current !== code &&
      !oneDrive.isLoading &&
      !connectOneDrive.isPending
    ) {
      handledOAuthCodeRef.current = code;
      url.searchParams.delete("code");
      url.searchParams.delete("session_state");
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

      void connectOneDrive
        .mutateAsync({
          code,
          redirectUri: window.location.origin + window.location.pathname,
        })
        .then(() => {
          toast.success("OneDrive conectado exitosamente");
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "Error al conectar OneDrive");
        });
    }
  }, [oneDrive.isLoading, connectOneDrive, toast]);

  async function handleConnect() {
    try {
      const res = await authUrlQuery.refetch();
      if (res.error) throw res.error;
      if (!res.data) throw new Error("No se obtuvo la URL de autenticación");
      window.location.href = res.data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al obtener URL de auth");
    }
  }

  async function handleSync(
    force = false,
    params?: {
      accountId?: string;
      folderDriveId?: null | string;
      folderItemId?: null | string;
      folderPath?: string;
    }
  ) {
    try {
      const result = await syncMutation.mutateAsync({ ...params, force });
      setActiveJobId(result.jobId);
      toast.success(`Sincronización iniciada`, "Sincronización");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar sync");
    }
  }

  async function handleCancelSync() {
    if (!runningJobId) return;
    try {
      const result = await cancelJobMutation.mutateAsync(runningJobId);
      if (result.cancelled) {
        toast.success("Sincronización detenida");
      } else {
        toast.info("El job ya no estaba en ejecución");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo detener sync");
    }
  }

  async function handleProcessSelected() {
    if (selectedIds.length === 0) return;
    try {
      const result = await processSelectedMutation.mutateAsync(selectedIds);
      setSelectedImportIds({});
      if (result.errors.length > 0) {
        toast.info(
          `${result.items.length} procesado(s), ${result.errors.length} con error`,
          "Procesamiento parcial"
        );
      } else {
        toast.success(`${result.items.length} archivo(s) procesado(s)`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron procesar archivos");
    }
  }

  async function handleProcessAllDiscovered() {
    if (!canProcessAllDiscovered) return;
    try {
      const result = await processDiscoveredMutation.mutateAsync({
        query: query.trim() || undefined,
      });
      setActiveJobId(result.jobId);
      setSelectedImportIds({});
      toast.success("Procesamiento de descubiertos iniciado", "Tests cutáneos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar procesamiento");
    }
  }

  async function handleArchiveSnapshots() {
    try {
      const result = await archiveSnapshotsMutation.mutateAsync({
        importStatus: status,
        limit: archiveLimit,
        query: query.trim() || undefined,
      });
      setActiveJobId(result.jobId);
      toast.success("Archivado de XLSX iniciado", "Tests cutáneos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar archivado");
    }
  }

  return (
    <div className="space-y-4">
      <Surface className="rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Importación tests cutáneos</h2>
            <p className="text-sm text-foreground-500">
              {oneDrive.data?.accounts.length ?? 0} cuenta(s) conectada(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onPress={() => void handleCancelSync()}
              isDisabled={
                !runningJobId || !["pending", "running"].includes(knownActiveJobStatus ?? "")
              }
              isPending={cancelJobMutation.isPending}
            >
              <X size={14} />
              Parar sincronización
            </Button>
          </div>
        </div>

        {oneDrive.data?.connected && (
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <div className="flex min-h-36 flex-col justify-between rounded-lg bg-content2 p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Chip size="sm" color="accent" variant="soft">
                    1
                  </Chip>
                  <h3 className="text-sm font-semibold">Escanear OneDrive</h3>
                </div>
                <p className="text-xs text-foreground-500">
                  Registra metadata de todos los .xlsx permitidos. No descarga el archivo ni
                  clasifica.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void handleSync(false)}
                  isDisabled={!oneDrive.data?.connected || isSyncInProgress}
                >
                  <RefreshCw size={14} />
                  Sincronizar cambios
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setIsRereadAllOpen(true)}
                  isDisabled={!oneDrive.data?.connected || isSyncInProgress}
                >
                  <RotateCw size={14} />
                  Releer todo
                </Button>
              </div>
            </div>

            <div className="flex min-h-36 flex-col justify-between rounded-lg bg-content2 p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Chip size="sm" color="accent" variant="soft">
                    2
                  </Chip>
                  <h3 className="text-sm font-semibold">Guardar XLSX en DB</h3>
                </div>
                <p className="text-xs text-foreground-500">
                  Descarga desde Railway y guarda la primera hoja estructurada de los archivos del
                  filtro actual.
                </p>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select
                  value={String(archiveLimit)}
                  onChange={(key) => {
                    const nextLimit = Number(key);
                    if (Number.isFinite(nextLimit)) setArchiveLimit(nextLimit);
                  }}
                  variant="secondary"
                  className="sm:w-40"
                >
                  <Label>Lote</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {ARCHIVE_LIMIT_OPTIONS.map((option) => (
                        <ListBox.Item
                          key={option.value}
                          id={String(option.value)}
                          textValue={option.label}
                        >
                          {option.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void handleArchiveSnapshots()}
                  isDisabled={isSyncInProgress || imports.isFetching}
                  isPending={archiveSnapshotsMutation.isPending}
                >
                  <ScanLine size={14} />
                  Archivar filtrados
                </Button>
              </div>
            </div>

            <div className="flex min-h-36 flex-col justify-between rounded-lg bg-content2 p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Chip size="sm" color="accent" variant="soft">
                    3
                  </Chip>
                  <h3 className="text-sm font-semibold">Clasificar y procesar</h3>
                </div>
                <p className="text-xs text-foreground-500">
                  Interpreta los descubiertos del filtro actual después de guardar los XLSX.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void handleProcessAllDiscovered()}
                  isDisabled={!canProcessAllDiscovered || isSyncInProgress || imports.isFetching}
                  isPending={processDiscoveredMutation.isPending}
                >
                  <ServerCog size={14} />
                  Procesar descubiertos
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeJobId && currentJob && (
          <div className="mt-4">
            <ProgressBar
              aria-label="Progreso de sincronización"
              className="w-full"
              color={
                currentJob.status === "failed"
                  ? "danger"
                  : currentJob.status === "cancelled"
                    ? "warning"
                    : currentJob.status === "completed"
                      ? "success"
                      : "accent"
              }
              isIndeterminate={isUnknownProgress}
              value={progressValue}
              maxValue={progressMaxValue}
            >
              <div className="flex justify-between">
                <Label>{currentJob.message || "Sincronizando..."}</Label>
                {progressRatioLabel && (
                  <span className="text-xs text-foreground-500">{progressRatioLabel}</span>
                )}
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground-500">
              {syncMeta.phase && (
                <Chip size="sm" variant="soft" color="accent">
                  {SYNC_PHASE_LABELS[syncMeta.phase]}
                </Chip>
              )}
              {syncMeta.accountEmail && <span>Cuenta: {syncMeta.accountEmail}</span>}
              {syncMeta.accountsTotal != null && (
                <span>
                  Cuentas:{" "}
                  {syncMeta.accountIndex ??
                    (syncMeta.phase === "processing" || syncMeta.phase === "completed"
                      ? syncMeta.accountsTotal
                      : 0)}
                  /{syncMeta.accountsTotal}
                </span>
              )}
              {syncMeta.filesTotal != null && syncMeta.filesTotal > 0 && (
                <span>
                  Archivos: {syncMeta.filesProcessed ?? 0}/{syncMeta.filesTotal}
                </span>
              )}
              {syncMeta.page != null && <span>Lote Graph: {syncMeta.page}</span>}
              {syncMeta.scanned != null && <span>Items OneDrive: {syncMeta.scanned}</span>}
              {syncMeta.xlsx != null && <span>XLSX: {syncMeta.xlsx}</span>}
              {syncMeta.archived != null && <span>Snapshots: {syncMeta.archived}</span>}
              {syncMeta.downloadedBytes != null && (
                <span>Descargado: {formatBytes(syncMeta.downloadedBytes)}</span>
              )}
              {syncMeta.documents != null && (
                <span>
                  Docs {syncMeta.documents} · Vinculados {syncMeta.documentsMatched ?? 0} · Sin
                  match {syncMeta.documentsUnmatched ?? 0}
                </span>
              )}
              {currentJob.status === "running" &&
                syncMeta.phase &&
                syncMeta.phase !== "completed" &&
                typeof syncMeta.etaSeconds === "number" && (
                  <span>ETA est.: {formatDuration(syncMeta.etaSeconds)}</span>
                )}
              {syncMeta.filename && (
                <span className="min-w-0 truncate">Archivo: {syncMeta.filename}</span>
              )}
              {(syncMeta.imported != null ||
                syncMeta.pending != null ||
                syncMeta.errors != null ||
                syncMeta.failed != null ||
                syncMeta.skipped != null ||
                syncMeta.unchanged != null) && (
                <span>
                  Descubiertos {syncMeta.discovered ?? 0} · Importados {syncMeta.imported ?? 0} ·
                  Pendientes {syncMeta.pending ?? 0} · Errores{" "}
                  {syncMeta.errors ?? syncMeta.failed ?? 0} · Omitidos {syncMeta.skipped ?? 0} · Sin
                  cambios {syncMeta.unchanged ?? 0}
                </span>
              )}
            </div>
            {["completed", "failed", "cancelled"].includes(currentJob.status) && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="ghost" onPress={() => setActiveJobId(null)}>
                  Ocultar
                </Button>
              </div>
            )}
          </div>
        )}

        {!oneDrive.data?.connected && (
          <Alert color="warning" className="mt-3">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                Falta conectar OneDrive desde OAuth Microsoft antes de sincronizar archivos.
              </Alert.Description>
            </Alert.Content>
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onPress={() => void handleConnect()}
              isPending={authUrlQuery.isFetching || connectOneDrive.isPending}
            >
              <LinkIcon size={14} />
              Conectar OneDrive
            </Button>
          </Alert>
        )}

        {oneDrive.data?.connected && (
          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
            {oneDrive.data.accounts.map((account) => (
              <OneDriveAccountRow
                key={account.accountId}
                account={account}
                isSyncing={isSyncInProgress}
                onSync={(force, params) => void handleSync(force, params)}
              />
            ))}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onPress={() => void handleConnect()}
                isPending={authUrlQuery.isFetching || connectOneDrive.isPending}
              >
                <LinkIcon size={14} />
                Agregar otra cuenta
              </Button>
            </div>
          </div>
        )}
      </Surface>

      <Surface className="rounded-xl p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold">Cola de importación</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-500">
              <span>
                {importsTotal > 0
                  ? `Mostrando ${visibleStart}-${visibleEnd} de ${importsTotal}`
                  : "Sin resultados"}
              </span>
              <span>· Ordenado por última actualización</span>
              {status && (
                <Chip size="sm" color={STATUS_COLORS[status]} variant="soft">
                  {STATUS_LABELS[status]}
                </Chip>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px] xl:w-[640px]">
            <TextField value={query} onChange={setQuery}>
              <Label>Buscar</Label>
              <Input placeholder="Paciente, RUT o archivo" />
            </TextField>
            <Select
              value={(status as Key) ?? "ALL"}
              onChange={(key) =>
                setStatus(key === "ALL" ? undefined : (key as SkinTestImportStatus))
              }
              placeholder="Todos"
              variant="secondary"
            >
              <Label>Estado</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {STATUS_FILTER_OPTIONS.map((item) => (
                    <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                      {item.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        {(canProcessAllDiscovered || visibleDiscoveredItems.length > 0) && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg bg-content2 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {visibleDiscoveredItems.length > 0 && (
                <Checkbox
                  aria-label="Seleccionar descubiertos visibles"
                  isSelected={allVisibleDiscoveredSelected}
                  onChange={(selected) => {
                    setSelectedImportIds((prev) => {
                      const next = { ...prev };
                      for (const item of visibleDiscoveredItems) next[item.id] = selected;
                      return next;
                    });
                  }}
                  variant="secondary"
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label>Seleccionar visibles ({visibleDiscoveredItems.length})</Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
              <Chip size="sm" color={selectedIds.length > 0 ? "accent" : "default"} variant="soft">
                {selectedIds.length} seleccionado(s)
              </Chip>
              {canProcessAllDiscovered && (
                <Chip size="sm" color="warning" variant="soft">
                  {importsTotal} descubierto(s)
                </Chip>
              )}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => void handleProcessSelected()}
                isDisabled={selectedIds.length === 0 || isSyncInProgress}
                isPending={processSelectedMutation.isPending}
              >
                <FileSpreadsheet size={14} />
                Procesar seleccionados
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {imports.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : imports.data?.items.length ? (
            imports.data.items.map((item) => (
              <SkinTestImportRow
                key={item.id}
                item={item}
                isSelected={Boolean(selectedImportIds[item.id])}
                onSelectionChange={(selected) =>
                  setSelectedImportIds((prev) => ({ ...prev, [item.id]: selected }))
                }
              />
            ))
          ) : (
            <p className="py-8 text-center text-sm text-foreground-400">
              No hay importaciones para estos filtros.
            </p>
          )}
        </div>

        {importsTotal > IMPORTS_PAGE_SIZE && (
          <Pagination className="justify-center pt-4" size="sm">
            <Pagination.Summary>{`Página ${importsPage} de ${importsTotalPages}`}</Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={importsPage <= 1 || imports.isFetching}
                  onPress={() => setImportsPage((page) => Math.max(1, page - 1))}
                >
                  <Pagination.PreviousIcon />
                  <span>Anterior</span>
                </Pagination.Previous>
              </Pagination.Item>
              {importsPageItems.map((item) =>
                item.type === "ellipsis" ? (
                  <Pagination.Item key={item.key}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={item.key}>
                    <Pagination.Link
                      isActive={item.value === importsPage}
                      isDisabled={imports.isFetching}
                      onPress={() => setImportsPage(item.value ?? 1)}
                    >
                      {item.value}
                    </Pagination.Link>
                  </Pagination.Item>
                )
              )}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={importsPage >= importsTotalPages || imports.isFetching}
                  onPress={() => setImportsPage((page) => Math.min(importsTotalPages, page + 1))}
                >
                  <span>Siguiente</span>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        )}
      </Surface>
      <AlertDialog.Backdrop
        isOpen={isRereadAllOpen}
        onOpenChange={setIsRereadAllOpen}
        variant="blur"
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>Releer todo OneDrive</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              Se va a ignorar el delta guardado y se volverá a escanear la carpeta configurada de
              todas las cuentas. Este paso solo registra metadata de .xlsx; no descarga snapshots ni
              clasifica exámenes.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="ghost" onPress={() => setIsRereadAllOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  setIsRereadAllOpen(false);
                  void handleSync(true);
                }}
              >
                <RotateCw size={14} />
                Releer metadata
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}

function OneDriveAccountRow({
  account,
  isSyncing,
  onSync,
}: {
  account: {
    accountId: string;
    email: string;
    folderDriveId: string | null;
    folderItemId: string | null;
    folderName: string | null;
    name: string | null;
    folderPath: string | null;
    lastDeltaSyncAt: string | null;
    lastSyncAt: string | null;
    subscription: {
      expiresAt: string | null;
      resource: string | null;
      status: "ACTIVE" | "EXPIRED" | "MISSING";
      subscriptionId: string | null;
    };
  };
  isSyncing: boolean;
  onSync: (
    force: boolean,
    params?: {
      accountId?: string;
      folderDriveId?: null | string;
      folderItemId?: null | string;
      folderPath?: string;
    }
  ) => void;
}) {
  const toast = useToast();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const disconnect = useDisconnectOneDrive();
  const renewSubscription = useRenewOneDriveSubscription();

  async function handleDisconnect() {
    try {
      await disconnect.mutateAsync(account.accountId);
      toast.success("Cuenta desconectada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo desconectar");
    }
  }

  async function handleRenew() {
    try {
      const status = await renewSubscription.mutateAsync(account.accountId);
      const updatedAccount = status.accounts.find((item) => item.accountId === account.accountId);
      if (updatedAccount?.subscription.status === "ACTIVE") {
        toast.success("Webhook renovado");
      } else {
        toast.info("Microsoft no pudo validar el webhook. El sync manual sigue disponible.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo renovar webhook");
    }
  }

  const folderLabel = account.folderName || account.folderPath || "Raíz";
  const subscriptionColor =
    account.subscription.status === "ACTIVE"
      ? "success"
      : account.subscription.status === "EXPIRED"
        ? "warning"
        : "danger";

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-content2 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Cloud size={16} className="text-foreground-400" />
            <p className="truncate text-sm font-medium">{account.email}</p>
            <Chip size="sm" color={subscriptionColor} variant="soft">
              {account.subscription.status === "ACTIVE"
                ? "Webhook activo"
                : account.subscription.status === "EXPIRED"
                  ? "Webhook vencido"
                  : "Sin webhook"}
            </Chip>
          </div>
          <p className="text-xs text-foreground-500">
            Carpeta: <span className="font-medium text-foreground-700">{folderLabel}</span>
          </p>
          <p className="text-xs text-foreground-500">
            Última sync:{" "}
            {account.lastSyncAt ? new Date(account.lastSyncAt).toLocaleString() : "Nunca"}
            {account.subscription.expiresAt && (
              <span>
                {" "}
                · Webhook vence: {new Date(account.subscription.expiresAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <Tooltip>
            <Tooltip.Trigger>
              <Button size="sm" variant="secondary" onPress={() => setIsPickerOpen(true)}>
                <FolderOpen size={14} />
                Elegir carpeta
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Explorar carpetas de OneDrive</Tooltip.Content>
          </Tooltip>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => onSync(false, { accountId: account.accountId })}
            isDisabled={isSyncing}
          >
            <RefreshCw size={14} />
            Sync cuenta
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onSync(true, { accountId: account.accountId })}
            isDisabled={isSyncing}
          >
            <RotateCw size={14} />
            Releer cuenta
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              onSync(false, {
                accountId: account.accountId,
                folderDriveId: account.folderDriveId,
                folderItemId: account.folderItemId,
                folderPath: account.folderPath ?? "",
              })
            }
            isDisabled={isSyncing}
          >
            <Folder size={14} />
            Sync carpeta
          </Button>
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="Renovar webhook"
                size="sm"
                variant="ghost"
                onPress={() => void handleRenew()}
                isPending={renewSubscription.isPending}
              >
                <RotateCw size={14} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Renovar webhook</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="Desconectar cuenta"
                size="sm"
                variant="ghost"
                className="text-danger"
                onPress={() => void handleDisconnect()}
                isPending={disconnect.isPending}
              >
                <X size={14} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Desconectar cuenta</Tooltip.Content>
          </Tooltip>
        </div>
      </div>
      <OneDriveFolderPickerModal
        accountId={account.accountId}
        isOpen={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSync={onSync}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OneDriveFolderPickerModal({
  accountId,
  isOpen,
  onOpenChange,
  onSync,
}: {
  accountId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (
    force: boolean,
    params?: {
      accountId?: string;
      folderDriveId?: null | string;
      folderItemId?: null | string;
      folderPath?: string;
    }
  ) => void;
}) {
  const toast = useToast();
  const [stack, setStack] = useState<OneDriveFolderItem[]>([]);
  const current = stack.at(-1) ?? null;
  const children = useOneDriveFolderChildren({
    accountId,
    driveId: current?.driveId ?? null,
    enabled: isOpen,
    itemId: current?.id ?? null,
  });
  const preview = useOneDriveFolderPreview({
    accountId,
    driveId: current?.driveId ?? null,
    enabled: isOpen && !!current,
    itemId: current?.id ?? null,
  });
  const configureFolder = useConfigureOneDriveFolder();
  const folderPath = stack.map((item) => item.name).join("/");
  const selectedLabel = current?.name ?? "Raíz";

  async function handleSave(close: () => void) {
    try {
      await configureFolder.mutateAsync({
        accountId,
        driveId: current?.driveId ?? null,
        folderPath,
        itemId: current?.id ?? null,
        name: selectedLabel,
      });
      toast.success("Carpeta OneDrive actualizada");
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar carpeta");
    }
  }

  function handleSyncFolder(close: () => void) {
    if (!current) return;
    onSync(false, {
      accountId,
      folderDriveId: current.driveId,
      folderItemId: current.id,
    });
    toast.success(`Sync iniciado para "${selectedLabel}"`);
    close();
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container placement="center" scroll="inside" size="lg">
        <Modal.Dialog className="w-full max-w-3xl">
          {(renderProps) => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Elegir carpeta OneDrive</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Breadcrumbs className="text-xs">
                    <Breadcrumbs.Item>
                      <Button size="sm" variant="ghost" onPress={() => setStack([])}>
                        <Home size={14} />
                        Raíz
                      </Button>
                    </Breadcrumbs.Item>
                    {stack.map((item, index) => (
                      <Breadcrumbs.Item key={`${item.driveId ?? "me"}-${item.id}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => setStack((items) => items.slice(0, index + 1))}
                        >
                          {item.name}
                        </Button>
                      </Breadcrumbs.Item>
                    ))}
                  </Breadcrumbs>
                  <Chip
                    size="sm"
                    color={(children.data?.xlsxCount ?? 0) > 0 ? "success" : "warning"}
                    variant="soft"
                  >
                    {(children.data?.xlsxCount ?? 0) > 0
                      ? `${children.data?.xlsxCount ?? 0} xlsx aquí`
                      : "Sin xlsx aquí"}
                  </Chip>
                </div>

                {/* Recursive stats panel — only shows when a subfolder is selected */}
                {current && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-content2 px-3 py-2 text-xs text-foreground-500">
                    <ScanLine size={13} className="shrink-0 text-foreground-400" />
                    <span className="font-medium text-foreground-600">Recursivo:</span>
                    {preview.isFetching ? (
                      <span className="flex items-center gap-1.5">
                        <Spinner size="sm" />
                        Calculando...
                      </span>
                    ) : preview.data ? (
                      <>
                        <span>
                          <span className="font-semibold text-foreground-700">
                            {preview.data.totalFiles}
                          </span>{" "}
                          archivos
                        </span>
                        <span className="text-foreground-300">·</span>
                        <span>
                          <span className="font-semibold text-success">
                            {preview.data.xlsxCount}
                          </span>{" "}
                          xlsx
                        </span>
                        {preview.data.xlsxTotalBytes > 0 && (
                          <>
                            <span className="text-foreground-300">·</span>
                            <span>{formatBytes(preview.data.xlsxTotalBytes)}</span>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {children.isLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : children.data?.folders.length ? (
                  <ListBox
                    aria-label="Carpetas OneDrive"
                    className="max-h-72 overflow-y-auto"
                    selectionMode="none"
                    onAction={(key) => {
                      const folder = children.data?.folders.find(
                        (item) => `${item.driveId ?? "me"}:${item.id}` === key
                      );
                      if (folder) setStack((items) => [...items, folder]);
                    }}
                  >
                    {children.data.folders.map((folder) => (
                      <ListBox.Item
                        id={`${folder.driveId ?? "me"}:${folder.id}`}
                        key={`${folder.driveId ?? "me"}-${folder.id}`}
                        textValue={folder.name}
                      >
                        <Folder size={16} className="shrink-0 text-foreground-400" />
                        <Label className="min-w-0 flex-1 truncate">{folder.name}</Label>
                        {folder.isRemote && (
                          <Chip size="sm" color="accent" variant="soft">
                            Compartida
                          </Chip>
                        )}
                        <ChevronRight size={16} className="ml-auto shrink-0 text-foreground-400" />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                ) : (
                  <p className="rounded-lg bg-content2 px-3 py-4 text-center text-sm text-foreground-500">
                    No hay subcarpetas en esta ubicación.
                  </p>
                )}

                {/* Archivos xlsx/spreadsheet en esta carpeta */}
                {children.data && (children.data.files?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <Description className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-foreground-400">
                      <FileSpreadsheet size={12} />
                      Archivos en esta carpeta ({children.data.files!.length})
                    </Description>
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                      {children.data.files!.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 rounded-md bg-content2 px-3 py-2 text-sm"
                        >
                          <FileSpreadsheet size={14} className="shrink-0 text-success" />
                          <span className="min-w-0 flex-1 truncate text-foreground-700">
                            {file.name}
                          </span>
                          {file.size != null && (
                            <span className="shrink-0 text-xs text-foreground-400">
                              {file.size < 1024 * 1024
                                ? `${(file.size / 1024).toFixed(0)} KB`
                                : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                            </span>
                          )}
                          {file.webUrl && (
                            <Tooltip>
                              <Tooltip.Trigger>
                                <Button
                                  isIconOnly
                                  aria-label="Abrir en OneDrive"
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 text-foreground-400 hover:text-foreground"
                                  onPress={() => window.open(file.webUrl!, "_blank")}
                                >
                                  <ExternalLink size={13} />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Abrir en OneDrive</Tooltip.Content>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => renderProps.close()}>
                  Cancelar
                </Button>
                {current && (
                  <Button variant="secondary" onPress={() => handleSyncFolder(renderProps.close)}>
                    <RefreshCw size={14} />
                    Sync "{selectedLabel}"
                  </Button>
                )}
                <Button
                  onPress={() => void handleSave(renderProps.close)}
                  isPending={configureFolder.isPending}
                >
                  Guardar {selectedLabel}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function SkinTestImportRow({
  isSelected,
  item,
  onSelectionChange,
}: {
  isSelected: boolean;
  item: SkinTestImport;
  onSelectionChange: (selected: boolean) => void;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const approve = useApproveSkinTestImport();
  const reject = useRejectSkinTestImport();
  const reprocess = useReprocessSkinTestImport();
  const header = item.parsedPayload?.header;
  const resultCount = item.parsedPayload?.results.length ?? 0;

  async function runAction(action: "approve" | "reject" | "reprocess") {
    try {
      if (action === "approve") await approve.mutateAsync(item.id);
      if (action === "reject") await reject.mutateAsync(item.id);
      if (action === "reprocess") await reprocess.mutateAsync(item.id);
      toast.success("Importación actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar importación");
    }
  }

  return (
    <Surface className="rounded-lg border border-border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.status === "DISCOVERED" && (
              <Checkbox
                aria-label={`Seleccionar ${item.filename}`}
                isSelected={isSelected}
                onChange={onSelectionChange}
                variant="secondary"
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox>
            )}
            <FileSpreadsheet size={16} className="text-foreground-400" />
            <p className="truncate text-sm font-semibold">{item.filename}</p>
            <Chip size="sm" color={STATUS_COLORS[item.status]} variant="soft">
              {STATUS_LABELS[item.status]}
            </Chip>
            {item.status !== "DISCOVERED" && (
              <Chip size="sm" color={item.confidence >= 80 ? "success" : "warning"} variant="soft">
                {item.confidence}%
              </Chip>
            )}
            {item.accountEmail && (
              <Chip size="sm" color="default" variant="soft">
                {item.accountEmail}
              </Chip>
            )}
            <Tooltip>
              <Tooltip.Trigger>
                <Chip
                  size="sm"
                  color={item.workbookSnapshot.status === "ARCHIVED" ? "success" : "default"}
                  variant="soft"
                >
                  XLSX {SNAPSHOT_STATUS_LABELS[item.workbookSnapshot.status]}
                </Chip>
              </Tooltip.Trigger>
              <Tooltip.Content>
                {item.workbookSnapshot.status === "ARCHIVED"
                  ? `${item.workbookSnapshot.cellCount ?? 0} celdas · ${
                      item.workbookSnapshot.mergeCount ?? 0
                    } merges`
                  : (item.workbookSnapshot.error ?? "Snapshot pendiente")}
              </Tooltip.Content>
            </Tooltip>
          </div>
          <div className="text-xs text-foreground-500 flex items-center gap-1.5 flex-wrap mt-1">
            {header?.panelTitle && (
              <Chip size="sm" color="accent" variant="soft" className="mr-1">
                {header.panelTitle}
              </Chip>
            )}
            {header?.patientName && <span className="font-medium">{header.patientName}</span>}
            {header?.patientRut && <span>{header.patientRut}</span>}
            {header?.testDate && <span>· {header.testDate}</span>}
            {item.status === "DISCOVERED" ? (
              <>
                {item.path && <span>· {item.path}</span>}
                {item.modifiedAt && (
                  <span>· modificado {new Date(item.modifiedAt).toLocaleString()}</span>
                )}
              </>
            ) : (
              <span>· {resultCount} resultados</span>
            )}
          </div>
          {item.issues.length > 0 && (
            <p className="mt-1 text-xs text-warning">
              {item.issues.map((issue) => issue.message).join(" · ")}
            </p>
          )}
          {item.error && <p className="mt-1 text-xs text-danger">{item.error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.matchedSeriesId && (
            <Button
              onPress={() => window.open(`/clinical/series/${item.matchedSeriesId}`, "_blank")}
              size="sm"
              variant="secondary"
            >
              <LinkIcon size={14} />
              Ver Serie
            </Button>
          )}
          {item.oneDriveWebUrl && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => window.open(item.oneDriveWebUrl!, "_blank")}
            >
              <ExternalLink size={14} />
              Abrir archivo
            </Button>
          )}
          <Button size="sm" variant="ghost" onPress={() => setExpanded((value) => !value)}>
            {expanded ? "Ocultar" : "Ver"}
          </Button>
          {item.status === "PENDING_REVIEW" && (
            <>
              <Button size="sm" variant="secondary" onPress={() => void runAction("approve")}>
                <Check size={14} />
                Aprobar
              </Button>
              <Button size="sm" variant="ghost" onPress={() => void runAction("reject")}>
                <X size={14} />
                Rechazar
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={item.status === "DISCOVERED" ? "secondary" : "ghost"}
            onPress={() => void runAction("reprocess")}
          >
            <RefreshCw size={14} />
            {item.status === "DISCOVERED" ? "Procesar" : "Reprocesar"}
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <Separator className="my-3" />
          <SkinTestImportExpandedDetails item={item} />
        </>
      )}
    </Surface>
  );
}

function SkinTestImportExpandedDetails({ item }: { item: SkinTestImport }) {
  const header = item.parsedPayload?.header;
  const results = item.parsedPayload?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <SkinTestDetailField label="Archivo" value={item.filename} />
        <SkinTestDetailField label="Estado" value={STATUS_LABELS[item.status]} />
        <SkinTestDetailField label="Cuenta" value={item.accountEmail} />
        <SkinTestDetailField label="Ruta" value={item.path} />
        <SkinTestDetailField label="Modificado" value={formatOptionalDateTime(item.modifiedAt)} />
        <SkinTestDetailField label="Actualizado" value={formatOptionalDateTime(item.updatedAt)} />
        <SkinTestDetailField label="Paciente" value={header?.patientName} />
        <SkinTestDetailField label="RUT" value={header?.patientRut} />
        <SkinTestDetailField label="Fecha test" value={header?.testDate} />
        <SkinTestDetailField label="Panel" value={header?.panelTitle} />
      </div>

      {item.issues.length > 0 && (
        <div className="rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning-700">
          {item.issues.map((issue) => issue.message).join(" · ")}
        </div>
      )}

      {item.error && (
        <div className="rounded-md bg-danger/10 px-2 py-1.5 text-xs text-danger">{item.error}</div>
      )}

      {item.parsedPayload ? (
        results.length > 0 ? (
          <SkinTestResultsPreview results={results} />
        ) : (
          <p className="text-xs text-foreground-500">
            El archivo fue leído, pero no se detectaron resultados.
          </p>
        )
      ) : (
        <p className="text-xs text-foreground-500">
          Metadata registrada. Usa Procesar para descargar el Excel y extraer resultados.
        </p>
      )}
    </div>
  );
}

function SkinTestDetailField({ label, value }: { label: string; value?: null | string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <Description className="text-[11px] uppercase text-foreground-400">{label}</Description>
      <p className="truncate text-foreground-700">{value}</p>
    </div>
  );
}

function formatOptionalDateTime(value?: null | string) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

function SkinTestResultsPreview({ results }: { results: SkinTestResult[] }) {
  const grouped = results.reduce((acc, result) => {
    const rows = acc.get(result.section) ?? [];
    rows.push(result);
    acc.set(result.section, rows);
    return acc;
  }, new Map<string, SkinTestResult[]>());
  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([section, rows]) => (
        <div key={section}>
          <Description className="mb-1 text-xs font-semibold uppercase text-foreground-500">
            {section}
          </Description>
          <div className="grid gap-1">
            {rows.slice(0, 12).map((result) => (
              <div
                key={`${result.section}-${result.code ?? result.allergenName}-${result.sortOrder}`}
                className="grid grid-cols-[56px_1fr_64px_64px] gap-2 rounded-md bg-content2 px-2 py-1 text-xs"
              >
                <span className="font-mono text-danger">{result.code ?? "-"}</span>
                <span className="truncate">{result.allergenName}</span>
                <span>P {result.rawPapule ?? result.papuleMm ?? "-"}</span>
                <span>E {result.rawErythema ?? result.erythemaMm ?? "-"}</span>
              </div>
            ))}
            {rows.length > 12 && (
              <p className="text-xs text-foreground-400">+{rows.length - 12} resultados más</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
