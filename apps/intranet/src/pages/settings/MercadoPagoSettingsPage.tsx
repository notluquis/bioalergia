import { formatChile } from "@/lib/dates";
import { Alert, AlertDialog, Button, Modal, Tabs, Tooltip } from "@heroui/react";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef, PaginationState, VisibilityState } from "@tanstack/react-table";
import { CheckCircle2, Clock, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { GenerateReportModal } from "@/components/mercadopago/GenerateReportModal";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useToast } from "@/context/ToastContext";
import { getMpReportColumns } from "@/features/finance/mercadopago/components/MpReportColumns";
import { MpReportTabPanel } from "@/features/finance/mercadopago/components/MpReportTabPanel";
import { mercadoPagoKeys } from "@/features/finance/mercadopago/queries";
import { isReportPending } from "@/features/finance/mercadopago/reportStatus";
import {
  getSyncImportStats,
  getSyncImportStatsByType,
  getSyncReportTypes,
} from "@/features/finance/mercadopago/sync-stats";
import { cn } from "@/lib/utils";
import {
  type ImportStats,
  type MPReport,
  MPService,
  type MpImportChange,
  type MpReportType,
  type MpSyncLog,
} from "@/services/mercadopago";

type MpTab = MpReportType | "sync";
type ToastFn = (message: string, title?: string) => void;

type ReportActions = {
  confirmingFile: null | string;
  downloadPending: boolean;
  handleConfirmProcess: () => void;
  handleDownload: (fileName: string) => void;
  handleProcess: (fileName: string) => void;
  processPending: boolean;
  processingFile: null | string;
  setConfirmingFile: (value: null | string) => void;
};

const resolveReportTypeFromTab = (tab: MpTab): MpReportType => (tab === "sync" ? "release" : tab);
const resolveSyncRefetchInterval = (isSyncTab: boolean) => (isSyncTab ? 30_000 : false);

const useReportActions = ({
  queryClient,
  reportType,
  setLastImportStats,
  showError,
  showSuccess,
}: {
  queryClient: QueryClient;
  reportType: MpReportType;
  setLastImportStats: React.Dispatch<React.SetStateAction<ImportStats | null>>;
  showError: ToastFn;
  showSuccess: ToastFn;
}): ReportActions => {
  const [processingFile, setProcessingFile] = useState<null | string>(null);
  const [confirmingFile, setConfirmingFile] = useState<null | string>(null);

  const downloadMutation = useMutation({
    mutationFn: (fileName: string) => MPService.downloadReport(fileName, reportType),
    onError: (error: Error) => {
      showError(`Error al descargar: ${error.message}`);
    },
    onSuccess: (blob, fileName) => {
      const url = globalThis.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      globalThis.URL.revokeObjectURL(url);
      anchor.remove();
      showSuccess(`Descargando ${fileName}`);
    },
  });

  const processMutation = useMutation({
    mutationFn: (fileName: string) => MPService.processReport(fileName, reportType),
    onError: (error: Error) => {
      showError(`Error al procesar: ${error.message}`);
      setProcessingFile(null);
    },
    onSuccess: (stats) => {
      setLastImportStats(stats);
      showSuccess(
        `Reporte procesado: ${stats.insertedRows} insertadas, ${stats.updatedRows} actualizadas, ${stats.unchangedRows} sin cambios`
      );
      setProcessingFile(null);
      void queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
    },
  });

  const handleDownload = useCallback(
    (fileName: string) => {
      downloadMutation.mutate(fileName);
    },
    [downloadMutation]
  );

  // Just opens the AlertDialog — no confirm() blocking the event loop
  const handleProcess = useCallback((fileName: string) => {
    setConfirmingFile(fileName);
  }, []);

  // Called when user confirms inside AlertDialog
  const handleConfirmProcess = useCallback(() => {
    if (!confirmingFile) return;
    const fileName = confirmingFile;
    setConfirmingFile(null);
    setProcessingFile(fileName);
    setLastImportStats(null);
    processMutation.mutate(fileName);
  }, [confirmingFile, processMutation, setLastImportStats]);

  return {
    confirmingFile,
    downloadPending: downloadMutation.isPending,
    handleConfirmProcess,
    handleDownload,
    handleProcess,
    processPending: processMutation.isPending,
    processingFile,
    setConfirmingFile,
  };
};

