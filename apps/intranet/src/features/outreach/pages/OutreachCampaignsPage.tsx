import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useCampaigns } from "../hooks/useOutreach";
import { CAMPAIGN_STATUS_LABELS } from "../labels";

export function OutreachCampaignsPage() {
  const { data, isLoading } = useCampaigns();

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Campañas de email</h1>
        <Button as={Link} to="/outreach/campanas/nueva" color="primary">
          Nueva campaña
        </Button>
      </header>

      {isLoading || !data ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : data.campaigns.length === 0 ? (
        <Card>
          <Card.Body>
            <p className="text-default-500 text-sm">
              No hay campañas. Crea una nueva para enviar emails masivos a establecimientos.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.campaigns.map((c) => (
            <Card key={c.id}>
              <Card.Header className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{c.nombre}</h3>
                  <p className="text-default-500 text-xs">Asunto: {c.asunto}</p>
                </div>
                <Chip size="sm" variant="flat">
                  {CAMPAIGN_STATUS_LABELS[c.estado]}
                </Chip>
              </Card.Header>
              <Card.Body className="space-y-2 text-sm">
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
                <Button
                  as={Link}
                  to="/outreach/campanas/$id"
                  params={{ id: String(c.id) }}
                  size="sm"
                  variant="flat"
                  className="mt-2"
                >
                  Abrir
                </Button>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
