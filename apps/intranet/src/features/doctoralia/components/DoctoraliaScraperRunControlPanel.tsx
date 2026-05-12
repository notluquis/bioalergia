import { Alert, Button, Card, Chip, Description, Spinner, Surface } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Bug, Play, RotateCcw } from "lucide-react";

import { useToast } from "@/context/ToastContext";
import { activateDoctoraliaScraperRunOverride, clearDoctoraliaScraperRunOverride } from "../api";
import { doctoraliaSettingsKeys } from "../settings-queries";

export function DoctoraliaScraperRunControlPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    ...doctoraliaSettingsKeys.scraperRunOverride(),
    refetchInterval: 30_000,
  });

  const activateMutation = useMutation({
    mutationFn: () => activateDoctoraliaScraperRunOverride(),
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message, "No se pudo forzar la próxima corrida");
    },
    onSuccess: (data) => {
      void queryClient.setQueryData(doctoraliaSettingsKeys.scraperRunOverride().queryKey, data);
      toast.success(
        "La próxima corrida del scraper ignorará la ventana horaria una sola vez.",
        "Override activado"
      );
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearDoctoraliaScraperRunOverride(),
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message, "No se pudo limpiar el override");
    },
    onSuccess: (data) => {
      void queryClient.setQueryData(doctoraliaSettingsKeys.scraperRunOverride().queryKey, data);
      toast.success("El override pendiente fue limpiado.", "Override eliminado");
    },
  });

  const status = statusQuery.data;
  const pending = activateMutation.isPending || clearMutation.isPending;

  return (
    <Card>
      <Card.Header className="flex flex-col items-start gap-1">
        <h2 className="flex items-center gap-2 font-semibold text-base">
          <Bug className="h-4 w-4" /> Override de horario
        </h2>
        <Card.Description className="text-default-500 text-xs">
          Úsalo para un Run manual en Railway o para la próxima corrida automática cuando quieras
          saltarte la restricción horaria. Se consume una sola vez.
        </Card.Description>
      </Card.Header>

      <Card.Content className="space-y-4">
        {statusQuery.isPending ? (
          <div className="flex items-center gap-2 text-default-500 text-sm">
            <Spinner size="sm" />
            <span>Cargando estado…</span>
          </div>
        ) : status?.active ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip color="warning" size="sm" variant="soft">
                Próxima corrida forzada
              </Chip>
              {status.expiresAt ? (
                <Chip size="sm" variant="soft">
                  Expira {dayjs(status.expiresAt).tz().format("DD/MM HH:mm")}
                </Chip>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                <Description className="font-semibold text-[11px] text-default-400">
                  Solicitado
                </Description>
                <p className="mt-1 font-medium text-sm">
                  {status.requestedAt
                    ? dayjs(status.requestedAt).tz().format("DD/MM/YYYY HH:mm")
                    : "—"}
                </p>
              </Surface>
              <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                <Description className="font-semibold text-[11px] text-default-400">
                  Solicitado por
                </Description>
                <p className="mt-1 font-medium text-sm">{status.requestedByEmail ?? "—"}</p>
              </Surface>
            </div>
          </>
        ) : (
          <Alert status="default">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Sin override pendiente</Alert.Title>
              <Alert.Description>
                El scraper respetará su horario normal hasta que actives la próxima corrida forzada.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Card.Content>

      <Card.Footer className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          isDisabled={!status?.active || pending}
          isPending={clearMutation.isPending}
          onPress={() => clearMutation.mutate()}
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar override
        </Button>
        <Button
          isDisabled={pending}
          isPending={activateMutation.isPending}
          onPress={() => activateMutation.mutate()}
        >
          <Play className="h-4 w-4" />
          Forzar próxima corrida
        </Button>
      </Card.Footer>
    </Card>
  );
}