export function MercadoPagoSettingsPage() {
  const queryClient = useQueryClient();
  const { error: showError, success: showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<MpTab>("release");
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    actions: true,
    begin_date: true,
    date: true,
    end_date: true,
    file_name: true,
    id: true,
    source: true,
    status: true,
  });
  const [lastImportStats, setLastImportStats] = useState<ImportStats | null>(null);
  const [selectedChangeLog, setSelectedChangeLog] = useState<MpSyncLog | null>(null);
  const [reportPagination, setReportPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [syncPagination, setSyncPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const isSyncTab = activeTab === "sync";

  // Queries
  const reportType = resolveReportTypeFromTab(activeTab);
  const { limit: reportLimit, offset: reportOffset } = getPagination(reportPagination);
  const {
    data: reportResponse,
    error: reportError,
    isPending: isReportPending,
  } = useQuery({
    ...mercadoPagoKeys.lists(reportType, { limit: reportLimit, offset: reportOffset }),
    refetchInterval: getMpReportsRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData, previousQuery) => {
      const previousType = previousQuery?.queryKey[1];
      return previousType === reportType ? previousData : undefined;
    },
  });
  const reports = reportResponse?.reports ?? [];
  const reportTotal = reportResponse?.total ?? reports.length;
  const reportErrorMessage =
    reportError instanceof Error ? reportError.message : reportError ? String(reportError) : null;
  const isReportLoading = isReportPending && !reportResponse;

  const { limit: syncLimit, offset: syncOffset } = getPagination(syncPagination);
  const {
    data: syncResponse,
    error: syncError,
    isPending: isSyncPending,
  } = useQuery({
    ...mercadoPagoKeys.syncLogs({ limit: syncLimit, offset: syncOffset }),
    refetchInterval: resolveSyncRefetchInterval(isSyncTab),
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
  const syncLogs = syncResponse?.logs ?? [];
  const syncTotal = syncResponse?.total ?? syncLogs.length;
  const syncErrorMessage =
    syncError instanceof Error ? syncError.message : syncError ? String(syncError) : null;
  const isSyncLoading = isSyncPending && !syncResponse;
  const selectedChangeLogId = selectedChangeLog?.id;
  const {
    data: importChangesResponse,
    error: importChangesError,
    isPending: isImportChangesPending,
  } = useQuery({
    ...mercadoPagoKeys.importChanges({
      limit: 100,
      offset: 0,
      syncLogId: selectedChangeLogId ?? 0n,
    }),
    enabled: selectedChangeLogId != null,
  });
  const importChanges = importChangesResponse?.changes ?? [];
  const importChangesTotal = importChangesResponse?.total ?? 0;
  const importChangesErrorMessage =
    importChangesError instanceof Error
      ? importChangesError.message
      : importChangesError
        ? String(importChangesError)
        : null;

  const {
    confirmingFile,
    downloadPending,
    handleConfirmProcess,
    handleDownload,
    handleProcess,
    processPending,
    processingFile,
    setConfirmingFile,
  } = useReportActions({
    queryClient,
    reportType,
    setLastImportStats,
    showError,
    showSuccess,
  });

  const columns = useMemo(
    () =>
      getMpReportColumns(
        handleDownload,
        handleProcess,
        downloadPending,
        processPending,
        processingFile
      ),
    [handleDownload, handleProcess, downloadPending, processPending, processingFile]
  );
  const reportPageCount = Math.max(1, Math.ceil(reportTotal / reportPagination.pageSize));

  const syncColumns = useMemo<ColumnDef<MpSyncLog>[]>(
    () => buildSyncColumns(setSelectedChangeLog),
    [setSelectedChangeLog]
  );
  const importChangeColumns = useMemo(() => buildImportChangeColumns(), []);
  const syncPageCount = Math.max(1, Math.ceil(syncTotal / syncPagination.pageSize));
  const onTabChange = (key: React.Key) => {
    const next = String(key);
    if (next === "release" || next === "settlement" || next === "sync") {
      setActiveTab(next);
      if (next === "release" || next === "settlement") {
        setReportPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    }
  };
  const closeImportStatsModal = () => setLastImportStats(null);
  const openGenerateModal = () => setIsGenerateModalOpen(true);

  return (
    <div className="space-y-5">
      <Tabs
        className="w-full"
        selectedKey={activeTab}
        onSelectionChange={onTabChange}
        variant="secondary"
      >
        <Tabs.ListContainer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs.List
            aria-label="Tipo de reporte"
            className="rounded-lg bg-default-50/50 p-1 whitespace-nowrap"
          >
            <Tabs.Tab id="release">
              Liberación
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="settlement">
              Conciliación
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="sync">
              Historial Sync
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>

          {!isSyncTab && (
            <Button
              className="w-full shrink-0 sm:w-auto"
              onPress={openGenerateModal}
              variant="primary"
            >
              <Plus className="mr-2 size-4" />
              Generar Reporte
            </Button>
          )}
        </Tabs.ListContainer>

        <Tabs.Panel className="space-y-5 pt-4" id="release">
          {activeTab === "release" ? (
            <MpReportTabPanel
              columns={columns}
              columnVisibility={columnVisibility}
              errorMessage={reportErrorMessage}
              isLoading={isReportLoading}
              onColumnVisibilityChange={setColumnVisibility}
              onPaginationChange={setReportPagination}
              pageCount={reportPageCount}
              pagination={reportPagination}
              reports={reports}
              reportTotal={reportTotal}
              reportType={reportType}
            />
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="space-y-5 pt-4" id="settlement">
          {activeTab === "settlement" ? (
            <MpReportTabPanel
              columns={columns}
              columnVisibility={columnVisibility}
              errorMessage={reportErrorMessage}
              isLoading={isReportLoading}
              onColumnVisibilityChange={setColumnVisibility}
              onPaginationChange={setReportPagination}
              pageCount={reportPageCount}
              pagination={reportPagination}
              reports={reports}
              reportTotal={reportTotal}
              reportType={reportType}
            />
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel className="space-y-5 pt-4" id="sync">
          {activeTab === "sync" ? (
            <>
              <ErrorAlert message={syncErrorMessage} />

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <Clock className="text-primary size-4" />
                    <div>
                      <span className="block font-semibold text-lg">Historial de Sync</span>
                      <span className="block text-default-500 text-xs">Total: {syncTotal}</span>
                    </div>
                  </div>
                </div>
                <DataTable
                  columns={syncColumns}
                  containerVariant="plain"
                  data={syncLogs}
                  enableExport={false}
                  enableGlobalFilter={false}
                  isLoading={isSyncLoading}
                  key={`mp-sync-${syncPagination.pageIndex}-${syncLogs.length}`}
                  pageSizeOptions={[10, 25, 50]}
                  pagination={syncPagination}
                  onPaginationChange={setSyncPagination}
                  pageCount={syncPageCount}
                  noDataMessage={
                    isSyncLoading
                      ? "Cargando historial de sincronización..."
                      : "Aún no hay sincronizaciones registradas."
                  }
                  scrollMaxHeight="min(68dvh, 760px)"
                />
              </div>
            </>
          ) : null}
        </Tabs.Panel>
      </Tabs>

      {/* Confirm Sync AlertDialog */}
      <AlertDialog.Backdrop
        isDismissable
        isOpen={Boolean(confirmingFile)}
        onOpenChange={(open) => {
          if (!open) setConfirmingFile(null);
        }}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>¿Sincronizar reporte?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                El reporte <strong>{confirmingFile}</strong> será procesado. Asegúrate de no
                procesarlo dos veces para evitar duplicados.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button onPress={() => setConfirmingFile(null)} variant="tertiary">
                Cancelar
              </Button>
              <Button onPress={handleConfirmProcess} variant="primary">
                Sincronizar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      {/* Import Stats Modal */}
      <Modal>
        <Modal.Backdrop
          isOpen={Boolean(lastImportStats)}
          onOpenChange={(open) => {
            if (!open) {
              closeImportStatsModal();
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="w-full max-w-2xl">
              <Modal.Header>
                <Modal.Heading>Reporte Procesado</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {lastImportStats && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="size-5" />
                      <span className="font-medium">Procesamiento completado</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-default-50/50 p-4 sm:grid-cols-3">
                      <div className="text-center">
                        <span className="block font-bold text-2xl">
                          {lastImportStats.totalRows}
                        </span>
                        <span className="block text-default-500 text-xs">Total filas</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-2xl">
                          {lastImportStats.validRows}
                        </span>
                        <span className="block text-default-500 text-xs">Válidas</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-2xl text-success">
                          {lastImportStats.insertedRows}
                        </span>
                        <span className="block text-success/70 text-xs">Insertadas</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-2xl text-primary">
                          {lastImportStats.updatedRows}
                        </span>
                        <span className="block text-primary/70 text-xs">Actualizadas</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-2xl text-warning">
                          {lastImportStats.unchangedRows}
                        </span>
                        <span className="block text-warning/70 text-xs">Sin cambios</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-2xl">
                          {lastImportStats.skippedRows}
                        </span>
                        <span className="block text-default-500 text-xs">Omitidas</span>
                      </div>
                      {lastImportStats.errors.length > 0 && (
                        <div className="text-center">
                          <span className="block font-bold text-2xl text-danger">
                            {lastImportStats.errors.length}
                          </span>
                          <span className="block text-danger/70 text-xs">Errores</span>
                        </div>
                      )}
                    </div>

                    {lastImportStats.errors.length > 0 && (
                      <div className="rounded-lg bg-danger/10 p-3 text-sm">
                        <span className="mb-2 block font-medium text-danger">
                          Errores encontrados:
                        </span>
                        <ul className="list-inside list-disc space-y-1 text-danger/80 text-xs">
                          {lastImportStats.errors.slice(0, 5).map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                          {lastImportStats.errors.length > 5 && (
                            <li>...y {lastImportStats.errors.length - 5} más</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onPress={closeImportStatsModal} variant="primary">
                        Cerrar
                      </Button>
                    </div>
                  </div>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop
          isOpen={Boolean(selectedChangeLog)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedChangeLog(null);
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="w-full max-w-5xl">
              <Modal.Header>
                <Modal.Heading>Cambios por campo</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-default-500 text-sm">
                    <span>
                      Sync #{selectedChangeLog?.id.toString() ?? "-"} ·{" "}
                      {selectedChangeLog?.triggerLabel ?? selectedChangeLog?.triggerSource ?? "-"}
                    </span>
                    <span>Total cambios: {importChangesTotal}</span>
                  </div>

                  {importChangesErrorMessage && (
                    <Alert status="danger">
                      <Alert.Content>
                        <Alert.Description>{importChangesErrorMessage}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}

                  <DataTable
                    columns={importChangeColumns}
                    containerVariant="plain"
                    data={importChanges}
                    enableExport={false}
                    enableGlobalFilter={false}
                    enablePagination={false}
                    enableToolbar={false}
                    isLoading={isImportChangesPending}
                    noDataMessage="No hay cambios de campo para este sync."
                    scrollMaxHeight="62dvh"
                  />

                  {importChangesTotal > importChanges.length && (
                    <p className="text-default-500 text-xs">
                      Mostrando primeros {importChanges.length} cambios. Usa el backend con filtros
                      por SOURCE_ID/campo para auditorías más específicas.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button onPress={() => setSelectedChangeLog(null)} variant="primary">
                      Cerrar
                    </Button>
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Modals */}
      {isGenerateModalOpen ? (
        <GenerateReportModal
          onClose={() => {
            setIsGenerateModalOpen(false);
          }}
          open={isGenerateModalOpen}
          reportType={reportType}
        />
      ) : null}
    </div>
  );
}

function buildSyncColumns(onViewChanges: (log: MpSyncLog) => void): ColumnDef<MpSyncLog>[] {
  return [
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold text-xs",
            row.original.status === "SUCCESS" && "bg-success/10 text-success",
            row.original.status === "ERROR" && "bg-danger/10 text-danger",
            row.original.status === "RUNNING" && "bg-warning/10 text-warning"
          )}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: "startedAt",
      header: "Fecha",
      cell: ({ row }) => formatChile(row.original.startedAt, "DD/MM/YYYY HH:mm"),
    },
    {
      accessorKey: "triggerSource",
      header: "Fuente",
      cell: ({ row }) => (
        <span className="font-mono text-default-500 text-xs">{row.original.triggerSource}</span>
      ),
    },
    {
      accessorKey: "triggerLabel",
      header: "Detalle",
      cell: ({ row }) => row.original.triggerLabel ?? "-",
    },
    {
      id: "metrics",
      header: "Resultados",
      cell: ({ row }) => {
        const importStatsByType = getSyncImportStatsByType(row.original);
        const reportTypes = getSyncReportTypes(row.original);
        if (importStatsByType) {
          // Each per-type stats group below already renders its own type label
          // ({label}), so the standalone reportTypes chips would duplicate it.
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {importStatsByType.map(({ label, stats, tone }) =>
                stats ? (
                  <div className="flex items-center gap-1" key={label}>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-caption",
                        tone === "release" && "bg-primary/10 text-primary",
                        tone === "settlement" && "bg-warning/10 text-warning",
                        tone === "withdraw" && "bg-secondary/10 text-secondary"
                      )}
                    >
                      {label}
                    </span>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger aria-label="Total filas">
                        <span className="rounded bg-default-100 px-1.5 py-0.5 text-default-600">
                          T{stats.totalRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Total filas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger aria-label="Filas válidas">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                          V{stats.validRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Validas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger aria-label="Filas insertadas">
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
                          +{stats.insertedRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Insertadas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger aria-label="Filas actualizadas">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                          U{stats.updatedRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Actualizadas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger aria-label="Filas sin cambios">
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                          ={stats.unchangedRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Sin cambios</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger aria-label="Filas omitidas">
                        <span className="rounded bg-default-100 px-1.5 py-0.5 text-default-500">
                          S{stats.skippedRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Omitidas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    {stats.errorCount > 0 && (
                      <Tooltip delay={0}>
                        <Tooltip.Trigger aria-label="Errores">
                          <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger">
                            E{stats.errorCount}
                          </span>
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p>Errores</p>
                        </Tooltip.Content>
                      </Tooltip>
                    )}
                  </div>
                ) : null
              )}
            </div>
          );
        }

        return (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {reportTypes.length > 0 && (
              <div className="flex items-center gap-1">
                {reportTypes.includes("release") && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                    Liberación
                  </span>
                )}
                {reportTypes.includes("settlement") && (
                  <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                    Conciliación
                  </span>
                )}
                {reportTypes.includes("withdraw") && (
                  <span className="rounded bg-secondary/10 px-1.5 py-0.5 text-secondary">
                    Retiros
                  </span>
                )}
              </div>
            )}
            <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
              +{row.original.inserted ?? 0}
            </span>
            {row.original.skipped != null && (
              <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                !{row.original.skipped}
              </span>
            )}
            {row.original.updated != null && row.original.updated > 0 && (
              <span className="rounded bg-info/10 px-1.5 py-0.5 text-info">
                ~{row.original.updated}
              </span>
            )}
            {row.original.excluded != null && row.original.excluded > 0 && (
              <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger">
                -{row.original.excluded}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "changes",
      header: "Cambios",
      cell: ({ row }) => {
        const stats = getSyncImportStats(row.original.changeDetails);
        const changeCount = stats?.fieldChangeCount ?? 0;
        const updatedRows = stats?.updatedRows ?? row.original.updated ?? 0;
        const disabled = changeCount <= 0 && updatedRows <= 0;

        return (
          <Button
            isDisabled={disabled}
            onPress={() => onViewChanges(row.original)}
            size="sm"
            variant="secondary"
          >
            Ver cambios
          </Button>
        );
      },
    },
  ];
}

function buildImportChangeColumns(): ColumnDef<MpImportChange>[] {
  return [
    {
      accessorKey: "sourceId",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sourceId}</span>,
      header: "SOURCE_ID",
    },
    {
      accessorKey: "reportType",
      cell: ({ row }) => (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-caption",
            row.original.reportType === "release" && "bg-primary/10 text-primary",
            row.original.reportType === "settlement" && "bg-warning/10 text-warning",
            row.original.reportType === "withdraw" && "bg-secondary/10 text-secondary"
          )}
        >
          {row.original.reportType === "release"
            ? "Liberación"
            : row.original.reportType === "settlement"
              ? "Conciliación"
              : "Retiros"}
        </span>
      ),
      header: "Reporte",
    },
    {
      accessorKey: "fieldName",
      cell: ({ row }) => <span className="font-medium">{row.original.fieldName}</span>,
      header: "Campo",
    },
    {
      accessorKey: "oldValue",
      cell: ({ row }) => <AuditValue value={row.original.oldValue} />,
      header: "Antes",
    },
    {
      accessorKey: "newValue",
      cell: ({ row }) => <AuditValue value={row.original.newValue} />,
      header: "Después",
    },
  ];
}

function AuditValue({ value }: { value: unknown }) {
  const text = formatAuditValue(value);
  return (
    <code className="block truncate rounded bg-default-50 px-1.5 py-1 text-default-700 text-xs">
      {text}
    </code>
  );
}

function formatAuditValue(value: unknown) {
  if (value == null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function getPagination(pagination: PaginationState) {
  return {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  };
}

function getMpReportsRefetchInterval(query: { state: { data?: { reports?: MPReport[] } } }) {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false;
  }

  const reports = query.state.data?.reports;
  if (!reports || reports.length === 0) {
    return 60_000;
  }

  const hasPending = reports.some((report) => isReportPending(report.status));
  return hasPending ? 15_000 : 60_000;
}
