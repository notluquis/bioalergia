/**
 * Clinical Series Detail View
 * Shows detailed information about a clinical series
 */

import { Alert, Button, Card, Chip, Link, Spinner, Table } from "@heroui/react";
import { Calendar, Users } from "lucide-react";
import { useClinicalSeriesDetail } from "../queries";
import type { ClinicalSeriesKind, ClinicalSeriesStatus } from "../types";

const KIND_LABELS: Record<ClinicalSeriesKind, string> = {
  PATCH_TEST: "Prueba de Parche",
  SKIN_TEST: "Test Alérgico",
  SUBCUTANEOUS_TREATMENT: "Tratamiento Subcutáneo",
};

const STATUS_LABELS: Record<ClinicalSeriesStatus, string> = {
  PLANNED: "Planificada",
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  COMPLETED: "Finalizada",
  CANCELLED: "Cancelada",
};

const STATUS_COLORS: Record<ClinicalSeriesStatus, "success" | "default" | "danger" | "warning"> = {
  PLANNED: "default",
  ACTIVE: "success",
  INACTIVE: "warning",
  COMPLETED: "default",
  CANCELLED: "danger",
};

interface ClinicalSeriesDetailProps {
  id: number;
  onBack?: () => void;
}

export function ClinicalSeriesDetail({ id, onBack }: ClinicalSeriesDetailProps) {
  const { data: series, isLoading, error } = useClinicalSeriesDetail(id);

  if (error) {
    return (
      <Card className="p-6">
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>
              {error instanceof Error ? error.message : "Error al cargar serie clínica"}
            </Alert.Description>
          </Alert.Content>
        </Alert>
        {onBack && (
          <Button onPress={onBack} className="mt-4">
            ← Volver
          </Button>
        )}
      </Card>
    );
  }

  if (isLoading || !series) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {onBack && (
        <Button onPress={onBack} variant="secondary">
          ← Volver
        </Button>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{series.displayName || "Serie clínica"}</h2>
          <Chip color={STATUS_COLORS[series.status]} size="sm" variant="soft">
            {STATUS_LABELS[series.status]}
          </Chip>
        </div>
      </div>

      {/* Patient Info */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Users size={18} />
          Información del Paciente
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-foreground-500">Nombre</p>
            <p className="font-medium">{series.patientName || "No disponible"}</p>
          </div>
          <div>
            <p className="text-sm text-foreground-500">RUT</p>
            <p className="font-medium">{series.patientRut || "No disponible"}</p>
          </div>
          <div>
            <p className="text-sm text-foreground-500">Beneficiario</p>
            <p className="font-medium">{series.beneficiaryName || "No disponible"}</p>
          </div>
          <div>
            <p className="text-sm text-foreground-500">RUT beneficiario</p>
            <p className="font-medium">{series.beneficiaryRut || "No disponible"}</p>
          </div>
          <div>
            <p className="text-sm text-foreground-500">Tipo de Serie</p>
            <p className="font-medium">{KIND_LABELS[series.kind]}</p>
          </div>
          <div>
            <p className="text-sm text-foreground-500">Total de Eventos</p>
            <p className="font-medium">{series.events.length}</p>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-foreground-500 mb-1">Esperado</p>
          <p className="text-xl font-bold text-accent">${series.totalExpected.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-foreground-500 mb-1">Pagado</p>
          <p className="text-xl font-bold text-success">${series.totalPaid.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-foreground-500 mb-1">Vinculado</p>
          <p className="text-xl font-bold">${series.totalLinkedAmount.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-foreground-500 mb-1">Pendiente</p>
          <p
            className={`text-xl font-bold ${series.remainingExpected > 0 ? "text-warning" : "text-success"}`}
          >
            ${series.remainingExpected.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <h2 className="p-6 text-lg font-semibold flex items-center gap-2 border-b">
          <Calendar size={18} />
          Eventos ({series.events.length})
        </h2>
        <Table>
          <Table.Content aria-label="Eventos de la serie clínica">
            <Table.Header>
              <Table.Column isRowHeader>Fecha</Table.Column>
              <Table.Column>Resumen</Table.Column>
              <Table.Column>Etapa</Table.Column>
              <Table.Column className="text-right">Dosis</Table.Column>
            </Table.Header>
            <Table.Body>
              {series.events.map((event) => (
                <Table.Row key={event.eventId}>
                  <Table.Cell className="text-sm">{event.eventDate}</Table.Cell>
                  <Table.Cell>
                    <p className="font-medium truncate">{event.summary}</p>
                    {event.calendarGoogleId && (
                      <p className="text-sm text-foreground-500 truncate">
                        {event.calendarGoogleId}
                      </p>
                    )}
                  </Table.Cell>
                  <Table.Cell>{event.seriesStageLabel || "-"}</Table.Cell>
                  <Table.Cell className="text-right text-sm">
                    {event.dosageValue ? `${event.dosageValue} ${event.dosageUnit || ""}` : "-"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table>
      </Card>

      {/* Linked Documents */}
      {series.linkedDocuments.length > 0 && (
        <Card>
          <h2 className="p-6 text-lg font-semibold border-b">Documentos Vinculados</h2>
          <Table>
            <Table.Content aria-label="Documentos vinculados">
              <Table.Header>
                <Table.Column isRowHeader>Tipo</Table.Column>
                <Table.Column>Referencia</Table.Column>
                <Table.Column>Fecha</Table.Column>
                <Table.Column className="text-right">Monto</Table.Column>
              </Table.Header>
              <Table.Body>
                {series.linkedDocuments.map((doc) => (
                  <Table.Row key={doc.dteSaleDetailId}>
                    <Table.Cell className="font-medium">DTE</Table.Cell>
                    <Table.Cell>
                      <Link href="#" className="text-accent">
                        Folio {doc.folio}
                      </Link>
                    </Table.Cell>
                    <Table.Cell className="text-sm">{doc.documentDate}</Table.Cell>
                    <Table.Cell className="text-right font-medium">
                      ${doc.totalAmount.toLocaleString()}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table>
        </Card>
      )}

      {/* Eligible Date Range Info */}
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Rango elegible para vinculación</Alert.Title>
          <Alert.Description>
            Documentos elegibles desde {series.eligibleDocumentDateFrom} hasta{" "}
            {series.eligibleDocumentDateTo}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </div>
  );
}
