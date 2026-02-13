import { Accordion, Button, Card, Chip, Description, Spinner } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/es";
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";

dayjs.extend(relativeTime);
dayjs.locale("es");

interface DTESyncLog {
  id: string;
  period: string;
  docTypes: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCESS" | "PARTIAL" | "FAILED";
  triggerSource?: string;
  startedAt: string;
  endedAt?: string;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  errorMessage?: string;
}

interface SyncHistoryResponse {
  logs: DTESyncLog[];
  total: number;
}

const DTE_SYNC_LOG_SCHEMA = z.object({
  id: z.string(),
  period: z.string(),
  docTypes: z.string(),
  status: z.enum(["PENDING", "IN_PROGRESS", "SUCCESS", "PARTIAL", "FAILED"]),
  triggerSource: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  rowsInserted: z.number(),
  rowsUpdated: z.number(),
  rowsSkipped: z.number(),
  errorMessage: z.string().optional(),
});

const SYNC_HISTORY_RESPONSE_SCHEMA = z.object({
  logs: z.array(DTE_SYNC_LOG_SCHEMA),
  total: z.number(),
});

export function DTESyncHistoryPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dte-sync-history"],
    queryFn: async (): Promise<SyncHistoryResponse> => {
      return apiClient.get<SyncHistoryResponse>("/api/dte/sync-history", {
        query: { limit: 50, offset: 0 },
        responseSchema: SYNC_HISTORY_RESPONSE_SCHEMA,
      });
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, "success" | "warning" | "danger" | "default"> = {
      SUCCESS: "success",
      PARTIAL: "warning",
      FAILED: "danger",
      IN_PROGRESS: "warning",
      PENDING: "warning",
    };
    return colors[status] || "default";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      SUCCESS: "Exitoso",
      PARTIAL: "Parcial",
      FAILED: "Fallido",
      IN_PROGRESS: "En progreso",
      PENDING: "Pendiente",
    };
    return labels[status] || status;
  };

  const getTriggerLabel = (source?: string) => {
    const triggers: Record<string, string> = {
      cron: "Automático",
      manual: "Manual",
      user: "Usuario",
    };
    return triggers[source || ""] || "—";
  };

  const getDuration = (startedAt: string, endedAt?: string) => {
    if (!endedAt) {
      return "—";
    }

    const start = dayjs(startedAt);
    const end = dayjs(endedAt);
    const seconds = end.diff(start, "second");

    if (seconds < 60) {
      return `${seconds}s`;
    }
    if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${Math.round(seconds / 3600)}h`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "FAILED":
        return <AlertCircle className="h-4 w-4 text-danger" />;
      case "IN_PROGRESS":
      case "PENDING":
        return <Clock className="h-4 w-4 animate-spin text-warning" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <Card.Header className="flex items-center justify-between gap-3">
          <div>
            <span className="block font-bold text-2xl">Historial de Sincronización DTE</span>
            <Description className="text-default-500 text-sm">
              Registro de sincronizaciones automáticas y manuales de documentos tributarios
            </Description>
          </div>
          <Button
            isIconOnly
            variant="ghost"
            onPress={() => {
              queryClient.invalidateQueries({ queryKey: ["dte-sync-history"] });
            }}
            isDisabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" color="current" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </Card.Header>
      </Card>

      {/* Sync History List */}
      <Card>
        <Card.Content>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-danger" />
              <span className="font-medium text-danger">Error al cargar el historial</span>
              <Description className="text-default-500 text-sm">
                {error instanceof Error ? error.message : "Error desconocido"}
              </Description>
            </div>
          ) : data && data.logs.length > 0 ? (
            <Accordion className="w-full" variant="surface">
              {data.logs.map((log, index) => (
                <Accordion.Item key={log.id} defaultExpanded={index === 0}>
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <Chip color={getStatusColor(log.status)} variant="soft" size="sm">
                          <Chip.Label>{getStatusLabel(log.status)}</Chip.Label>
                        </Chip>
                      </div>

                      <div className="min-w-max">
                        <div className="font-mono font-semibold text-sm">
                          {log.period.slice(0, 4)}-{log.period.slice(4)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {log.docTypes.split(",").map((type) => (
                          <Chip key={type} size="sm" variant="secondary">
                            <Chip.Label className="text-xs">
                              {type === "sales" ? "Ventas" : "Compras"}
                            </Chip.Label>
                          </Chip>
                        ))}
                      </div>

                      <div className="ml-auto flex items-center gap-2 text-sm">
                        <Chip size="sm" variant="secondary">
                          <Chip.Label className="font-mono text-xs">
                            {getTriggerLabel(log.triggerSource)}
                          </Chip.Label>
                        </Chip>
                        <span className="whitespace-nowrap text-default-500 text-xs">
                          {dayjs(log.startedAt).fromNow()}
                        </span>
                      </div>
                    </Accordion.Trigger>
                  </Accordion.Heading>

                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-4">
                      {/* Timestamp Row */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Description className="mb-1 text-default-500 text-xs">
                            Iniciado
                          </Description>
                          <span className="block font-mono text-sm">
                            {dayjs(log.startedAt).format("DD/MM/YYYY HH:mm:ss")}
                          </span>
                        </div>
                        {log.endedAt && (
                          <div>
                            <Description className="mb-1 text-default-500 text-xs">
                              Finalizado
                            </Description>
                            <span className="block font-mono text-sm">
                              {dayjs(log.endedAt).format("DD/MM/YYYY HH:mm:ss")}
                              <span className="ml-2 text-default-500">
                                ({getDuration(log.startedAt, log.endedAt)})
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Results Grid */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-background p-3">
                          <Description className="mb-1 font-semibold text-default-500 text-xs">
                            Insertados
                          </Description>
                          <span className="block font-bold font-mono text-lg text-success">
                            +{log.rowsInserted}
                          </span>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <Description className="mb-1 font-semibold text-default-500 text-xs">
                            Actualizados
                          </Description>
                          <span className="block font-bold font-mono text-info text-lg">
                            ~{log.rowsUpdated}
                          </span>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <Description className="mb-1 font-semibold text-default-500 text-xs">
                            Omitidos
                          </Description>
                          <span className="block font-bold font-mono text-lg text-warning">
                            {log.rowsSkipped}
                          </span>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <Description className="mb-1 font-semibold text-default-500 text-xs">
                            Total
                          </Description>
                          <span className="block font-bold font-mono text-lg">
                            {log.rowsInserted + log.rowsUpdated + log.rowsSkipped}
                          </span>
                        </div>
                      </div>

                      {/* Error Message */}
                      {log.errorMessage && (
                        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3">
                          <Description className="mb-1 font-semibold text-danger text-xs">
                            Mensaje de Error
                          </Description>
                          <Description className="overflow-auto font-mono text-default-700 text-sm">
                            {log.errorMessage}
                          </Description>
                        </div>
                      )}

                      {/* ID Footer */}
                      <div className="border-default-100 border-t pt-3">
                        <Description className="font-mono text-default-400 text-xs">
                          ID: {log.id}
                        </Description>
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Clock className="h-8 w-8 text-default-300" />
              <span className="font-medium text-default-500">No hay registros aún</span>
              <Description className="text-default-400 text-sm">
                Los registros aparecerán aquí cuando se ejecute una sincronización
              </Description>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Summary Card */}
      {data && data.logs.length > 0 && (
        <Card>
          <Card.Header>
            <span className="font-semibold">Resumen</span>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <Description className="mb-1 text-default-500 text-xs">Total</Description>
                <span className="block font-bold text-2xl">{data.total}</span>
              </div>
              <div>
                <Description className="mb-1 text-default-500 text-xs">Exitosas</Description>
                <span className="block font-bold text-2xl text-success">
                  {data.logs.filter((l) => l.status === "SUCCESS").length}
                </span>
              </div>
              <div>
                <Description className="mb-1 text-default-500 text-xs">Parciales</Description>
                <span className="block font-bold text-2xl text-warning">
                  {data.logs.filter((l) => l.status === "PARTIAL").length}
                </span>
              </div>
              <div>
                <Description className="mb-1 text-default-500 text-xs">Fallidas</Description>
                <span className="block font-bold text-2xl text-danger">
                  {data.logs.filter((l) => l.status === "FAILED").length}
                </span>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
