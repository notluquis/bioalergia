import { Description, Tabs, Tooltip } from "@heroui/react";
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef, PaginationState, VisibilityState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { CheckCircle2, Clock, FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { GenerateReportModal } from "@/components/mercadopago/GenerateReportModal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/context/ToastContext";
import { getMpReportColumns } from "@/features/finance/mercadopago/components/MpReportColumns";
import { mercadoPagoKeys } from "@/features/finance/mercadopago/queries";
import { cn } from "@/lib/utils";
import {
  type ImportStats,
  type MPReport,
  MPService,
  type MpReportType,
  type MpSyncChangeDetails,
  type MpSyncImportStats,
  type MpSyncLog,
} from "@/services/mercadopago";

const REPORT_PENDING_REGEX = /processing|pending|in_progress|waiting|generating|queued|creating/i;

type MpTab = MpReportType | "sync";
type ToastFn = (message: string, title?: string) => void;

type ReportActions = {
  downloadPending: boolean;
  handleDownload: (event: React.MouseEvent, fileName: string) => void;
  handleProcess: (event: React.MouseEvent, fileName: string) => void;
  processPending: boolean;
  processingFile: null | string;
};

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
        `Reporte procesado: ${stats.insertedRows} insertados, ${stats.duplicateRows} duplicados`,
      );
      setProcessingFile(null);
      void queryClient.invalidateQueries({ queryKey: ["mp-reports", reportType] });
    },
  });

  const handleDownload = (event: React.MouseEvent, fileName: string) => {
    event.preventDefault();
    downloadMutation.mutate(fileName);
  };

  const handleProcess = (event: React.MouseEvent, fileName: string) => {
    event.preventDefault();
    if (
      confirm(
        `¿Estás seguro de sincronizar el reporte ${fileName}? Esto podría duplicar datos si no se detecta correctamente.`,
      )
    ) {
      setProcessingFile(fileName);
      setLastImportStats(null);
      processMutation.mutate(fileName);
    }
  };

  return {
    downloadPending: downloadMutation.isPending,
    handleDownload,
    handleProcess,
    processPending: processMutation.isPending,
    processingFile,
  };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large settings page with multiple sections
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
  const [reportPagination, setReportPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [syncPagination, setSyncPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Queries
  const reportType = activeTab === "sync" ? "release" : activeTab;
  const { limit: reportLimit, offset: reportOffset } = getPagination(reportPagination);
  const { data: reportResponse } = useQuery({
    ...mercadoPagoKeys.lists(reportType, { limit: reportLimit, offset: reportOffset }),
    refetchInterval: getMpReportsRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
  const reports = reportResponse?.reports ?? [];
  const reportTotal = reportResponse?.total ?? reports.length;

  const { limit: syncLimit, offset: syncOffset } = getPagination(syncPagination);
  const { data: syncResponse } = useQuery({
    ...mercadoPagoKeys.syncLogs({ limit: syncLimit, offset: syncOffset }),
    refetchInterval: activeTab === "sync" ? 30_000 : false,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
  const syncLogs = syncResponse?.logs ?? [];
  const syncTotal = syncResponse?.total ?? syncLogs.length;

  const { downloadPending, handleDownload, handleProcess, processPending, processingFile } =
    useReportActions({
      queryClient,
      reportType,
      setLastImportStats,
      showError,
      showSuccess,
    });

  const columns = getMpReportColumns(
    handleDownload,
    handleProcess,
    downloadPending,
    processPending,
    processingFile,
  );
  const reportPageCount = Math.max(1, Math.ceil(reportTotal / reportPagination.pageSize));

  const syncColumns = useMemo<ColumnDef<MpSyncLog>[]>(() => buildSyncColumns(), []);
  const syncPageCount = Math.max(1, Math.ceil(syncTotal / syncPagination.pageSize));

  return (
    <div className="space-y-5">
      {/* Header: Tabs + Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as MpTab)}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Tipo de reporte" className="rounded-lg bg-default-50/50 p-1">
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
          </Tabs.ListContainer>
        </Tabs>

        {/* Action Button */}
        {activeTab !== "sync" && (
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setIsGenerateModalOpen(true);
            }}
            size="sm"
            variant="primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Generar Reporte
          </Button>
        )}
      </div>

      {/* Import Stats Modal */}
      <Modal
        isOpen={Boolean(lastImportStats)}
        onClose={() => {
          setLastImportStats(null);
        }}
        title="Reporte Procesado"
      >
        {lastImportStats && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Procesamiento completado</span>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-default-50/50 p-4 sm:grid-cols-3">
              <div className="text-center">
                <span className="block font-bold text-2xl">{lastImportStats.totalRows}</span>
                <Description className="text-default-500 text-xs">Total filas</Description>
              </div>
              <div className="text-center">
                <span className="block font-bold text-2xl">{lastImportStats.validRows}</span>
                <Description className="text-default-500 text-xs">Válidas</Description>
              </div>
              <div className="text-center">
                <span className="block font-bold text-2xl text-success">
                  {lastImportStats.insertedRows}
                </span>
                <Description className="text-success/70 text-xs">Insertadas</Description>
              </div>
              <div className="text-center">
                <span className="block font-bold text-2xl text-warning">
                  {lastImportStats.duplicateRows}
                </span>
                <Description className="text-warning/70 text-xs">Duplicados</Description>
              </div>
              <div className="text-center">
                <span className="block font-bold text-2xl">{lastImportStats.skippedRows}</span>
                <Description className="text-default-500 text-xs">Omitidas</Description>
              </div>
              {lastImportStats.errors.length > 0 && (
                <div className="text-center">
                  <span className="block font-bold text-2xl text-danger">
                    {lastImportStats.errors.length}
                  </span>
                  <Description className="text-danger/70 text-xs">Errores</Description>
                </div>
              )}
            </div>

            {lastImportStats.errors.length > 0 && (
              <div className="rounded-lg bg-danger/10 p-3 text-sm">
                <span className="mb-2 block font-medium text-danger">Errores encontrados:</span>
                <ul className="list-inside list-disc space-y-1 text-danger/80 text-xs">
                  {lastImportStats.errors.slice(0, 5).map((err, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    <li key={i}>{err}</li>
                  ))}
                  {lastImportStats.errors.length > 5 && (
                    <li>...y {lastImportStats.errors.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setLastImportStats(null);
                }}
                variant="primary"
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {activeTab !== "sync" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Last Report Card */}
          <article className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="flex items-center gap-1.5 font-semibold text-default-500 text-xs uppercase tracking-wide">
                  Último Reporte
                </span>
                <span className="mt-2 line-clamp-1 block font-semibold text-lg">
                  {(() => {
                    const lastReport = reports[0];
                    if (!lastReport) {
                      return "N/A";
                    }
                    const date = lastReport.date_created ?? lastReport.begin_date;
                    return date ? dayjs(date).format("D MMM, HH:mm") : "N/A";
                  })()}
                </span>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <Description className="mt-4 truncate border-default-200/50 border-t pt-4 text-default-400 text-xs">
              {reports[0]?.file_name ?? "Sin reportes recientes"}
            </Description>
          </article>

          {/* Total Reports Card */}
          <StatCard
            className="h-full"
            icon={FileText}
            subtitle={`Tipo: ${reportType === "release" ? "Liberación" : "Conciliación"}`}
            title="Total Reportes"
            tone="default"
            value={reportTotal}
          />
        </div>
      )}

      {/* Reports List */}
      {activeTab !== "sync" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <div>
                <span className="block font-semibold text-lg">Historial de Reportes</span>
                <Description className="text-default-500 text-xs">Total: {reportTotal}</Description>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                aria-label="Cantidad de filas"
                value={String(reportPagination.pageSize)}
                onChange={(key) => {
                  const value = Number(key);
                  setReportPagination((prev) => ({
                    pageIndex: 0,
                    pageSize: Number.isNaN(value) ? prev.pageSize : value,
                  }));
                }}
                className="w-28"
              >
                <SelectItem id="10">10</SelectItem>
                <SelectItem id="25">25</SelectItem>
                <SelectItem id="50">50</SelectItem>
              </Select>
            </div>
          </div>

          <DataTable
            columns={columns}
            columnVisibility={columnVisibility}
            data={reports}
            enablePageSizeSelector={false}
            enableExport={false}
            enableGlobalFilter={false}
            pagination={reportPagination}
            onPaginationChange={setReportPagination}
            onColumnVisibilityChange={setColumnVisibility}
            pageCount={reportPageCount}
            noDataMessage="Aún no hay reportes. Genera uno para comenzar."
          />
        </div>
      )}

      {activeTab === "sync" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <span className="block font-semibold text-lg">Historial de Sync</span>
                <Description className="text-default-500 text-xs">Total: {syncTotal}</Description>
              </div>
            </div>
            <Select
              aria-label="Cantidad de filas"
              value={String(syncPagination.pageSize)}
              onChange={(key) => {
                const value = Number(key);
                setSyncPagination((prev) => ({
                  pageIndex: 0,
                  pageSize: Number.isNaN(value) ? prev.pageSize : value,
                }));
              }}
              className="w-28"
            >
              <SelectItem id="10">10</SelectItem>
              <SelectItem id="25">25</SelectItem>
              <SelectItem id="50">50</SelectItem>
            </Select>
          </div>
          <DataTable
            columns={syncColumns}
            data={syncLogs}
            enablePageSizeSelector={false}
            enableExport={false}
            enableGlobalFilter={false}
            pagination={syncPagination}
            onPaginationChange={setSyncPagination}
            pageCount={syncPageCount}
            noDataMessage="Aún no hay sincronizaciones registradas."
          />
        </div>
      )}

      {/* Modals */}
      <GenerateReportModal
        onClose={() => {
          setIsGenerateModalOpen(false);
        }}
        open={isGenerateModalOpen}
        reportType={reportType}
      />
    </div>
  );
}

function buildSyncColumns(): ColumnDef<MpSyncLog>[] {
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
            row.original.status === "RUNNING" && "bg-warning/10 text-warning",
          )}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: "startedAt",
      header: "Fecha",
      cell: ({ row }) => dayjs(row.original.startedAt).format("DD/MM/YYYY HH:mm"),
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
                </div>
              )}
              {importStatsByType.map(({ label, stats, tone }) =>
                stats ? (
                  <div className="flex items-center gap-1" key={label}>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-semibold text-[11px] uppercase",
                        tone === "release" && "bg-primary/10 text-primary",
                        tone === "settlement" && "bg-warning/10 text-warning",
                      )}
                    >
                      {label}
                    </span>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="rounded bg-default-100 px-1.5 py-0.5 text-default-600">
                          T{stats.totalRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Total filas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                          V{stats.validRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Validas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
                          +{stats.insertedRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Insertadas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                          D{stats.duplicateRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Duplicados</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
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
                        <Tooltip.Trigger>
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
                ) : null,
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
  ];
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

function isReportPending(status?: string) {
  if (!status) {
    return false;
  }
  return REPORT_PENDING_REGEX.test(status);
}

function getSyncImportStats(details?: MpSyncChangeDetails | null) {
  if (!details || typeof details !== "object") {
    return null;
  }
  const raw = details.importStats;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    totalRows: toNumber(raw.totalRows),
    validRows: toNumber(raw.validRows),
    insertedRows: toNumber(raw.insertedRows),
    duplicateRows: toNumber(raw.duplicateRows),
    skippedRows: toNumber(raw.skippedRows),
    errorCount: toNumber(raw.errorCount),
  };
}

function getSyncImportStatsByType(log: MpSyncLog) {
  const details = log.changeDetails;
  if (!details || typeof details !== "object") {
    return null;
  }
  const raw = details.importStatsByType;
  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const buildStats = (stats?: MpSyncImportStats | null) => {
    if (!stats) {
      return null;
    }
    return {
      totalRows: toNumber(stats.totalRows),
      validRows: toNumber(stats.validRows),
      insertedRows: toNumber(stats.insertedRows),
      duplicateRows: toNumber(stats.duplicateRows),
      skippedRows: toNumber(stats.skippedRows),
      errorCount: toNumber(stats.errorCount),
    };
  };

  const entries: Array<{
    label: string;
    stats: ReturnType<typeof buildStats>;
    tone: "release" | "settlement";
  }> = [];

  if (raw && typeof raw === "object") {
    const releaseStats = buildStats(raw.release ?? null);
    if (releaseStats) {
      entries.push({ label: "Liberación", stats: releaseStats, tone: "release" });
    }
    const settlementStats = buildStats(raw.settlement ?? null);
    if (settlementStats) {
      entries.push({ label: "Conciliación", stats: settlementStats, tone: "settlement" });
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  const fallback = getSyncImportStats(details);
  const reportTypes = getSyncReportTypes(log);
  if (!fallback || reportTypes.length !== 1) {
    return null;
  }

  return [
    {
      label: reportTypes[0] === "release" ? "Liberación" : "Conciliación",
      stats: fallback,
      tone: reportTypes[0],
    },
  ];
}

function getSyncReportTypes(log: MpSyncLog) {
  const details = log.changeDetails;
  if (details && typeof details === "object") {
    const raw = details.reportTypes;
    if (Array.isArray(raw)) {
      return raw.filter(
        (item): item is "release" | "settlement" => item === "release" || item === "settlement",
      );
    }
  }
  if (log.triggerSource === "mp:auto-sync") {
    return ["release", "settlement"] as const;
  }
  return [];
}
