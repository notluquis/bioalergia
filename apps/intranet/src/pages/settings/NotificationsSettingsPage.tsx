import { Button, Card, Label, ListBox, Select } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, ShieldCheck } from "lucide-react";

import {
  getPushPreviewMode,
  type PushPreviewMode,
  setPushPreviewMode,
} from "@/features/notifications/api";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const MODE_DESCRIPTIONS: Record<PushPreviewMode, { label: string; desc: string }> = {
  GENERIC: {
    label: "Genérico (recomendado)",
    desc: "“Bioalergia · N mensajes nuevos”. Sin información del paciente en la pantalla bloqueada. Default per Ley 21.719 + HIPAA 2026.",
  },
  SENDER_NAME: {
    label: "Solo nombre del remitente",
    desc: "Verás el nombre del paciente sin el contenido del mensaje. Úsalo solo si tu device tiene bloqueo biométrico activo.",
  },
  FULL: {
    label: "Nombre + preview del mensaje",
    desc: "Verás el nombre y los primeros 120 caracteres del mensaje en la pantalla bloqueada. Máxima utilidad, máxima exposición — solo en device personal con biometría.",
  },
};

export function NotificationsSettingsPage() {
  const { isSubscribed, permission, toggleSubscription } = usePushNotifications();
  const qc = useQueryClient();
  const previewModeQ = useQuery({
    queryKey: ["notifications", "previewMode"],
    queryFn: () => getPushPreviewMode(),
  });
  const setMode = useMutation({
    mutationFn: (mode: PushPreviewMode) => setPushPreviewMode(mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", "previewMode"] }),
  });

  const mode = previewModeQ.data?.mode ?? "GENERIC";
  const isBlocked = permission === "denied";

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-2xl">Notificaciones</h1>
      <p className="text-default-700 text-sm">
        Configura cómo y cuándo este dispositivo recibe alertas push del sistema.
      </p>

      <Card className="p-4">
        <Card.Header className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <Bell size={18} className="text-success" />
            ) : (
              <BellOff size={18} className="text-default-500" />
            )}
            <h2 className="font-medium text-base">Push en este dispositivo</h2>
          </div>
          <Button
            variant={isSubscribed ? "outline" : "primary"}
            size="sm"
            isDisabled={isBlocked}
            onPress={() => void toggleSubscription()}
          >
            {isSubscribed ? "Desactivar" : "Activar"}
          </Button>
        </Card.Header>
        <Card.Content className="space-y-2 text-default-700 text-sm">
          {isBlocked && (
            <p className="rounded-md bg-danger/10 p-2 text-danger text-xs">
              El navegador bloqueó las notificaciones. Habilítalas desde la configuración del
              navegador para este sitio y vuelve a activarlas aquí.
            </p>
          )}
          <p>
            Las notificaciones llegan cifradas extremo-a-extremo (VAPID) y los endpoints se eliminan
            automáticamente al cerrar sesión.
          </p>
        </Card.Content>
      </Card>

      <Card className="p-4">
        <Card.Header className="flex items-center gap-2 pb-3">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="font-medium text-base">Privacidad del contenido visible</h2>
        </Card.Header>
        <Card.Content className="space-y-3">
          <Label className="text-default-600 text-xs">
            Qué se muestra en la pantalla bloqueada / centro de notificaciones del sistema operativo
          </Label>
          <Select
            value={mode}
            onChange={(k) => setMode.mutate(k as PushPreviewMode)}
            isDisabled={setMode.isPending || previewModeQ.isLoading || !isSubscribed}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(Object.keys(MODE_DESCRIPTIONS) as PushPreviewMode[]).map((m) => (
                  <ListBox.Item key={m} id={m} textValue={MODE_DESCRIPTIONS[m].label}>
                    {MODE_DESCRIPTIONS[m].label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <p className="rounded-md bg-default/40 p-2 text-default-700 text-xs">
            {MODE_DESCRIPTIONS[mode].desc}
          </p>
          <p className="text-default-500 text-xs">
            Cualquiera que sea el modo elegido, al tocar la notificación la app exige sesión
            autenticada antes de mostrar el contenido completo. La cuenta se cierra automáticamente
            tras 8 horas de inactividad.
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
