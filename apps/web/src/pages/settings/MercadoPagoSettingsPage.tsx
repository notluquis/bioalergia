import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCircle2, Clock, FileText, Plus, Settings } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
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
import { useToast } from "@/context/ToastContext";
import { getMpReportColumns } from "@/features/finance/mercadopago/components/MpReportColumns";
import { mercadoPagoKeys } from "@/features/finance/mercadopago/queries";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { type ImportStats, type MpReportType, MPService } from "@/services/mercadopago";

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
  const { data: reports } = useSuspenseQuery(mercadoPagoKeys.lists(activeTab));

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

  const columns = getMpReportColumns(
    handleDownload,
    handleProcess,
    downloadMutation.isPending,
    processMutation.isPending,
    processingFile
  );

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
                  const lastReport = reports?.[0];
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
          <p className="text-base-content/50 border-base-300/50 mt-4 truncate border-t pt-4 text-xs">
            {reports?.[0]?.file_name || "Sin reportes recientes"}
          </p>
        </article>

        {/* Total Reports Card */}
        <StatCard
          title="Total Reportes"
          value={reports?.length || 0}
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

        <DataTable
          columns={columns}
          data={reports || []}
          noDataMessage="No se encontraron reportes generados."
          columnVisibility={Object.fromEntries([...visibleColumns].map((key) => [key, true]))}
        />
      </div>

      {/* Modals */}
      <GenerateReportModal
        open={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        reportType={activeTab}
      />
    </div>
  );
}
