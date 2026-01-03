import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Settings, Download, Plus, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import dayjs from "dayjs";

import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import StatCard from "@/components/ui/StatCard";
import { useToast } from "@/context/ToastContext";
import { MPService } from "@/services/mercadopago";
import ConfigModal from "@/components/mercadopago/ConfigModal";
import GenerateReportModal from "@/components/mercadopago/GenerateReportModal";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

const ALL_TABLE_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "date", label: "Fecha Creación" },
  { key: "file", label: "Archivo" },
  { key: "source", label: "Origen" },
  { key: "status", label: "Estado" },
  { key: "actions", label: "Acciones" },
];

export default function MercadoPagoSettingsPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
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
  const configQuery = useQuery({
    queryKey: ["mp-config"],
    queryFn: MPService.getConfig,
  });

  const reportsQuery = useQuery({
    queryKey: ["mp-reports"],
    queryFn: MPService.listReports,
  });

  // Mutations
  const enableScheduleMutation = useMutation({
    mutationFn: MPService.enableSchedule,
    onSuccess: () => {
      showSuccess("Generación automática activada");
      queryClient.invalidateQueries({ queryKey: ["mp-config"] });
    },
    onError: () => showError("Error al activar generación automática"),
  });

  const disableScheduleMutation = useMutation({
    mutationFn: MPService.disableSchedule,
    onSuccess: () => {
      showSuccess("Generación automática desactivada");
      queryClient.invalidateQueries({ queryKey: ["mp-config"] });
    },
    onError: () => showError("Error al desactivar generación automática"),
  });

  const isScheduled = configQuery.data?.scheduled ?? false;
  const isLoading = configQuery.isLoading || reportsQuery.isLoading;

  if (isLoading) {
    return (
      <div className={cn(PAGE_CONTAINER, "flex min-h-[50vh] items-center justify-center")}>
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn(PAGE_CONTAINER, "space-y-8")}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes de Mercado Pago</h1>
          <p className="text-base-content/60 text-sm">
            Gestiona la generación y descarga de reportes de liberación de fondos
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsConfigModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configuración
          </Button>
          <Button variant="primary" onClick={() => setIsGenerateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generar Reporte
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Status Card (Custom due to interactivity) */}
        <article className="bg-base-100 border-base-300 relative overflow-hidden rounded-2xl border p-6 shadow-sm">
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <p className="text-base-content/60 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                Estado Automático
              </p>
              <h3 className={cn("mt-2 text-2xl font-semibold", isScheduled ? "text-success" : "text-warning")}>
                {isScheduled ? "Activo" : "Inactivo"}
              </h3>
            </div>
            <div
              className={cn(
                "rounded-lg p-2",
                isScheduled ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {isScheduled ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
          </div>
          <div className="border-base-300/50 relative z-10 mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-base-content/50 text-xs">Generación periódica</span>
            <button
              className="text-primary text-xs font-medium hover:underline"
              onClick={() => (isScheduled ? disableScheduleMutation.mutate() : enableScheduleMutation.mutate())}
              disabled={enableScheduleMutation.isPending || disableScheduleMutation.isPending}
            >
              {isScheduled ? "Desactivar" : "Activar"}
            </button>
          </div>
        </article>

        {/* Last Report Card (Custom content structure) */}
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
                  const date = lastReport.date_created || lastReport.generation_date || lastReport.begin_date;
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

        {/* Total Reports Card (Using Shared Component) */}
        <StatCard
          title="Total Reportes"
          value={reportsQuery.data?.length || 0}
          icon={FileText}
          tone="default"
          subtitle="Disponibles para descargar"
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
                {visibleColumns.has("id") && <td className="text-base-content/60 font-mono text-xs">#{report.id}</td>}
                {visibleColumns.has("date") && (
                  <td className="font-medium whitespace-nowrap">
                    {dayjs(report.date_created || report.generation_date || report.begin_date).format(
                      "DD/MM/YYYY HH:mm"
                    )}
                  </td>
                )}
                {visibleColumns.has("file") && (
                  <td className="text-base-content/70 font-mono text-xs">{report.file_name}</td>
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
                    <a
                      href={`/api/mercadopago/reports/download/${report.file_name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm btn-square opacity-0 transition-opacity group-hover:opacity-100"
                      title="Descargar"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </td>
                )}
              </tr>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* Modals */}
      <ConfigModal open={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} />
      <GenerateReportModal open={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} />
    </div>
  );
}
