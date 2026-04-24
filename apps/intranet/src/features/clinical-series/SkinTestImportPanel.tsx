import {
  Alert,
  Breadcrumbs,
  Button,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
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
  X,
  Link as LinkIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  useActiveClinicalSkinTestJob,
  useApproveSkinTestImport,
  useConfigureOneDriveFolder,
  useOneDriveSkinTestStatus,
  useOneDriveFolderChildren,
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

const STATUS_OPTIONS: Array<{ label: string; value: SkinTestImportStatus }> = [
  { label: "Pendientes", value: "PENDING_REVIEW" },
  { label: "Importados", value: "IMPORTED" },
  { label: "Con error", value: "ERROR" },
  { label: "Rechazados", value: "REJECTED" },
  { label: "Omitidos", value: "SKIPPED" },
];

const STATUS_LABELS: Record<SkinTestImportStatus, string> = {
  ERROR: "Error",
  IMPORTED: "Importado",
  PENDING_REVIEW: "Pendiente",
  REJECTED: "Rechazado",
  SKIPPED: "Omitido",
};

const STATUS_COLORS: Record<SkinTestImportStatus, "danger" | "default" | "success" | "warning"> = {
  ERROR: "danger",
  IMPORTED: "success",
  PENDING_REVIEW: "warning",
  REJECTED: "danger",
  SKIPPED: "default",
};

interface SkinTestSyncJobMeta {
  accountEmail?: string;
  accountIndex?: number;
  accountsTotal?: number;
  elapsedSeconds?: number;
  errors?: number;
  etaSeconds?: number | null;
  filename?: string;
  imported?: number;
  page?: number;
  pending?: number;
  phase?: "completed" | "delta" | "processing" | "scanned" | "starting";
  scanned?: number;
  skipped?: number;
  xlsx?: number;
}

const SYNC_PHASE_LABELS: Record<NonNullable<SkinTestSyncJobMeta["phase"]>, string> = {
  completed: "Completado",
  delta: "Leyendo OneDrive",
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
    elapsedSeconds: typeof value.elapsedSeconds === "number" ? value.elapsedSeconds : undefined,
    errors: typeof value.errors === "number" ? value.errors : undefined,
    etaSeconds:
      typeof value.etaSeconds === "number"
        ? value.etaSeconds
        : value.etaSeconds === null
          ? null
          : undefined,
    filename: typeof value.filename === "string" ? value.filename : undefined,
    imported: typeof value.imported === "number" ? value.imported : undefined,
    page: typeof value.page === "number" ? value.page : undefined,
    pending: typeof value.pending === "number" ? value.pending : undefined,
    phase: isSyncPhase(value.phase) ? value.phase : undefined,
    scanned: typeof value.scanned === "number" ? value.scanned : undefined,
    skipped: typeof value.skipped === "number" ? value.skipped : undefined,
    xlsx: typeof value.xlsx === "number" ? value.xlsx : undefined,
  };
}

