import {
  Alert,
  Breadcrumbs,
  Button,
  Chip,
  Description,
  Label,
  ListBox,
  Modal,
  Spinner,
  Tooltip,
} from "@heroui/react";
import {
  ChevronRight,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Home,
  Link as LinkIcon,
  RefreshCw,
  RotateCw,
  ScanLine,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  type OneDriveAccount,
  type OneDriveFolderItem,
  useConfigureOneDriveFolder,
  useConnectOneDrive,
  useDisconnectOneDrive,
  useGetOneDriveAuthUrl,
  useOneDriveFolderChildren,
  useOneDriveFolderPreview,
  useOneDriveStatus,
  useRenewOneDriveSubscription,
} from "../hooks/useOneDrive";

// Shared OneDrive account manager: OAuth connect + account list (folder picker,
// webhook renewal, disconnect) + add-another-account. Feature-agnostic — backed
// by the generic /api/orpc/onedrive router. Per-feature sync actions (e.g. the
// skin-test scan) are injected via the optional `renderSyncActions` /
// `onSyncFolder` slots; consumers that don't drive a scan (fichas) omit them.

export type OneDriveSyncParams = {
  accountId?: string;
  folderDriveId?: null | string;
  folderItemId?: null | string;
  folderPath?: string;
};

export interface OneDriveAccountManagerProps {
  /** Optional per-account sync controls (rendered on the right of each row). */
  renderSyncActions?: (account: OneDriveAccount) => React.ReactNode;
  /** Optional folder-scoped sync from inside the folder picker. */
  onSyncFolder?: (params: OneDriveSyncParams) => void;
}

export function OneDriveAccountManager({
  renderSyncActions,
  onSyncFolder,
}: OneDriveAccountManagerProps) {
  const toast = useToast();
  const status = useOneDriveStatus();
  const connectOneDrive = useConnectOneDrive();
  const authUrlQuery = useGetOneDriveAuthUrl(window.location.origin + window.location.pathname);
  const handledOAuthCodeRef = useRef<string | null>(null);

  // Complete the OAuth round-trip when Microsoft redirects back with ?code=.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (
      code &&
      handledOAuthCodeRef.current !== code &&
      !status.isLoading &&
      !connectOneDrive.isPending
    ) {
      handledOAuthCodeRef.current = code;
      url.searchParams.delete("code");
      url.searchParams.delete("session_state");
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      void connectOneDrive
        .mutateAsync({ code, redirectUri: window.location.origin + window.location.pathname })
        .then(() => toast.success("OneDrive conectado exitosamente"))
        .catch((error) =>
          toast.error(error instanceof Error ? error.message : "Error al conectar OneDrive")
        );
    }
  }, [status.isLoading, connectOneDrive, toast]);

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

  const connecting = authUrlQuery.isFetching || connectOneDrive.isPending;

  if (!status.data?.connected) {
    return (
      <Alert color="warning">
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
          isPending={connecting}
        >
          <LinkIcon size={14} />
          Conectar OneDrive
        </Button>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {status.data.accounts.map((account) => (
        <OneDriveAccountRow
          key={account.accountId}
          account={account}
          onSyncFolder={onSyncFolder}
          renderSyncActions={renderSyncActions}
        />
      ))}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onPress={() => void handleConnect()}
          isPending={connecting}
        >
          <LinkIcon size={14} />
          Agregar otra cuenta
        </Button>
      </div>
    </div>
  );
}

function OneDriveAccountRow({
  account,
  onSyncFolder,
  renderSyncActions,
}: {
  account: OneDriveAccount;
  onSyncFolder?: (params: OneDriveSyncParams) => void;
  renderSyncActions?: (account: OneDriveAccount) => React.ReactNode;
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
      const result = await renewSubscription.mutateAsync(account.accountId);
      const updated = result.accounts.find((item) => item.accountId === account.accountId);
      if (updated?.subscription.status === "ACTIVE") {
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
          {renderSyncActions?.(account)}
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="Renovar webhook"
                size="sm"
                variant="outline"
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
                variant="outline"
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
        onSyncFolder={onSyncFolder}
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
  onSyncFolder,
}: {
  accountId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncFolder?: (params: OneDriveSyncParams) => void;
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
    if (!current || !onSyncFolder) return;
    onSyncFolder({ accountId, folderDriveId: current.driveId, folderItemId: current.id });
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
                      <Button size="sm" variant="outline" onPress={() => setStack([])}>
                        <Home size={14} />
                        Raíz
                      </Button>
                    </Breadcrumbs.Item>
                    {stack.map((item, index) => (
                      <Breadcrumbs.Item key={`${item.driveId ?? "me"}-${item.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
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

                {children.data && (children.data.files?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <Description className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-foreground-400">
                      <FileSpreadsheet size={12} />
                      Archivos en esta carpeta ({children.data.files.length})
                    </Description>
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                      {children.data.files.map((file) => (
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
                                  variant="outline"
                                  className="shrink-0 text-foreground-400 hover:text-foreground"
                                  onPress={() => window.open(file.webUrl ?? "", "_blank")}
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
                {current && onSyncFolder && (
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
