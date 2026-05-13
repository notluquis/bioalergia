import { Accordion, Button, Card, Chip, Description, Skeleton } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/es";
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { fetchDTESyncHistory } from "@/features/settings/dte-sync-api";

dayjs.extend(relativeTime);
dayjs.locale("es");

interface DTESyncLog {
  id: string;
  period: string;
  docTypes: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCESS" | "PARTIAL" | "FAILED";
  triggerSource?: null | string;
  startedAt: Date;
  completedAt?: Date | null;
  totalInserted?: null | number;
  totalUpdated?: null | number;
  totalSkipped?: null | number;
  errorMessage?: null | string;
}

interface SyncHistoryResponse {
  logs: DTESyncLog[];
  total: number;
}

export function DTESyncHistoryPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dte-sync-history"],
    queryFn: async (): Promise<SyncHistoryResponse> => fetchDTESyncHistory(50, 0),
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

  const getDuration = (startedAt: Date, completedAt?: Date | null) => {
    if (!completedAt) {
      return "—";
    }

    const start = dayjs(startedAt);
    const end = dayjs(completedAt);
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
        return <CheckCircle2 className="text-success size-4" />;
      case "FAILED":
        return <AlertCircle className="text-danger size-4" />;
      case "IN_PROGRESS":
      case "PENDING":
        return <Clock className="text-warning size-4" />;
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
            isPending={isLoading}
            variant="outline"
            onPress={() => {
              void queryClient.invalidateQueries({ queryKey: ["dte-sync-history"] });
            }}
            isDisabled={isLoading}
          >
            <RefreshCw className="size-4" />
          </Button>
        </Card.Header>
      </Card>

      {/* Sync History List */}
      <Card>
        <Card.Content>
          {isLoading ? (
            <div className="space-y-3 py-3">
              {["1", "2", "3", "4", "5"].map((skeletonKey) => (
                <div
                  className="rounded-xl border border-default-200 bg-default-50/60 px-4 py-3"
                  key={`dte-history-skeleton-${skeletonKey}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-16 rounded-md" />
                    </div>
                    <Skeleton className="h-4 w-24 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertCircle className="text-danger size-8" />
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
                            {getTriggerLabel(log.triggerSource ?? undefined)}
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
                          <span className="mb-1 block text-default-500 text-xs">Iniciado</span>
                          <span className="block font-mono text-sm">
                            {dayjs(log.startedAt).tz().format("DD/MM/YYYY HH:mm:ss")}
                          </span>
                        </div>
                        {log.completedAt && (
                          <div>
                            <span className="mb-1 block text-default-500 text-xs">Finalizado</span>
                            <span className="block font-mono text-sm">
                              {dayjs(log.completedAt).tz().format("DD/MM/YYYY HH:mm:ss")}
                              <span className="ml-2 text-default-500">
                                ({getDuration(log.startedAt, log.completedAt)})
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Results Grid */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-background p-3">
                          <span className="mb-1 block font-semibold text-default-500 text-xs">
                            Insertados
                          </span>
                          <span className="block font-bold font-mono text-lg text-success">
                            +{log.totalInserted ?? 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <span className="mb-1 block font-semibold text-default-500 text-xs">
                            Actualizados
                          </span>
                          <span className="block font-bold font-mono text-info text-lg">
                            ~{log.totalUpdated ?? 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <span className="mb-1 block font-semibold text-default-500 text-xs">
                            Omitidos
                          </span>
                          <span className="block font-bold font-mono text-lg text-warning">
                            {log.totalSkipped ?? 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-background p-3">
                          <span className="mb-1 block font-semibold text-default-500 text-xs">
                            Total
                          </span>
                          <span className="block font-bold font-mono text-lg">
                            {(log.totalInserted ?? 0) +
                              (log.totalUpdated ?? 0) +
                              (log.totalSkipped ?? 0)}
                          </span>
                        </div>
                      </div>

                      {/* Error Message */}
                      {log.errorMessage && (
                        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3">
                          <span className="mb-1 block font-semibold text-danger text-xs">
                            Mensaje de Error
                          </span>
                          <div className="overflow-auto font-mono text-default-700 text-sm">
                            {log.errorMessage}
                          </div>
                        </div>
                      )}

                      {/* ID Footer */}
                      <div className="border-default-100 border-t pt-3">
                        <span className="block font-mono text-default-400 text-xs">
                          ID: {log.id}
                        </span>
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Clock className="text-default-300 size-8" />
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
                <span className="mb-1 block text-default-500 text-xs">Total</span>
                <span className="block font-bold text-2xl">{data.total}</span>
              </div>
              <div>
                <span className="mb-1 block text-default-500 text-xs">Exitosas</span>
                <span className="block font-bold text-2xl text-success">
                  {data.logs.filter((l) => l.status === "SUCCESS").length}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-default-500 text-xs">Parciales</span>
                <span className="block font-bold text-2xl text-warning">
                  {data.logs.filter((l) => l.status === "PARTIAL").length}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-default-500 text-xs">Fallidas</span>
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
