import { Tabs } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCircle2, Clock, FileText, Plus, Settings } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import GenerateReportModal from "@/components/mercadopago/GenerateReportModal";
import Button from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import Modal from "@/components/ui/Modal";
import StatCard from "@/components/ui/StatCard";
import { useToast } from "@/context/ToastContext";
import { getMpReportColumns } from "@/features/finance/mercadopago/components/MpReportColumns";
import { mercadoPagoKeys } from "@/features/finance/mercadopago/queries";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  type ImportStats,
  type MPReport,
  MPService,
  type MpReportType,
  type MpSyncLog,
} from "@/services/mercadopago";

const ALL_TABLE_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "date", label: "Creado" },
  { key: "begin_date", label: "Desde" },
  { key: "end_date", label: "Hasta" },
  { key: "file", label: "Archivo" },
  { key: "source", label: "Origen" },
  { key: "status", label: "Estado" },
  { key: "actions", label: "Acciones" },
];

export default function MercadoPagoSettingsPage() {
  const queryClient = useQueryClient();
  const { error: showError, success: showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<MpReportType>("release");
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(["actions", "begin_date", "date", "end_date", "file", "status"]),
  );
  const [lastImportStats, setLastImportStats] = useState<ImportStats | null>(null);

  const toggleColumn = (key: string) => {
    const newSet = new Set(visibleColumns);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setVisibleColumns(newSet);
  };

  // Queries
  const { data: reports } = useSuspenseQuery({
    ...mercadoPagoKeys.lists(activeTab),
    refetchInterval: getMpReportsRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const { data: syncLogs } = useSuspenseQuery(mercadoPagoKeys.syncLogs(50));

  // Mutations

  const downloadMutation = useMutation({
    mutationFn: (fileName: string) => MPService.downloadReport(fileName, activeTab),
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
    mutationFn: (fileName: string) => MPService.processReport(fileName, activeTab),
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
      void queryClient.invalidateQueries({ queryKey: ["mp-reports", activeTab] });
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

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-6")}>
      {/* Header: Tabs + Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as MpReportType)}
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
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {/* Action Button */}
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
          subtitle={`Tipo: ${activeTab === "release" ? "Liberación" : "Conciliación"}`}
          title="Total Reportes"
          tone="default"
          value={reports.length}
        />
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <FileText className="text-primary h-4 w-4" />
            <h3 className="text-lg font-semibold">Historial de Reportes</h3>
          </div>

          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button className="h-8" size="sm" variant="outline">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Columnas
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="w-45">
              <DropdownMenu.Label>Columnas Visibles</DropdownMenu.Label>
              <DropdownMenu.Separator />
              {ALL_TABLE_COLUMNS.filter((c) => c.key !== "actions").map((column) => (
                <DropdownMenu.CheckboxItem
                  checked={visibleColumns.has(column.key)}
                  key={column.key}
                  onCheckedChange={() => {
                    toggleColumn(column.key);
                  }}
                >
                  {column.label}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>

        <DataTable
          columns={columns}
          columnVisibility={Object.fromEntries([...visibleColumns].map((key) => [key, true]))}
          data={reports || []}
          noDataMessage="No se encontraron reportes generados."
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock className="text-primary h-4 w-4" />
            <h3 className="text-lg font-semibold">Historial de Sync</h3>
          </div>
        </div>
        <div className="bg-background border-default-200 rounded-2xl border p-4 shadow-sm">
          {syncLogs.length === 0 ? (
            <div className="text-default-400 py-6 text-center text-sm">
              No hay sincronizaciones registradas.
            </div>
          ) : (
            <div className="divide-default-200 divide-y">
              {syncLogs.map((log: MpSyncLog) => (
                <div className="flex flex-wrap items-center gap-3 py-3" key={log.id}>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      log.status === "SUCCESS" && "bg-success/10 text-success",
                      log.status === "ERROR" && "bg-danger/10 text-danger",
                      log.status === "RUNNING" && "bg-warning/10 text-warning",
                    )}
                  >
                    {log.status}
                  </span>
                  <span className="text-sm font-medium">
                    {dayjs(log.startedAt).format("DD/MM/YYYY HH:mm")}
                  </span>
                  <span className="text-default-500 text-xs font-mono">{log.triggerSource}</span>
                  {log.triggerLabel && (
                    <span className="text-default-400 text-xs">{log.triggerLabel}</span>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-success/10 text-success rounded px-1.5 py-0.5">
                      +{log.inserted ?? 0}
                    </span>
                    {log.skipped != null && (
                      <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5">
                        !{log.skipped}
                      </span>
                    )}
                    {log.updated != null && log.updated > 0 && (
                      <span className="bg-info/10 text-info rounded px-1.5 py-0.5">
                        ~{log.updated}
                      </span>
                    )}
                    {log.excluded != null && log.excluded > 0 && (
                      <span className="bg-danger/10 text-danger rounded px-1.5 py-0.5">
                        -{log.excluded}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <GenerateReportModal
        onClose={() => {
          setIsGenerateModalOpen(false);
        }}
        open={isGenerateModalOpen}
        reportType={activeTab}
      />
    </div>
  );
}

function getMpReportsRefetchInterval(query: { state: { data?: MPReport[] } }) {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false;
  }

  const reports = query.state.data;
  if (!reports || reports.length === 0) {
    return 60_000;
  }

  const hasPending = reports.some((report) => isReportPending(report.status));
  return hasPending ? 15_000 : 60_000;
}

function isReportPending(status?: string) {
  if (!status) return false;
  return /processing|pending|in_progress|waiting|generating|queued|creating/i.test(status);
}
