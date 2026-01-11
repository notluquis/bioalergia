import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCircle2, Clock, Download, FileText, Loader2, Plus, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";

import GenerateReportModal from "@/components/mercadopago/GenerateReportModal";
import Button from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import Modal from "@/components/ui/Modal";
import StatCard from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/context/ToastContext";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { ImportStats, MpReportType, MPService } from "@/services/mercadopago";

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
  const { success: showSuccess, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<MpReportType>("release");
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(["date", "begin_date", "end_date", "file", "status", "actions"])
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
  const reportsQuery = useQuery({
    queryKey: ["mp-reports", activeTab],
    queryFn: () => MPService.listReports(activeTab),
  });

  // Mutations

  const downloadMutation = useMutation({
    mutationFn: (fileName: string) => MPService.downloadReport(fileName, activeTab),
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
    onError: (e: Error) => showError(`Error al descargar: ${e.message}`),
  });

  const handleDownload = (e: React.MouseEvent, fileName: string) => {
    e.preventDefault();
    downloadMutation.mutate(fileName);
  };

  const isLoading = reportsQuery.isLoading;

  const [processingFile, setProcessingFile] = useState<string | null>(null);

  const processMutation = useMutation({
    mutationFn: (fileName: string) => MPService.processReport(fileName, activeTab),
    onSuccess: (stats) => {
      setLastImportStats(stats);
      showSuccess(`Reporte procesado: ${stats.insertedRows} insertados, ${stats.duplicateRows} duplicados`);
      setProcessingFile(null);
    },
    onError: (e: Error) => {
      showError(`Error al procesar: ${e.message}`);
      setProcessingFile(null);
    },
  });

  const handleProcess = (e: React.MouseEvent, fileName: string) => {
    e.preventDefault();
    if (
      confirm(
        `¿Estás seguro de sincronizar el reporte ${fileName}? Esto podría duplicar datos si no se detecta correctamente.`
      )
    ) {
      setProcessingFile(fileName);
      setLastImportStats(null);
      processMutation.mutate(fileName);
    }
  };

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-6")}>
      {/* Header: Tabs + Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div role="tablist" className="tabs tabs-boxed bg-base-200/50 w-full p-1 sm:w-auto">
          <button
            role="tab"
            className={cn(
              "tab h-9 flex-1 px-3 text-sm sm:flex-none sm:px-4",
              activeTab === "release" && "tab-active bg-base-100 text-base-content font-medium shadow-sm transition-all"
            )}
            onClick={() => setActiveTab("release")}
          >
            Liberación
          </button>
          <button
            role="tab"
            className={cn(
              "tab h-9 flex-1 px-3 text-sm sm:flex-none sm:px-4",
              activeTab === "settlement" &&
                "tab-active bg-base-100 text-base-content font-medium shadow-sm transition-all"
            )}
            onClick={() => setActiveTab("settlement")}
          >
            Conciliación
          </button>
        </div>

        {/* Action Button */}
        <Button variant="primary" size="sm" onClick={() => setIsGenerateModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Generar Reporte
        </Button>
      </div>

      {/* Import Stats Modal */}
      <Modal isOpen={!!lastImportStats} onClose={() => setLastImportStats(null)} title="Reporte Procesado">
        {lastImportStats && (
          <div className="space-y-4">
            <div className="text-success flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Procesamiento completado</span>
            </div>

            <div className="bg-base-200/50 grid grid-cols-2 gap-3 rounded-lg p-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{lastImportStats.totalRows}</p>
                <p className="text-base-content/60 text-xs">Total filas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{lastImportStats.validRows}</p>
                <p className="text-base-content/60 text-xs">Válidas</p>
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
                <p className="text-base-content/60 text-xs">Omitidas</p>
              </div>
              {lastImportStats.errors.length > 0 && (
                <div className="text-center">
                  <p className="text-error text-2xl font-bold">{lastImportStats.errors.length}</p>
                  <p className="text-error/70 text-xs">Errores</p>
                </div>
              )}
            </div>

            {lastImportStats.errors.length > 0 && (
              <div className="bg-error/10 rounded-lg p-3 text-sm">
                <p className="text-error mb-2 font-medium">Errores encontrados:</p>
                <ul className="text-error/80 list-inside list-disc space-y-1 text-xs">
                  {lastImportStats.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {lastImportStats.errors.length > 5 && <li>...y {lastImportStats.errors.length - 5} más</li>}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setLastImportStats(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Last Report Card */}
            <article className="bg-base-100 border-base-300 rounded-2xl border p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base-content/60 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    Último Reporte
                  </p>
                  <h3 className="mt-2 line-clamp-1 text-lg font-semibold">
                    {(() => {
                      const lastReport = reportsQuery.data?.[0];
                      if (!lastReport) return "N/A";
                      const date = lastReport.date_created || lastReport.begin_date;
                      return date ? dayjs(date).format("D MMM, HH:mm") : "N/A";
                    })()}
                  </h3>
                </div>
                <div className="bg-primary/10 text-primary rounded-lg p-2">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <p
                className="text-base-content/50 border-base-300/50 mt-4 truncate border-t pt-4 text-xs"
                title={reportsQuery.data?.[0]?.file_name}
              >
                {reportsQuery.data?.[0]?.file_name || "Sin reportes recientes"}
              </p>
            </article>

            {/* Total Reports Card */}
            <StatCard
              title="Total Reportes"
              value={reportsQuery.data?.length || 0}
              icon={FileText}
              tone="default"
              subtitle={`Tipo: ${activeTab === "release" ? "Liberación" : "Conciliación"}`}
              className="h-full"
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
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    Columnas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-45">
                  <DropdownMenuLabel>Columnas Visibles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_TABLE_COLUMNS.filter((c) => c.key !== "actions").map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={visibleColumns.has(column.key)}
                      onCheckedChange={() => toggleColumn(column.key)}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Table
              columns={ALL_TABLE_COLUMNS.filter((col) => visibleColumns.has(col.key)).map((col) =>
                col.key === "actions" ? { ...col, align: "right" } : col
              )}
              variant="default"
            >
              <Table.Body
                loading={reportsQuery.isLoading}
                columnsCount={visibleColumns.size}
                emptyMessage="No se encontraron reportes generados."
              >
                {reportsQuery.data?.map((report) => (
                  <tr key={report.id} className="hover:bg-base-200/50 group transition-colors">
                    {visibleColumns.has("id") && (
                      <td className="text-base-content/60 font-mono text-xs">#{report.id}</td>
                    )}
                    {visibleColumns.has("date") && (
                      <td className="text-sm whitespace-nowrap">
                        {dayjs(report.date_created || report.begin_date).format("DD/MM/YY HH:mm")}
                      </td>
                    )}
                    {visibleColumns.has("begin_date") && (
                      <td className="text-base-content/70 text-sm whitespace-nowrap">
                        {report.begin_date ? dayjs(report.begin_date).format("DD/MM/YYYY") : "-"}
                      </td>
                    )}
                    {visibleColumns.has("end_date") && (
                      <td className="text-base-content/70 text-sm whitespace-nowrap">
                        {report.end_date ? dayjs(report.end_date).format("DD/MM/YYYY") : "-"}
                      </td>
                    )}
                    {visibleColumns.has("file") && (
                      <td className="text-base-content/70 max-w-40 truncate font-mono text-xs" title={report.file_name}>
                        {report.file_name || <span className="opacity-50">-</span>}
                      </td>
                    )}
                    {visibleColumns.has("source") && (
                      <td>
                        <span
                          className={cn(
                            "badge badge-sm font-medium",
                            report.created_from === "schedule" ? "badge-outline opacity-80" : "badge-ghost"
                          )}
                        >
                          {report.created_from === "schedule" ? "Automático" : "Manual"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has("status") && (
                      <td>
                        {report.status === "pending" ? (
                          <span className="text-warning bg-warning/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generando...
                          </span>
                        ) : (
                          <span className="text-success bg-success/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
                            <span className="bg-success h-1.5 w-1.5 rounded-full"></span>
                            Disponible
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.has("actions") && (
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            className="h-9 w-9 p-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                            onClick={(e) => report.file_name && handleDownload(e, report.file_name)}
                            disabled={downloadMutation.isPending || report.status === "pending" || !report.file_name}
                            title={report.status === "pending" ? "Reporte aún generándose" : "Descargar"}
                          >
                            {downloadMutation.isPending ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Download className="h-5 w-5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-9 w-9 p-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                            onClick={(e) => report.file_name && handleProcess(e, report.file_name)}
                            disabled={processMutation.isPending || report.status === "pending" || !report.file_name}
                            title={report.status === "pending" ? "Reporte aún generándose" : "Sincronizar a BD"}
                          >
                            {processMutation.isPending && processingFile && processingFile === report.file_name ? (
                              <Loader2 className="text-primary h-5 w-5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </Table.Body>
            </Table>
          </div>
        </>
      )}

      {/* Modals */}
      <GenerateReportModal
        open={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        reportType={activeTab}
      />
    </div>
  );
}
