import { Card, Chip, Spinner, Table } from "@heroui/react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { waCloudORPCClient } from "../orpc";

export function WaCloudWebhookLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["wa-cloud", "webhook-logs"],
    queryFn: () => waCloudORPCClient.listWebhookLogs({ limit: 100 }),
    refetchInterval: 3000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner aria-label="Cargando" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <Card.Header>
          <Card.Title>Webhook logs (refresh 3s)</Card.Title>
          <Card.Description>
            Cada POST de Meta queda registrado. Click "Test" en Meta dashboard y aparece aquí.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Webhook logs">
                <Table.Header>
                  <Table.Column isRowHeader>Recibido</Table.Column>
                  <Table.Column>Firma HMAC</Table.Column>
                  <Table.Column>Procesado</Table.Column>
                  <Table.Column>Eventos</Table.Column>
                  <Table.Column>Fields</Table.Column>
                  <Table.Column>Error</Table.Column>
                  <Table.Column>Preview</Table.Column>
                </Table.Header>
                <Table.Body items={data.logs}>
                  {(l) => (
                    <Table.Row id={String(l.id)}>
                      <Table.Cell>{dayjs(l.receivedAt).format("HH:mm:ss")}</Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={l.signatureValid ? "success" : "danger"}
                          variant="soft"
                        >
                          {l.signatureValid ? "OK" : "INVALID"}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" color={l.processed ? "success" : "warning"} variant="soft">
                          {l.processed ? "✓" : "no"}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">{l.eventCount}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {l.fields.length === 0 ? (
                            <span className="text-default-400 text-xs">—</span>
                          ) : (
                            l.fields.map((f) => (
                              <Chip key={f} size="sm" variant="soft">
                                {f}
                              </Chip>
                            ))
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {l.errorMessage ? (
                          <span className="text-danger text-xs">
                            {l.errorMessage.slice(0, 100)}
                          </span>
                        ) : (
                          <span className="text-default-400 text-xs">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <pre className="max-w-xl overflow-x-auto rounded bg-default-100 p-1 text-xs">
                          {l.preview}
                        </pre>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}
