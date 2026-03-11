/**
 * Clinical Series - List & Filter View
 * Displays clinical series with integrated filtering
 */

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useState } from "react";
import { useClinicalSeries, useClinicalSeriesDetail, useRebuildClinicalSeries } from "./queries";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesKind,
  ClinicalSeriesSnapshot,
  ClinicalSeriesStatus,
} from "./types";

const KIND_OPTIONS: { label: string; value: ClinicalSeriesKind }[] = [
  { label: "Prueba de Parche", value: "PATCH_TEST" },
  { label: "Test Alérgico", value: "SKIN_TEST" },
  { label: "Tratamiento Subcutáneo", value: "SUBCUTANEOUS_TREATMENT" },
];

const STATUS_OPTIONS: { label: string; value: ClinicalSeriesStatus }[] = [
  { label: "Activa", value: "ACTIVE" },
  { label: "Completada", value: "COMPLETED" },
  { label: "Cancelada", value: "CANCELLED" },
];

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

export function ClinicalSeriesView() {
  const [filters, setFilters] = useState<ClinicalSeriesFilters>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: series, isLoading: isLoadingList, error: listError } = useClinicalSeries(filters);
  const { data: detail, isLoading: isLoadingDetail } = useClinicalSeriesDetail(selectedId ?? 0);
  const rebuildMutation = useRebuildClinicalSeries();

  const handleRutChange = (value: string) => {
    setFilters((prev: ClinicalSeriesFilters) => ({
      ...prev,
      patientRut: value || undefined,
    }));
  };

  const handleNameChange = (value: string) => {
    setFilters((prev: ClinicalSeriesFilters) => ({
      ...prev,
      patientName: value || undefined,
    }));
  };

  const handleKindChange = (
    key: string | number | symbol | (string | number | symbol)[] | null,
  ) => {
    if (key && typeof key === "string") {
      setFilters((prev: ClinicalSeriesFilters) => ({
        ...prev,
        kind: key as ClinicalSeriesKind,
      }));
    } else {
      setFilters((prev: ClinicalSeriesFilters) => {
        const { kind: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleStatusChange = (
    key: string | number | symbol | (string | number | symbol)[] | null,
  ) => {
    if (key && typeof key === "string") {
      setFilters((prev: ClinicalSeriesFilters) => ({
        ...prev,
        status: key as ClinicalSeriesStatus,
      }));
    } else {
      setFilters((prev: ClinicalSeriesFilters) => {
        const { status: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleRebuild = async () => {
    await rebuildMutation.mutateAsync({});
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Column - List & Filters */}
      <div className="space-y-4 lg:col-span-2">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Series Clínicas</h1>
          <p className="text-foreground-500 text-sm">
            Gestiona grupos de tratamientos y pruebas alérgicas
          </p>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <Label className="text-sm">RUT del Paciente</Label>
              <Input
                onChange={(e) => handleRutChange(e.target.value)}
                placeholder="12345678-9"
                value={filters.patientRut || ""}
              />
            </div>

            <div>
              <Label className="text-sm">Nombre del Paciente</Label>
              <Input
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Nombre"
                value={filters.patientName || ""}
              />
            </div>

            <div>
              <Label className="text-sm">Tipo</Label>
              <Select onChange={handleKindChange} selectedKey={filters.kind || ""}>
                <ListBox items={KIND_OPTIONS}>
                  {(item) => <ListBox.Item key={item.value}>{item.label}</ListBox.Item>}
                </ListBox>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Estado</Label>
              <Select onChange={handleStatusChange} selectedKey={filters.status || ""}>
                <ListBox items={STATUS_OPTIONS}>
                  {(item) => <ListBox.Item key={item.value}>{item.label}</ListBox.Item>}
                </ListBox>
              </Select>
            </div>

            <Button
              isDisabled={rebuildMutation.isPending}
              onPress={handleRebuild}
              variant="secondary"
            >
              {rebuildMutation.isPending ? "Reorganizando..." : "Reorganizar Series"}
            </Button>
          </div>
        </Card>

        {/* List Error */}
        {listError && (
          <Card className="p-4 bg-danger-50">
            <p className="text-sm text-danger">
              Error: {listError instanceof Error ? listError.message : "Error desconocido"}
            </p>
          </Card>
        )}

        {/* List */}
        {isLoadingList ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : !series || series.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <p className="text-foreground-500">No hay series clínicas que coincidan</p>
            </div>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableColumn>Paciente</TableColumn>
                <TableColumn>Tipo</TableColumn>
                <TableColumn>Estado</TableColumn>
              </TableHeader>
              <TableBody>
                {series.map((s: ClinicalSeriesSnapshot) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-default-100"
                    onPress={() => setSelectedId(s.id)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.patientName || "—"}</span>
                        <span className="text-xs text-foreground-500">{s.patientRut}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{KIND_LABELS[s.kind]}</TableCell>
                    <TableCell>
                      <Badge color={s.status === "ACTIVE" ? "success" : "default"}>
                        {STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Right Column - Detail Panel */}
      {selectedId && (
        <div className="lg:sticky lg:top-4 space-y-4">
          {isLoadingDetail ? (
            <Card className="p-8 flex justify-center">
              <Spinner size="lg" />
            </Card>
          ) : detail ? (
            <>
              <Card className="p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-lg">{detail.displayName || "Detalle"}</h2>
                  <p className="text-xs text-foreground-500">{detail.patientRut}</p>
                </div>

                <div className="space-y-3 text-sm">
                  <Surface className="p-3 rounded-lg">
                    <p className="text-foreground-500 text-xs mb-1">Esperado</p>
                    <p className="font-semibold text-accent">
                      ${detail.totalExpected.toLocaleString()}
                    </p>
                  </Surface>

                  <Surface className="p-3 rounded-lg">
                    <p className="text-foreground-500 text-xs mb-1">Pagado</p>
                    <p className="font-semibold text-success">
                      ${detail.totalPaid.toLocaleString()}
                    </p>
                  </Surface>

                  <Surface className="p-3 rounded-lg">
                    <p className="text-foreground-500 text-xs mb-1">Pendiente</p>
                    <p className="font-semibold">${detail.remainingExpected.toLocaleString()}</p>
                  </Surface>

                  <Surface className="p-3 rounded-lg">
                    <p className="text-foreground-500 text-xs mb-1">Eventos</p>
                    <p className="font-semibold">{detail.events.length}</p>
                  </Surface>
                </div>

                <Button onPress={() => setSelectedId(null)} variant="secondary" className="w-full">
                  Cerrar
                </Button>
              </Card>

              {detail.events.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Eventos Recientes</h3>
                  <div className="space-y-2">
                    {detail.events.slice(0, 3).map((event: ClinicalSeriesSnapshot["events"][0]) => (
                      <Surface key={event.id} className="p-2 text-xs">
                        <p className="font-medium">{event.startDate}</p>
                        <p className="text-foreground-500 truncate">{event.summary}</p>
                        {event.dosageValue && (
                          <p className="text-accent">
                            {event.dosageValue} {event.dosageUnit}
                          </p>
                        )}
                      </Surface>
                    ))}
                    {detail.events.length > 3 && (
                      <p className="text-xs text-foreground-500 text-center">
                        +{detail.events.length - 3} más
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
