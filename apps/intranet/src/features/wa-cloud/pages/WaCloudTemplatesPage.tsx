import { Card, Chip, Spinner, Table } from "@heroui/react";
import { useTemplates } from "../hooks/useWaCloud";

export function WaCloudTemplatesPage() {
  const tpl = useTemplates();

  if (tpl.isLoading || !tpl.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Templates">
                <Table.Header>
                  <Table.Column isRowHeader>Nombre</Table.Column>
                  <Table.Column>Idioma</Table.Column>
                  <Table.Column>Categoría</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column>Calidad</Table.Column>
                </Table.Header>
                <Table.Body items={tpl.data.templates}>
                  {(t) => (
                    <Table.Row id={String(t.id)}>
                      <Table.Cell>{t.name}</Table.Cell>
                      <Table.Cell>{t.language}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft">
                          {t.category}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={
                            t.status === "APPROVED"
                              ? "success"
                              : t.status === "REJECTED" || t.status === "DISABLED"
                                ? "danger"
                                : "warning"
                          }
                          variant="soft"
                        >
                          {t.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{t.qualityScore ?? "—"}</Table.Cell>
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
