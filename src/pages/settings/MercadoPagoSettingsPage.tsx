import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Settings, Download, Plus, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import dayjs from "dayjs";

import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { MPService } from "@/services/mercadopago";
import ConfigModal from "@/components/mercadopago/ConfigModal";
import GenerateReportModal from "@/components/mercadopago/GenerateReportModal";

export default function MercadoPagoSettingsPage() {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

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
          <h1 className="from-primary to-secondary bg-linear-to-r bg-clip-text text-2xl font-bold text-transparent">
            Reportes de Mercado Pago
          </h1>
          <p className="text-base-content/60 mt-1">
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
        {/* Status Card */}
        <div className="bg-base-200/50 border-base-300 rounded-xl border p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base-content/60 text-sm font-medium">Estado Automático</p>
              <h3 className="mt-2 text-2xl font-bold">{isScheduled ? "Activo" : "Inactivo"}</h3>
            </div>
            <div
              className={cn(
                "rounded-lg p-2",
                isScheduled ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {isScheduled ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
          </div>
          <div className="border-base-300 mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-base-content/60 text-xs">Generación periódica</span>
            <button
              className="text-primary text-xs font-medium hover:underline"
              onClick={() => (isScheduled ? disableScheduleMutation.mutate() : enableScheduleMutation.mutate())}
              disabled={enableScheduleMutation.isPending || disableScheduleMutation.isPending}
            >
              {isScheduled ? "Desactivar" : "Activar"}
            </button>
          </div>
        </div>

        {/* Last Report Card */}
        <div className="bg-base-200/50 border-base-300 rounded-xl border p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base-content/60 text-sm font-medium">Último Reporte</p>
              <h3 className="mt-2 line-clamp-1 text-lg font-bold">
                {reportsQuery.data?.[0]?.date_created
                  ? dayjs(reportsQuery.data[0].date_created).format("D MMMM, HH:mm")
                  : "N/A"}
              </h3>
            </div>
            <div className="bg-primary/10 text-primary rounded-lg p-2">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <p className="text-base-content/60 border-base-300 mt-4 border-t pt-4 text-xs">
            {reportsQuery.data?.[0]?.file_name || "Sin reportes recientes"}
          </p>
        </div>

        {/* Total Reports Card */}
        <div className="bg-base-200/50 border-base-300 rounded-xl border p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base-content/60 text-sm font-medium">Total Reportes</p>
              <h3 className="mt-2 text-2xl font-bold">{reportsQuery.data?.length || 0}</h3>
            </div>
            <div className="bg-secondary/10 text-secondary rounded-lg p-2">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <p className="text-base-content/60 border-base-300 mt-4 border-t pt-4 text-xs">Disponibles para descargar</p>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-base-100 border-base-300 overflow-hidden rounded-xl border shadow-sm">
        <div className="border-base-300 bg-base-200/30 flex items-center justify-between border-b p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText className="text-primary h-4 w-4" />
            Historial de Reportes
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200/50">
              <tr>
                <th>Fecha Creación</th>
                <th>Archivo</th>
                <th>Origen</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reportsQuery.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-base-content/50 py-8 text-center">
                    No se encontraron reportes.
                  </td>
                </tr>
              ) : (
                reportsQuery.data?.map((report) => (
                  <tr key={report.id} className="hover:bg-base-200/30 transition-colors">
                    <td className="font-medium">{dayjs(report.date_created).format("DD/MM/YYYY HH:mm")}</td>
                    <td className="font-mono text-sm">{report.file_name}</td>
                    <td>
                      <span
                        className={cn(
                          "badge badge-sm",
                          report.created_from === "schedule" ? "badge-outline" : "badge-ghost"
                        )}
                      >
                        {report.created_from === "schedule" ? "Automático" : "Manual"}
                      </span>
                    </td>
                    <td>
                      {/* Usually 'processed' or 'pending' - assuming available logic */}
                      <span className="text-success text-xs font-semibold">Disponible</span>
                    </td>
                    <td className="text-right">
                      <a
                        href={`/api/mercadopago/reports/download/${report.file_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm btn-square"
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ConfigModal open={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} />
      <GenerateReportModal open={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} />
    </div>
  );
}
