import { Tabs, Tooltip } from "@heroui/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, PaginationState, VisibilityState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { CheckCircle2, Clock, FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import GenerateReportModal from "@/components/mercadopago/GenerateReportModal";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";
import StatCard from "@/components/ui/StatCard";
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large settings page with multiple sections
export default function MercadoPagoSettingsPage() {
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

  // Mutations

  const downloadMutation = useMutation({
    mutationFn: (fileName: string) => MPService.downloadReport(fileName, reportType),
    onError: (e: Error) => {
      showError(`Error al descargar: ${e.message}`);
    },
    onSuccess: (blob, fileName) => {
      const url = globalThis.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.append(a);
      a.click();
      globalThis.URL.revokeObjectURL(url);
      a.remove();
      showSuccess(`Descargando ${fileName}`);
    },
  });

  const handleDownload = (e: React.MouseEvent, fileName: string) => {
    e.preventDefault();
    downloadMutation.mutate(fileName);
  };

  const [processingFile, setProcessingFile] = useState<null | string>(null);

  const processMutation = useMutation({
    mutationFn: (fileName: string) => MPService.processReport(fileName, reportType),
    onError: (e: Error) => {
      showError(`Error al procesar: ${e.message}`);
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

  const handleProcess = (e: React.MouseEvent, fileName: string) => {
    e.preventDefault();
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

  const columns = getMpReportColumns(
    handleDownload,
    handleProcess,
    downloadMutation.isPending,
    processMutation.isPending,
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
            <Tabs.List aria-label="Tipo de reporte" className="bg-default-50/50 rounded-lg p-1">
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
        isOpen={!!lastImportStats}
        onClose={() => {
          setLastImportStats(null);
        }}
        title="Reporte Procesado"
      >
        {lastImportStats && (
          <div className="space-y-4">
            <div className="text-success flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Procesamiento completado</span>
            </div>

            <div className="bg-default-50/50 grid grid-cols-2 gap-3 rounded-lg p-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{lastImportStats.totalRows}</p>
                <p className="text-default-500 text-xs">Total filas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{lastImportStats.validRows}</p>
                <p className="text-default-500 text-xs">Válidas</p>
              </div>
              <div className="text-center">
                <p className="text-success text-2xl font-bold">{lastImportStats.insertedRows}</p>
                <p className="text-success/70 text-xs">Insertadas</p>
              </div>
              <div className="text-center">
                <p className="text-warning text-2xl font-bold">{lastImportStats.duplicateRows}</p>
                <p className="text-warning/70 text-xs">Duplicados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{lastImportStats.skippedRows}</p>
                <p className="text-default-500 text-xs">Omitidas</p>
              </div>
              {lastImportStats.errors.length > 0 && (
                <div className="text-center">
                  <p className="text-danger text-2xl font-bold">{lastImportStats.errors.length}</p>
                  <p className="text-danger/70 text-xs">Errores</p>
                </div>
              )}
            </div>

            {lastImportStats.errors.length > 0 && (
              <div className="bg-danger/10 rounded-lg p-3 text-sm">
                <p className="text-danger mb-2 font-medium">Errores encontrados:</p>
                <ul className="text-danger/80 list-inside list-disc space-y-1 text-xs">
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
          <article className="bg-background border-default-200 rounded-2xl border p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-default-500 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  Último Reporte
                </p>
                <h3 className="mt-2 line-clamp-1 text-lg font-semibold">
                  {(() => {
                    const lastReport = reports[0];
                    if (!lastReport) return "N/A";
                    const date = lastReport.date_created ?? lastReport.begin_date;
                    return date ? dayjs(date).format("D MMM, HH:mm") : "N/A";
                  })()}
                </h3>
              </div>
              <div className="bg-primary/10 text-primary rounded-lg p-2">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="text-default-400 border-default-200/50 mt-4 truncate border-t pt-4 text-xs">
              {reports[0]?.file_name ?? "Sin reportes recientes"}
            </p>
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
              <FileText className="text-primary h-4 w-4" />
              <div>
                <h3 className="text-lg font-semibold">Historial de Reportes</h3>
                <p className="text-default-500 text-xs">Total: {reportTotal}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                aria-label="Cantidad de filas"
                selectedKey={String(reportPagination.pageSize)}
                onSelectionChange={(key) => {
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
              <Clock className="text-primary h-4 w-4" />
              <div>
                <h3 className="text-lg font-semibold">Historial de Sync</h3>
                <p className="text-default-500 text-xs">Total: {syncTotal}</p>
              </div>
            </div>
            <Select
              aria-label="Cantidad de filas"
              selectedKey={String(syncPagination.pageSize)}
              onSelectionChange={(key) => {
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
            "rounded-full px-2 py-0.5 text-xs font-semibold",
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
        <span className="text-default-500 text-xs font-mono">{row.original.triggerSource}</span>
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
                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                      Liberación
                    </span>
                  )}
                  {reportTypes.includes("settlement") && (
                    <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5">
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
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase",
                        tone === "release" && "bg-primary/10 text-primary",
                        tone === "settlement" && "bg-warning/10 text-warning",
                      )}
                    >
                      {label}
                    </span>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="bg-default-100 text-default-600 rounded px-1.5 py-0.5">
                          T{stats.totalRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Total filas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                          V{stats.validRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Validas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="bg-success/10 text-success rounded px-1.5 py-0.5">
                          +{stats.insertedRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Insertadas</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5">
                          D{stats.duplicateRows}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p>Duplicados</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <span className="bg-default-100 text-default-500 rounded px-1.5 py-0.5">
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
                          <span className="bg-danger/10 text-danger rounded px-1.5 py-0.5">
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
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                    Liberación
                  </span>
                )}
                {reportTypes.includes("settlement") && (
                  <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5">
                    Conciliación
                  </span>
                )}
              </div>
            )}
            <span className="bg-success/10 text-success rounded px-1.5 py-0.5">
              +{row.original.inserted ?? 0}
            </span>
            {row.original.skipped != null && (
              <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5">
                !{row.original.skipped}
              </span>
            )}
            {row.original.updated != null && row.original.updated > 0 && (
              <span className="bg-info/10 text-info rounded px-1.5 py-0.5">
                ~{row.original.updated}
              </span>
            )}
            {row.original.excluded != null && row.original.excluded > 0 && (
              <span className="bg-danger/10 text-danger rounded px-1.5 py-0.5">
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
  if (!status) return false;
  return REPORT_PENDING_REGEX.test(status);
}

function getSyncImportStats(details?: MpSyncChangeDetails | null) {
  if (!details || typeof details !== "object") return null;
  const raw = details.importStats;
  if (!raw || typeof raw !== "object") return null;
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
  if (!details || typeof details !== "object") return null;
  const raw = details.importStatsByType;
  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const buildStats = (stats?: MpSyncImportStats | null) => {
    if (!stats) return null;
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
    if (releaseStats) entries.push({ label: "Liberación", stats: releaseStats, tone: "release" });
    const settlementStats = buildStats(raw.settlement ?? null);
    if (settlementStats)
      entries.push({ label: "Conciliación", stats: settlementStats, tone: "settlement" });
  }

  if (entries.length > 0) {
    return entries;
  }

  const fallback = getSyncImportStats(details);
  const reportTypes = getSyncReportTypes(log);
  if (!fallback || reportTypes.length !== 1) return null;

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
