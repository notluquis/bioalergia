import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  useCampaign,
  useLaunchCampaign,
  useNextDeliveryBatch,
  usePauseCampaign,
  useRecordDeliveryResult,
} from "../hooks/useOutreach";
import { CAMPAIGN_STATUS_LABELS, DELIVERY_STATUS_LABELS } from "../labels";
import {
  checkAgentHealth,
  getLocalAgentToken,
  getLocalAgentUrl,
  sendOutreachEmailViaAgent,
  setLocalAgentConfig,
} from "../mail-agent";
import { TextInput } from "../components/FormField";

export function OutreachCampaignDetailPage() {
  const { id } = useParams({ from: "/_authed/outreach/campanas/$id" });
  const numId = Number.parseInt(id, 10);
  const { data, isLoading } = useCampaign(numId);
  const launch = useLaunchCampaign();
  const pause = usePauseCampaign();
  const nextBatch = useNextDeliveryBatch();
  const recordResult = useRecordDeliveryResult();

  const [agentUrl, setAgentUrl] = useState(getLocalAgentUrl());
  const [agentToken, setAgentToken] = useState(getLocalAgentToken() ?? "");
  const [agentReady, setAgentReady] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    void checkAgentHealth().then(setAgentReady);
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const c = data.campaign;
  const pendientes = data.envios.filter((e) => e.estado === "PENDIENTE").length;

  const saveAgentConfig = () => {
    setLocalAgentConfig(agentUrl, agentToken);
    void checkAgentHealth().then(setAgentReady);
  };

  const sendBatch = async () => {
    if (sending) return;
    setSending(true);
    try {
      const batch = await nextBatch.mutateAsync({ campaignId: numId, limit: 5 });
      if (batch.items.length === 0) {
        setLog((l) => [
          ...l,
          `${new Date().toLocaleTimeString()} · sin items disponibles (rate o pendientes=${batch.remaining})`,
        ]);
        return;
      }
      for (const item of batch.items) {
        try {
          await sendOutreachEmailViaAgent({
            to: item.emailDestinatario,
            from: item.fromEmail,
            subject: item.asunto,
            html: item.cuerpoHtml,
            text: item.cuerpoTexto,
            replyTo: item.replyTo ?? undefined,
          });
          await recordResult.mutateAsync({ deliveryId: item.deliveryId, status: "ENVIADO" });
          setLog((l) => [...l, `✓ ${item.emailDestinatario} (${item.establecimientoNombre})`]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "error desconocido";
          await recordResult.mutateAsync({
            deliveryId: item.deliveryId,
            status: "ERROR",
            errorMensaje: msg,
          });
          setLog((l) => [...l, `✗ ${item.emailDestinatario}: ${msg}`]);
        }
      }
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
          <Card.Title>Agente local de correo</Card.Title>
          <Card.Description>
            Los emails se envían desde tu equipo via el agente local. Configura URL + token.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <TextInput
              label="URL agente"
              placeholder="https://127.0.0.1:3333"
              value={agentUrl}
              onValueChange={setAgentUrl}
            />
            <TextInput
              label="Token"
              placeholder="X-Local-Agent-Token"
              value={agentToken}
              onValueChange={setAgentToken}
            />
            <div className="flex items-end">
              <Button size="sm" variant="secondary" onPress={saveAgentConfig}>
                Guardar y verificar
              </Button>
            </div>
          </div>
          {agentReady !== null && (
            <Chip size="sm" color={agentReady ? "success" : "danger"} variant="soft">
              Agente {agentReady ? "OK" : "no disponible"}
            </Chip>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              isDisabled={c.estado !== "ENVIANDO" || !agentReady || sending}
              onPress={() => {
                void sendBatch();
              }}
            >
              {sending ? "Enviando..." : "Enviar siguiente lote (5)"}
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
