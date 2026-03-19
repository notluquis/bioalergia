/**
 * Clinical Series Detail View
 * Shows detailed information about a clinical series
 */

import {
  Alert,
  Badge,
  Button,
  Card,
  Link,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Calendar, Users } from "lucide-react";
import { useClinicalSeriesDetail } from "../queries";
import type { ClinicalSeriesKind, ClinicalSeriesStatus } from "../types";

const KIND_LABELS: Record<ClinicalSeriesKind, string> = {
  PATCH_TEST: "Prueba de Parche",
  SKIN_TEST: "Test Alérgico",
  SUBCUTANEOUS_TREATMENT: "Tratamiento Subcutáneo",
};

const STATUS_LABELS: Record<ClinicalSeriesStatus, string> = {
  ACTIVE: "Activa",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
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
        <Alert status="default">
          <div className="space-y-2">
            <h3 className="font-semibold">Error</h3>
            <p className="text-sm">
              {error instanceof Error ? error.message : "Error al cargar serie clínica"}
            </p>
          </div>
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
          <h1 className="text-2xl font-bold">{series.displayName || "Serie clínica"}</h1>
          <Badge color={series.status === "ACTIVE" ? "success" : "default"}>
            {STATUS_LABELS[series.status]}
          </Badge>
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
          <TableHeader>
            <TableColumn>Fecha</TableColumn>
            <TableColumn>Resumen</TableColumn>
            <TableColumn>Etapa</TableColumn>
            <TableColumn className="text-right">Dosis</TableColumn>
          </TableHeader>
          <TableBody>
            {series.events.map((event) => (
              <TableRow key={event.eventId}>
                <TableCell className="text-sm">{event.eventDate}</TableCell>
                <TableCell>
                  <p className="font-medium truncate">{event.summary}</p>
                  {event.calendarGoogleId && (
                    <p className="text-sm text-foreground-500 truncate">{event.calendarGoogleId}</p>
                  )}
                </TableCell>
                <TableCell>{event.seriesStageLabel || "-"}</TableCell>
                <TableCell className="text-right text-sm">
                  {event.dosageValue ? `${event.dosageValue} ${event.dosageUnit || ""}` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Linked Documents */}
      {series.linkedDocuments.length > 0 && (
        <Card>
          <h2 className="p-6 text-lg font-semibold border-b">Documentos Vinculados</h2>
          <Table>
            <TableHeader>
              <TableColumn>Tipo</TableColumn>
              <TableColumn>Referencia</TableColumn>
              <TableColumn>Fecha</TableColumn>
              <TableColumn className="text-right">Monto</TableColumn>
            </TableHeader>
            <TableBody>
              {series.linkedDocuments.map((doc) => (
                <TableRow key={doc.dteSaleDetailId}>
                  <TableCell className="font-medium">DTE</TableCell>
                  <TableCell>
                    <Link href="#" className="text-accent">
                      Folio {doc.folio}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{doc.documentDate}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${doc.totalAmount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Eligible Date Range Info */}
      <Alert status="default">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Rango elegible para vinculación</h3>
          <p className="text-sm">
            Documentos elegibles desde {series.eligibleDocumentDateFrom} hasta{" "}
            {series.eligibleDocumentDateTo}
          </p>
        </div>
      </Alert>
    </div>
  );
}
