import {
  Alert,
  Button,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Spinner,
  Surface,
  TextField,
  ProgressBar,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { Check, ExternalLink, FileSpreadsheet, RefreshCw, X, Link as LinkIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  useApproveSkinTestImport,
  useConfigureOneDriveFolder,
  useOneDriveSkinTestStatus,
  useRejectSkinTestImport,
  useReprocessSkinTestImport,
  useSkinTestImports,
  useSyncSkinTestImports,
  useGetOneDriveAuthUrl,
  useConnectOneDrive,
  useClinicalSkinTestJobStatus,
  type SkinTestImportFilters,
} from "./skin-tests-queries";
import type { SkinTestImport, SkinTestImportStatus, SkinTestResult } from "./skin-tests-types";

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

export function SkinTestImportPanel() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SkinTestImportStatus | undefined>("PENDING_REVIEW");
  const [folderPath, setFolderPath] = useState("");
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
  const configureFolder = useConfigureOneDriveFolder();
  const connectOneDrive = useConnectOneDrive();
  const authUrlQuery = useGetOneDriveAuthUrl(window.location.origin + window.location.pathname);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobStatusQuery = useClinicalSkinTestJobStatus(activeJobId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !oneDrive.isLoading && !connectOneDrive.isPending) {
      void connectOneDrive
        .mutateAsync({
          code,
          redirectUri: window.location.origin + window.location.pathname,
        })
        .then(() => {
          toast.success("OneDrive conectado exitosamente");
          window.history.replaceState({}, document.title, window.location.pathname);
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

  async function handleSync(force = false) {
    try {
      const result = await syncMutation.mutateAsync({ force });
      setActiveJobId(result.jobId);
      toast.success(`Sincronización iniciada`, "Sincronización");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar sync");
    }
  }

  async function handleSaveFolder() {
    if (!folderPath.trim()) return;
    try {
      await configureFolder.mutateAsync(folderPath.trim());
      toast.success("Carpeta OneDrive actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar carpeta");
    }
  }

  return (
    <div className="space-y-4">
      <Surface className="rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Importación tests cutáneos</h2>
            <p className="text-sm text-foreground-500">
              OneDrive {oneDrive.data?.connected ? "conectado" : "sin conectar"} · Carpeta{" "}
              {oneDrive.data?.folderPath || "raíz"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void handleSync(false)}
              isDisabled={!oneDrive.data?.connected || syncMutation.isPending}
            >
              <RefreshCw size={14} />
              Sincronizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void handleSync(true)}
              isDisabled={!oneDrive.data?.connected || syncMutation.isPending}
            >
              Releer todo
            </Button>
          </div>
        </div>

        {activeJobId && jobStatusQuery.data?.job && (
          <div className="mt-4">
            <ProgressBar
              aria-label="Progreso de sincronización"
              className="w-full"
              color={
                jobStatusQuery.data.job.status === "failed"
                  ? "danger"
                  : jobStatusQuery.data.job.status === "completed"
                    ? "success"
                    : "accent"
              }
              value={jobStatusQuery.data.job.progress}
              maxValue={jobStatusQuery.data.job.total || 100}
            >
              <div className="flex justify-between">
                <Label>{jobStatusQuery.data.job.message || "Sincronizando..."}</Label>
                {jobStatusQuery.data.job.total > 0 && (
                  <span className="text-xs text-foreground-500">
                    {jobStatusQuery.data.job.progress} / {jobStatusQuery.data.job.total}
                  </span>
                )}
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            {["completed", "failed"].includes(jobStatusQuery.data.job.status) && (
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

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <TextField value={folderPath} onChange={setFolderPath}>
            <Label>Carpeta OneDrive</Label>
            <Input placeholder="Tests cutáneos" />
          </TextField>
          <Button
            className="self-end"
            variant="secondary"
            onPress={() => void handleSaveFolder()}
            isDisabled={configureFolder.isPending || !folderPath.trim()}
          >
            Guardar carpeta
          </Button>
        </div>
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
          </div>
          <div className="text-xs text-foreground-500 flex items-center gap-1.5 flex-wrap mt-1">
            {header?.panelTitle && (
              <Chip size="sm" color="primary" variant="flat" className="mr-1">
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
          {item.oneDriveWebUrl && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => window.open(item.oneDriveWebUrl!, "_blank")}
            >
              <ExternalLink size={14} />
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
