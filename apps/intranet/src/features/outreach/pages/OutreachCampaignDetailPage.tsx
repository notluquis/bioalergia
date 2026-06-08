import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCampaign,
  useLaunchCampaign,
  usePauseCampaign,
  useSendBatch,
} from "../hooks/useOutreach";
import { CAMPAIGN_STATUS_LABELS, DELIVERY_STATUS_LABELS } from "../labels";

export function OutreachCampaignDetailPage() {
  const { id } = useParams({ from: "/_authed/outreach/campanas/$id" });
  const numId = Number.parseInt(id, 10);
  const { data, isLoading } = useCampaign(numId);
  const launch = useLaunchCampaign();
  const pause = usePauseCampaign();
  const sendBatchMutation = useSendBatch();

  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const c = data.campaign;
  const pendientes = data.envios.filter((e) => e.estado === "PENDIENTE").length;

  const sendBatch = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await sendBatchMutation.mutateAsync({ campaignId: numId, limit: 25 });
      const stamp = new Date().toLocaleTimeString();
      if (res.sent === 0 && res.failed === 0) {
        setLog((l) => [...l, `${stamp} · sin envíos (rate horario o pendientes=${res.remaining})`]);
      } else {
        setLog((l) => [
          ...l,
          `${stamp} · ✓ ${res.sent} enviados, ✗ ${res.failed} fallidos, quedan ${res.remaining}`,
        ]);
      }
    } catch (err) {
      setLog((l) => [...l, `✗ ${err instanceof Error ? err.message : "error"}`]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <Link to="/outreach/campanas" className="text-default-500 text-sm hover:underline">
        ← Volver a campañas
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">{c.nombre}</h2>
        <Chip variant="soft">{CAMPAIGN_STATUS_LABELS[c.estado]}</Chip>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Destinatarios" value={c.totalDestinatarios} />
        <Stat label="Enviados" value={c.enviados} />
        <Stat label="Pendientes" value={pendientes} />
        <Stat label="Errores" value={c.errores} accent={c.errores > 0 ? "danger" : undefined} />
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Acciones</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-wrap gap-2 p-4">
          {c.estado === "BORRADOR" && (
            <Button variant="primary" onPress={() => launch.mutate(numId)}>
              Iniciar envío (genera deliveries)
            </Button>
          )}
          {c.estado === "ENVIANDO" && (
            <Button variant="secondary" onPress={() => pause.mutate(numId)}>
              Pausar
            </Button>
          )}
          {c.estado === "PAUSADA" && (
            <Button variant="primary" onPress={() => launch.mutate(numId)}>
              Reanudar
            </Button>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Envío de correos</Card.Title>
          <Card.Description>
            Al iniciar la campaña, el servidor envía los correos automáticamente vía Resend,
            respetando el límite por hora. Usa el botón solo si quieres forzar el siguiente lote
            manualmente (envía hasta 25, o lo que permita el rate).
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              isDisabled={c.estado !== "ENVIANDO" || sending}
              onPress={() => {
                void sendBatch();
              }}
            >
              {sending ? "Enviando..." : "Enviar siguiente lote"}
            </Button>
          </div>
          {log.length > 0 && (
            <pre className="max-h-64 overflow-y-auto rounded bg-default-100 p-2 text-xs">
              {log.slice(-50).join("\n")}
            </pre>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Envíos ({data.envios.length})</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-1 p-4 text-sm">
          {data.envios.slice(0, 100).map((d) => (
            <div key={d.id} className="flex items-center justify-between">
              <span className="truncate">{d.emailDestinatario}</span>
              <Chip size="sm" variant="soft">
                {DELIVERY_STATUS_LABELS[d.estado]}
              </Chip>
            </div>
          ))}
        </Card.Content>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "danger" }) {
  return (
    <Card>
      <Card.Content className="p-4">
        <p className="text-default-500 text-xs uppercase">{label}</p>
        <p className={`font-bold text-2xl ${accent === "danger" ? "text-danger" : ""}`}>
          {value.toLocaleString("es-CL")}
        </p>
      </Card.Content>
    </Card>
  );
}
