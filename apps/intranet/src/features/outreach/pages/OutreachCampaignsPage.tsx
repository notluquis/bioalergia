import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useCampaigns } from "../hooks/useOutreach";
import { CAMPAIGN_STATUS_LABELS } from "../labels";

export function OutreachCampaignsPage() {
  const { data, isLoading } = useCampaigns();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-end">
        <Link to="/outreach/campanas/nueva">
          <Button variant="primary">Nueva campaña</Button>
        </Link>
      </div>

      {isLoading || !data ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : data.campaigns.length === 0 ? (
        <Card>
          <Card.Content className="p-4">
            <p className="text-default-500 text-sm">
              No hay campañas. Crea una nueva para enviar emails masivos.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.campaigns.map((c) => (
            <Card key={c.id}>
              <Card.Header className="flex items-center justify-between">
                <div>
                  <Card.Title>{c.nombre}</Card.Title>
                  <Card.Description>Asunto: {c.asunto}</Card.Description>
                </div>
                <Chip size="sm" variant="soft">
                  {CAMPAIGN_STATUS_LABELS[c.estado]}
                </Chip>
              </Card.Header>
              <Card.Content className="space-y-2 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-default-500">Destinatarios</span>
                  <span>{c.totalDestinatarios}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-default-500">Enviados</span>
                  <span className="text-success">{c.enviados}</span>
                </div>
                {c.errores > 0 && (
                  <div className="flex justify-between">
                    <span className="text-default-500">Errores</span>
                    <span className="text-danger">{c.errores}</span>
                  </div>
                )}
                <Link
                  to="/outreach/campanas/$id"
                  params={{ id: String(c.id) }}
                  className="mt-2 inline-block"
                >
                  <Button size="sm" variant="secondary">
                    Abrir
                  </Button>
                </Link>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