function isSyncPhase(value: unknown): value is NonNullable<SkinTestSyncJobMeta["phase"]> {
  return (
    value === "completed" ||
    value === "delta" ||
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
  const [status, setStatus] = useState<SkinTestImportStatus | undefined>("PENDING_REVIEW");
  const filters: SkinTestImportFilters = useMemo(
    () => ({
      page: 1,
      pageSize: 20,
      query: query.trim() || undefined,
      status,
    }),
    [query, status]
  );
  const oneDrive = useOneDriveSkinTestStatus();
  const imports = useSkinTestImports(filters);
  const syncMutation = useSyncSkinTestImports();
  const cancelJobMutation = useCancelClinicalSkinTestJob();
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

  useEffect(() => {
    const initialJobId = activeJobQuery.data?.job?.id;
    if (initialJobId && !activeJobId) {
      setActiveJobId(initialJobId);
    }
  }, [activeJobId, activeJobQuery.data?.job?.id]);

  useEffect(() => {
    if (!activeJobId || !currentJob) return;
    if (!["completed", "failed", "cancelled"].includes(currentJob.status)) return;
    if (handledTerminalJobRef.current === activeJobId) return;

    handledTerminalJobRef.current = activeJobId;
    void imports.refetch();
    void oneDrive.refetch();
  }, [activeJobId, currentJob, imports, oneDrive]);

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

  return (
    <div className="space-y-4">
      <Surface className="rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Importación tests cutáneos</h2>
            <p className="text-sm text-foreground-500">
              {oneDrive.data?.accounts.length ?? 0} cuenta(s) conectada(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void handleSync(false)}
              isDisabled={!oneDrive.data?.connected || isSyncInProgress}
            >
              <RefreshCw size={14} />
              Sincronizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void handleSync(true)}
              isDisabled={!oneDrive.data?.connected || isSyncInProgress}
            >
              Releer todo
            </Button>
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
              value={currentJob.progress}
              maxValue={currentJob.total || 1}
            >
              <div className="flex justify-between">
                <Label>{currentJob.message || "Sincronizando..."}</Label>
                {currentJob.total > 0 && (
                  <span className="text-xs text-foreground-500">
                    {currentJob.progress} / {currentJob.total}
                  </span>
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
                  Cuentas: {syncMeta.accountIndex ?? currentJob.progress}/{syncMeta.accountsTotal}
                </span>
              )}
              {syncMeta.page != null && <span>Página delta: {syncMeta.page}</span>}
              {syncMeta.scanned != null && <span>Items leídos: {syncMeta.scanned}</span>}
              {syncMeta.xlsx != null && <span>XLSX: {syncMeta.xlsx}</span>}
              {currentJob.status === "running" &&
                syncMeta.phase &&
                syncMeta.phase !== "completed" && (
                  <span>
                    ETA est.:{" "}
                    {typeof syncMeta.etaSeconds === "number"
                      ? formatDuration(syncMeta.etaSeconds)
                      : "calculando"}
                  </span>
                )}
              {syncMeta.filename && (
                <span className="min-w-0 truncate">Archivo: {syncMeta.filename}</span>
              )}
              {(syncMeta.imported != null ||
                syncMeta.pending != null ||
                syncMeta.errors != null ||
                syncMeta.skipped != null) && (
                <span>
                  Importados {syncMeta.imported ?? 0} · Pendientes {syncMeta.pending ?? 0} · Errores{" "}
                  {syncMeta.errors ?? 0} · Omitidos {syncMeta.skipped ?? 0}
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
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <TextField value={query} onChange={setQuery}>
            <Label>Buscar</Label>
            <Input placeholder="Paciente, RUT o archivo" />
          </TextField>
          <Select
            value={(status as Key) ?? null}
            onChange={(key) => setStatus((key as SkinTestImportStatus | null) ?? undefined)}
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
                {STATUS_OPTIONS.map((item) => (
                  <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                    {item.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="mt-4 space-y-3">
          {imports.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : imports.data?.items.length ? (
            imports.data.items.map((item) => <SkinTestImportRow key={item.id} item={item} />)
          ) : (
            <p className="py-8 text-center text-sm text-foreground-400">
              No hay importaciones para estos filtros.
            </p>
          )}
        </div>
      </Surface>
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
  const configureFolder = useConfigureOneDriveFolder();
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

  async function handleUseRoot() {
    try {
      await configureFolder.mutateAsync({
        accountId: account.accountId,
        driveId: null,
        folderPath: "",
        itemId: null,
        name: "Raíz",
      });
      toast.success("Carpeta OneDrive actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar carpeta");
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
        <div className="flex flex-wrap gap-2">
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
            variant="ghost"
            onPress={() => void handleUseRoot()}
            isPending={configureFolder.isPending}
          >
            <Home size={14} />
            Usar raíz
          </Button>
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
          <Button
            size="sm"
            variant="ghost"
            onPress={() => void handleRenew()}
            isPending={renewSubscription.isPending}
          >
            <RotateCw size={14} />
            Renovar webhook
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onPress={() => void handleDisconnect()}
            isPending={disconnect.isPending}
          >
            Desconectar
          </Button>
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
                            <button
                              type="button"
                              className="shrink-0 text-foreground-400 transition-colors hover:text-foreground"
                              onClick={() => window.open(file.webUrl!, "_blank")}
                              title="Abrir en OneDrive"
                            >
                              <ExternalLink size={13} />
                            </button>
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

function SkinTestImportRow({ item }: { item: SkinTestImport }) {
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
            <FileSpreadsheet size={16} className="text-foreground-400" />
            <p className="truncate text-sm font-semibold">{item.filename}</p>
            <Chip size="sm" color={STATUS_COLORS[item.status]} variant="soft">
              {STATUS_LABELS[item.status]}
            </Chip>
            <Chip size="sm" color={item.confidence >= 80 ? "success" : "warning"} variant="soft">
              {item.confidence}%
            </Chip>
            {item.accountEmail && (
              <Chip size="sm" color="default" variant="soft">
                {item.accountEmail}
              </Chip>
            )}
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
            <span>· {resultCount} resultados</span>
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
          <Button size="sm" variant="ghost" onPress={() => void runAction("reprocess")}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {expanded && item.parsedPayload && (
        <>
          <Separator className="my-3" />
          <SkinTestResultsPreview results={item.parsedPayload.results} />
        </>
      )}
    </Surface>
  );
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
