import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Clock, Download, FileText, Loader2, Plus, RefreshCw, Settings } from "lucide-react";
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
import StatCard from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/context/ToastContext";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { MpReportType, MPService } from "@/services/mercadopago";

const ALL_TABLE_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "date", label: "Fecha Creación" },
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
    new Set(["date", "file", "source", "status", "actions"])
  );

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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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
    onSuccess: () => {
      showSuccess("Reporte procesado y sincronizado correctamente");
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
      processMutation.mutate(fileName);
    }
  };

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-6")}>
      {/* Header */}
      {/* Header & Tabs Combined */}
      <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes de Mercado Pago</h1>
          <p className="text-base-content/60 text-sm">Gestiona reportes de Liberación de Fondos y Conciliación</p>
        </div>

        {/* Tabs Moved Up */}
        <div role="tablist" className="tabs tabs-boxed bg-base-200/50 order-3 self-start p-1 xl:order-2 xl:self-auto">
          <button
            role="tab"
            className={cn(
              "tab h-9 px-4",
              activeTab === "release" && "tab-active bg-base-100 text-base-content font-medium shadow-sm transition-all"
            )}
            onClick={() => setActiveTab("release")}
          >
            Liberación de Fondos
          </button>
          <button
            role="tab"
            className={cn(
              "tab h-9 px-4",
              activeTab === "settlement" &&
                "tab-active bg-base-100 text-base-content font-medium shadow-sm transition-all"
            )}
            onClick={() => setActiveTab("settlement")}
          >
            Conciliación (Settlement)
          </button>
        </div>

        <div className="order-2 flex flex-wrap gap-3 xl:order-3">
          <Button variant="primary" onClick={() => setIsGenerateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generar Reporte
          </Button>
        </div>
      </div>

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
                      <td className="font-medium whitespace-nowrap">
                        {dayjs(report.date_created || report.begin_date).format("DD/MM/YYYY HH:mm")}
                      </td>
                    )}
                    {visibleColumns.has("file") && (
                      <td className="text-base-content/70 max-w-50 truncate font-mono text-xs" title={report.file_name}>
                        {report.file_name}
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
                        <span className="text-success bg-success/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
                          <span className="bg-success h-1.5 w-1.5 rounded-full"></span>
                          Disponible
                        </span>
                      </td>
                    )}
                    {visibleColumns.has("actions") && (
                      <td className="text-right">
                        {/* Use button with click handler for manual download via mutation */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-square opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => report.file_name && handleDownload(e, report.file_name)}
                          disabled={downloadMutation.isPending}
                          title="Descargar"
                        >
                          {downloadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="btn-square opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => report.file_name && handleProcess(e, report.file_name)}
                          disabled={processMutation.isPending}
                          title="Sincronizar a BD"
                        >
                          {processMutation.isPending && processingFile === report.file_name ? (
                            <Loader2 className="text-primary h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
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
